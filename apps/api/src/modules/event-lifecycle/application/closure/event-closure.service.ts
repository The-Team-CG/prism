import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsComplianceCheck, OpsEvent, OpsEventInsight, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { toPrismaJson } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, EventLifecycleService, OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import type { ArchiveComparisonQuery, ArchiveSearchFilters, PrismCoordinatorInsightFacts, RecordActualEventEndInput, RecordLogisticsCompletionInput, StartEventWrapUpInput, UpdateEventWrapUpInput } from '@prism/types';
import { EventAccessPolicyService, type EventOpsActorInput, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { FileRequirementsMatrixService } from '../files/file-requirements-matrix.service';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { archivedEventMatchesSearch } from '../../domain/archive-search.policy';
import { mapArchiveComparisonRow, mapArchivedEventSearchHit, mapLogisticsCompletion } from './closure.mappers';
import { COMMERCIAL_FACTS_READER, type CommercialFactsReader } from '@prism/contexts/read-models/commercial-facts-reader';
import { LIFECYCLE_FACTS_READER, type LifecycleFactsReader } from '@prism/contexts/read-models/lifecycle-facts';

export type ArchiveEventInput = EventOpsActorInput & {
  overrideReason?: string;
  actorName?: string;
};

const WRAP_UP_HOURS = 24;
const WRAP_UP_REMINDER_HOURS = [12, 24] as const;
const defaultWrapUpSections = () => ({
  logistics: { status: 'pending', evidence: '', completedAt: null },
  issues: { status: 'pending', evidence: '', completedAt: null },
  feedback: { status: 'pending', evidence: '', completedAt: null },
});
const defaultRequiredItems = () => ({ post_event_documents: false, billing: false, logistics: false, issues: false, feedback: false });

@Injectable()
export class EventClosureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileRequirementsMatrixService: FileRequirementsMatrixService,
    private readonly eventLifecycleService: EventLifecycleService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(COMMERCIAL_FACTS_READER) private readonly commercialFactsReader: CommercialFactsReader,
    @Inject(LIFECYCLE_FACTS_READER) private readonly lifecycleFactsReader: LifecycleFactsReader,
  ) {}

  async closeGates(eventId: string) {
    await this.requireEvent(eventId);
    return this.fileRequirementsMatrixService.closeGates(eventId);
  }

  async recordActualEventEnd(eventId: string, input: RecordActualEventEndInput, actor: ResolvedEventOpsActor) {
    const actualEndedAt = new Date(input.actualEndedAt);
    if (Number.isNaN(actualEndedAt.getTime()) || actualEndedAt.getTime() > Date.now()) {
      throw new BadRequestException('Actual event end must be a valid timestamp that is not in the future');
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireEvent(eventId, tx);
      if (!['event_day', 'closure_archive', 'archived'].includes(current.status)) {
        throw new BadRequestException('Actual event end can only be recorded during event day or closure');
      }
      const isChanged = !current.actualEndedAt || current.actualEndedAt.getTime() !== actualEndedAt.getTime();
      if (current.actualEndedAt && current.actualEndedAt.getTime() !== actualEndedAt.getTime() && !input.correctionReason?.trim()) {
        throw new BadRequestException('A correction reason is required when changing the recorded event end');
      }
      const event = await tx.opsEvent.update({
        where: { id: eventId, actualEndedAt: current.actualEndedAt },
        data: { actualEndedAt, actualEndedBy: actor.id },
      });
      await this.syncWrapUpAtActualEnd(tx, eventId, actualEndedAt, isChanged);
      const context = { prisma: tx, correlationId: `actual_end_${randomUUID()}` };
      if (!isChanged) return event;
      await writeAudit(this.auditWriter, eventId, actor.name, current.actualEndedAt ? 'Corrected actual event end' : 'Recorded actual event end', {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Events,
        affectedType: 'event',
        affectedId: eventId,
        metadata: { actualEndedAt: actualEndedAt.toISOString(), actualEndedBy: actor.id, correctionReason: input.correctionReason?.trim() ?? null },
      }, context);
      return event;
    }, { isolationLevel: 'Serializable' });
  }

  async getWrapUp(eventId: string, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'event wrap-up', eventId);
    const event = await this.requireEvent(eventId);
    if (!event.actualEndedAt) return null;
    const record = await this.prisma.opsEventWrapUp.findUnique({ where: { eventId } });
    return record;
  }

  async startWrapUp(eventId: string, input: StartEventWrapUpInput = { mode: 'full' }, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'start event wrap-up', eventId);
    return this.prisma.$transaction(async (tx) => {
      const event = await this.requireEvent(eventId, tx);
      if (!event.actualEndedAt) throw new BadRequestException('Record the actual event end before starting wrap-up');
      if (event.archived) throw new BadRequestException('Archived event wrap-up is read-only');
      const existing = await tx.opsEventWrapUp.findUnique({ where: { eventId } });
      if (existing) return existing;
      const record = await this.createWrapUpRecord(eventId, event.actualEndedAt, input.mode ?? 'full', tx);
      await writeAudit(this.auditWriter, eventId, actor.name, 'Started event wrap-up', {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update,
        category: AuditCategory.Events, affectedType: 'event_wrap_up', affectedId: record.id,
        metadata: { mode: record.mode, activatedAt: record.activatedAt.toISOString(), deadlineAt: record.deadlineAt.toISOString() },
      }, { prisma: tx, correlationId: `wrap-up-start:${eventId}` });
      return record;
    }, { isolationLevel: 'Serializable' });
  }

  async updateWrapUp(eventId: string, input: UpdateEventWrapUpInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'update event wrap-up', eventId);
    return this.prisma.$transaction(async (tx) => {
      const event = await this.requireEvent(eventId, tx);
      if (event.archived) throw new BadRequestException('Archived event wrap-up is read-only');
      if (!event.actualEndedAt) throw new BadRequestException('Record the actual event end before updating wrap-up');
      const existing = await tx.opsEventWrapUp.findUnique({ where: { eventId } }) ??
        await this.createWrapUpRecord(eventId, event.actualEndedAt, input.mode ?? 'full', tx);
      const { sections, requiredItems, complete, acknowledged, now } = prepareWrapUpUpdate(existing, input);
      const updated = await tx.opsEventWrapUp.update({
        where: { eventId },
        data: {
          mode: input.mode ?? existing.mode,
          requiredItems: toPrismaJson(requiredItems), sections: toPrismaJson(sections),
          clientAcknowledgedAt: input.clientAcknowledged ? now : existing.clientAcknowledgedAt,
          acknowledgementRecordedBy: input.clientAcknowledged ? actor.id : existing.acknowledgementRecordedBy,
          acknowledgementSource: input.clientAcknowledged ? 'pmcm_recorded' : existing.acknowledgementSource,
          clientAcknowledgementNote: input.clientAcknowledgementNote ?? existing.clientAcknowledgementNote,
          status: complete ? 'complete' : 'pending',
          completedAt: complete ? (existing.completedAt ?? now) : null,
          completedBy: complete ? (existing.completedBy ?? actor.id) : null,
        },
      });
      await writeAudit(this.auditWriter, eventId, actor.name, 'Updated event wrap-up', {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update,
        category: AuditCategory.Events, affectedType: 'event_wrap_up', affectedId: updated.id,
        metadata: { status: updated.status, requiredItems, sections, clientAcknowledged: acknowledged },
      }, { prisma: tx, correlationId: `wrap-up-update:${updated.id}:${updated.updatedAt.toISOString()}` });
      return updated;
    }, { isolationLevel: 'Serializable' });
  }

  async runWrapUpReminderSweep(now = new Date()) {
    const events = await this.prisma.opsEvent.findMany({
      where: {
        actualEndedAt: { not: null }, archived: false,
        wrapUpRecords: { some: { status: 'pending', deadlineAt: { gte: now }, OR: [{ twelveHourReminderAt: null }, { twentyFourHourReminderAt: null }] } },
      },
      select: { id: true, clientName: true, actualEndedAt: true, inquiry: { select: { email: true } }, wrapUpRecords: { take: 1 } },
      take: 100,
    });
    const reminders: Array<{ eventId: string; hours: number }> = [];
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: the source query limits this sweep to 100 events.
    for (const event of events) {
      if (!event.actualEndedAt) continue;
      const record = await this.prisma.$transaction(async (tx) => {
        const current = await tx.opsEventWrapUp.findUnique({ where: { eventId: event.id } });
        if (!current) return null;
        if (current.status === 'complete') return current;
        // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: WRAP_UP_REMINDER_HOURS is the fixed two-entry schedule.
        for (const hours of WRAP_UP_REMINDER_HOURS) {
          const due = now.getTime() >= event.actualEndedAt!.getTime() + hours * 60 * 60 * 1000;
          const sentAt = hours === 12 ? current.twelveHourReminderAt : current.twentyFourHourReminderAt;
          if (!due || sentAt) continue;
          const update = hours === 12 ? { twelveHourReminderAt: now } : { twentyFourHourReminderAt: now };
          const claimed = await tx.opsEventWrapUp.updateMany({ where: { eventId: event.id, ...(hours === 12 ? { twelveHourReminderAt: null } : { twentyFourHourReminderAt: null }) }, data: update });
          if (claimed.count !== 1) continue;
          await this.queueWrapUpReminder(event.id, event.inquiry?.email, hours, tx);
          await writeAudit(this.auditWriter, event.id, 'System', `Sent ${hours}-hour wrap-up reminder`, { actorRole: OpsUserRole.System, actionType: AuditActionType.Update, category: AuditCategory.Events, affectedType: 'event_wrap_up', affectedId: current.id, metadata: { hours, dueAt: new Date(event.actualEndedAt!.getTime() + hours * 60 * 60 * 1000).toISOString() } }, { prisma: tx, correlationId: `wrap-up-reminder:${event.id}:${hours}` });
          reminders.push({ eventId: event.id, hours });
        }
        return current;
      }, { isolationLevel: 'Serializable' });
      void record;
    }
    return { reminders };
  }

  async archiveEvent(eventId: string, input: ArchiveEventInput = {}) {
    const actor = this.eventAccessPolicyService.resolveActor(input);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'event archive', eventId);
    const actorName = actor.name;
    const overrideReason = input.overrideReason?.trim();

    return this.prisma.$transaction(async (tx) => {
      const context = { prisma: tx, correlationId: `archive_${randomUUID()}` };
      // QUERY_AUDIT_RAW_SQL: File confirmation also locks the event before binding provider bytes. This
      // makes archive and a final storage confirmation serialize on the same row.
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM event_lifecycle.events WHERE id = ${eventId} FOR UPDATE`;
      const current = await this.requireEvent(eventId, tx);
      const closeGates = await this.fileRequirementsMatrixService.closeGates(eventId, tx);
      this.eventLifecycleService.assertCanArchive(current, closeGates, overrideReason);
      const event = await tx.opsEvent.update({
        where: { id: eventId, archived: false, status: current.status },
        data: {
          archived: true, archivedAt: new Date(),
          archiveOverrideReason: overrideReason || null,
          archiveOverrideBy: overrideReason ? actorName : null,
          archiveChecklist: toPrismaJson(closeGates), status: 'archived', readiness: 'Closed',
        },
      });
      await writeAudit(this.auditWriter, eventId, actorName, overrideReason ? 'Archived event with override' : 'Archived event', {
        actorRole: actor.role, actorEmail: actor.email,
        actionType: AuditActionType.Archive, category: AuditCategory.Events,
        affectedType: 'event', affectedId: eventId,
        severity: overrideReason ? 'warning' : 'info',
        metadata: { overrideReason, missingKeys: closeGates.missingKeys, gates: closeGates.gates },
      }, context);
      const clientEmail = (await tx.opsInquiry.findUnique({ where: { id: event.inquiryId }, select: { email: true } }))?.email?.trim();
      if (clientEmail) {
        await writeNotification(this.notificationOutboxWriter, eventId, clientEmail, 'Event workspace archived', undefined, {}, context);
      } else {
        await writeAudit(this.auditWriter, eventId, actorName, 'Archive notification not queued: client has no verified email address', { actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Events, affectedType: 'event', affectedId: eventId, metadata: { reason: 'missing_verified_recipient' } }, context);
      }
      return event;
    }, { isolationLevel: 'Serializable' });
  }

  async completePostEventDocument(eventId: string, documentId: string, actor?: ResolvedEventOpsActor) {
    const resolvedActor = actor ?? this.eventAccessPolicyService.resolveActor({});
    await this.eventAccessPolicyService.requireActorRole(resolvedActor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'post-event deliverable completion', eventId);
    return this.prisma.$transaction(async (tx) => {
      const event = await this.requireEvent(eventId, tx);
      if (event.archived) throw new BadRequestException('Archived event deliverables are read-only');
      const document = await tx.opsPostEventDocument
          .update({
            where: { id: documentId, eventId },
            data: { status: 'submitted' },
          })
          .catch(() => {
            throw new NotFoundException('Post-event document not found');
          });
      await writeAudit(this.auditWriter, eventId, resolvedActor.name, `Completed ${document.title}`, {
        actorRole: resolvedActor.role, actorEmail: resolvedActor.email,
        affectedType: 'post_event_document', affectedId: document.id,
      }, {
        prisma: tx, correlationId: `deliverable_${randomUUID()}`,
      });
      return document;
    });
  }

  async listEventInsights(eventId: string, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'event insights',
      eventId,
    );
    await this.requireEvent(eventId);
    return this.prisma.opsEventInsight.findMany({
      where: { eventId },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async generateEventInsights(
    eventId: string,
    actor: ResolvedEventOpsActor,
    coordinatorFacts: PrismCoordinatorInsightFacts,
  ) {
    let event: OpsEvent | null = null;
    let insightContext: EventInsightContext | null = null;

    return this.workflowCommandService.execute<OpsEventInsight>({
      name: 'generate_event_insights',
      eventId,
      validatePermission: () =>
        this.eventAccessPolicyService.requireActorRole(
          actor,
          [OpsUserRole.PmcmAdmin, OpsUserRole.System],
          'event insights',
          eventId,
        ),
      validateState: async () => {
        event = await this.requireEvent(eventId);
        insightContext = await this.buildEventInsightContext(eventId, event, coordinatorFacts);
      },
      write: () => {
        if (!event || !insightContext) throw new NotFoundException('Event not found');
        return this.prisma.opsEventInsight.upsert({
          where: { eventId },
          create: {
            id: `ins_${randomUUID()}`,
            eventId,
            summary: insightContext.summary,
            highlights: toPrismaJson(insightContext.highlights),
            risks: toPrismaJson(insightContext.risks),
            supplierNotes: toPrismaJson(insightContext.supplierNotes),
            financialSummary: toPrismaJson(insightContext.financialSummary),
            documentSummary: toPrismaJson(insightContext.documentSummary),
            feedbackSummary: toPrismaJson(insightContext.feedbackSummary),
            dimensions: toPrismaJson(insightContext.dimensions),
            privateNotes: 'PMCM-only deterministic insight generated from closed event records.',
          },
          update: {
            summary: insightContext.summary,
            highlights: toPrismaJson(insightContext.highlights),
            risks: toPrismaJson(insightContext.risks),
            supplierNotes: toPrismaJson(insightContext.supplierNotes),
            financialSummary: toPrismaJson(insightContext.financialSummary),
            documentSummary: toPrismaJson(insightContext.documentSummary),
            feedbackSummary: toPrismaJson(insightContext.feedbackSummary),
            dimensions: toPrismaJson(insightContext.dimensions),
            privateNotes: 'PMCM-only deterministic insight generated from closed event records.',
            generatedAt: new Date(),
          },
        });
      },
      sideEffects: async (insight) => {
        if (!event || !insightContext) return;
        await writeAudit(this.auditWriter, eventId, actor.name, 'Generated Event Insights', {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Create,
          category: AuditCategory.Events,
          affectedType: 'event_insight',
          affectedId: insight.id,
          affectedLabel: event.eventName,
          metadata: {
            totalBilled: insightContext.financialSummary.totalBilled,
            supplierReviewCount: insightContext.feedbackSummary.supplierReviews,
            openComplianceCount: insightContext.risks.length,
          },
        });
      },
    });
  }

  async searchArchive(filters: ArchiveSearchFilters, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'event archive search',
    );
    const events = await this.prisma.opsEvent.findMany({
      where: { archived: true },
      include: {
        inquiry: true,
        briefings: { orderBy: { submittedAt: 'desc' }, take: 1 },
      },
      orderBy: { eventDate: 'desc' },
    });
    return events
      .map(mapArchivedEventSearchHit)
      .filter((hit) => archivedEventMatchesSearch(hit, filters));
  }

  async getLogisticsCompletion(eventId: string, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'logistics completion', eventId);
    await this.requireEvent(eventId);
    const record = await this.prisma.opsLogisticsCompletion.findUnique({ where: { eventId } });
    return record ? mapLogisticsCompletion(record) : null;
  }

  async recordLogisticsCompletion(eventId: string, input: RecordLogisticsCompletionInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'logistics completion', eventId);
    return this.prisma.$transaction(async (tx) => {
      const event = await this.requireEvent(eventId, tx);
      if (event.archived) throw new BadRequestException('Archived event logistics are read-only');
      const existing = await tx.opsLogisticsCompletion.findUnique({ where: { eventId } });
      if (existing && !input.correctionReason) {
        throw new BadRequestException('A correction reason is required to replace the recorded logistics completion');
      }
      const now = new Date();
      const data = {
        assetReturnsVerified: input.assetReturnsVerified,
        completionSummary: input.completionSummary,
        privateNotes: input.privateNotes,
        correctionReason: input.correctionReason ?? null,
        recordedBy: actor.id,
        recordedAt: now,
      };
      const record = existing
        ? await tx.opsLogisticsCompletion.update({ where: { eventId }, data: { ...data, revision: { increment: 1 } } })
        : await tx.opsLogisticsCompletion.create({ data: { id: `logi_${randomUUID()}`, eventId, ...data } });
      // Audit metadata deliberately omits completionSummary and privateNotes.
      await writeAudit(this.auditWriter, eventId, actor.name, existing ? 'Corrected logistics completion' : 'Recorded logistics completion', {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update,
        category: AuditCategory.Events, affectedType: 'logistics_completion', affectedId: record.id,
        metadata: { revision: record.revision, correctionReason: input.correctionReason ?? null, assetReturnsVerified: record.assetReturnsVerified },
      }, { prisma: tx, correlationId: `logistics-completion:${record.id}:${record.revision}` });
      return mapLogisticsCompletion(record);
    }, { isolationLevel: 'Serializable' });
  }

  async compareArchivedEvents(query: ArchiveComparisonQuery, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'event archive comparison');
    const events = await this.prisma.opsEvent.findMany({
      where: { id: { in: query.eventIds }, archived: true },
      include: {
        inquiry: true,
        briefings: { orderBy: { submittedAt: 'desc' }, take: 1 },
        logisticsCompletion: true,
      },
    });
    const byId = new Map(events.map((event) => [event.id, event]));
    // Columns keep the requested order; any id that is not an archived event fails the whole comparison.
    return query.eventIds.map((id) => {
      const event = byId.get(id);
      if (!event) throw new NotFoundException('One or more archived events were not found');
      return mapArchiveComparisonRow(event);
    });
  }

  private async requireEvent(eventId: string, prisma: Prisma.TransactionClient = this.prisma) {
    const event = await prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private createWrapUpRecord(eventId: string, actualEndedAt: Date, mode: string, prisma: Prisma.TransactionClient | PrismaService) {
    return prisma.opsEventWrapUp.create({ data: {
      id: `wrap_${randomUUID()}`, eventId, mode, status: 'pending', activatedAt: actualEndedAt,
      deadlineAt: new Date(actualEndedAt.getTime() + WRAP_UP_HOURS * 60 * 60 * 1000),
      requiredItems: toPrismaJson(defaultRequiredItems()), sections: toPrismaJson(defaultWrapUpSections()),
    } });
  }

  private queueWrapUpReminder(eventId: string, email: string | null | undefined, hours: number, tx: Prisma.TransactionClient) {
    const recipient = email?.trim();
    return recipient
      ? writeNotification(this.notificationOutboxWriter, eventId, recipient, `Event wrap-up remains open after ${hours} hours.`, 'email', { idempotencyKey: `wrap-up-reminder:${eventId}:${hours}` }, { prisma: tx, correlationId: `wrap-up-reminder:${eventId}:${hours}` })
      : writeAudit(this.auditWriter, eventId, 'System', 'Wrap-up reminder not queued: client has no verified email address', { actorRole: OpsUserRole.System, actionType: AuditActionType.Update, category: AuditCategory.Events, affectedType: 'event_wrap_up', affectedId: eventId, metadata: { hours, reason: 'missing_verified_recipient' } }, { prisma: tx, correlationId: `wrap-up-reminder-unroutable:${eventId}:${hours}` });
  }

  private syncWrapUpAtActualEnd(
    prisma: Prisma.TransactionClient,
    eventId: string,
    actualEndedAt: Date,
    isChanged: boolean,
  ) {
    return prisma.opsEventWrapUp.upsert({
      where: { eventId },
      create: {
        id: `wrap_${randomUUID()}`, eventId, mode: 'full', status: 'pending',
        activatedAt: actualEndedAt,
        deadlineAt: new Date(actualEndedAt.getTime() + WRAP_UP_HOURS * 60 * 60 * 1000),
        requiredItems: toPrismaJson(defaultRequiredItems()), sections: toPrismaJson(defaultWrapUpSections()),
      },
      update: isChanged ? {
        activatedAt: actualEndedAt,
        deadlineAt: new Date(actualEndedAt.getTime() + WRAP_UP_HOURS * 60 * 60 * 1000),
        twelveHourReminderAt: null,
        twentyFourHourReminderAt: null,
      } : {},
    }).then(() => undefined);
  }

  private async buildEventInsightContext(
    eventId: string,
    event: OpsEvent,
    coordinatorFacts: PrismCoordinatorInsightFacts,
  ): Promise<EventInsightContext> {
    const [commercialFacts, lifecycleFacts, complianceChecks, documents, postEventDocuments, logisticsCompletion] = await Promise.all([
      this.commercialFactsReader.getLifecycleFacts(eventId),
      this.lifecycleFactsReader.getClosureFacts(eventId),
      this.prisma.opsComplianceCheck.findMany({ where: { eventId } }),
      this.prisma.opsDocument.findMany({ where: { eventId } }),
      this.prisma.opsPostEventDocument.findMany({ where: { eventId } }),
      this.prisma.opsLogisticsCompletion.findUnique({ where: { eventId }, select: { id: true, assetReturnsVerified: true } }),
    ]);
    const { supplierReviews, billingStatements, paymentMilestones } = commercialFacts;
    const { guestFeedback, issues, scheduleDays } = lifecycleFacts;

    const totalBilled = billingStatements.reduce((sum, statement) => sum + statement.totalAmount, 0);
    const amountPaid = paymentMilestones.reduce((sum, milestone) => sum + milestone.amountPaid, 0);
    const outstandingAmount = paymentMilestones.reduce((sum, milestone) => sum + milestone.remainingBalance, 0);
    const openChecks = complianceChecks.filter((check) => check.status === 'open');
    const submittedDocuments = documents.filter((document) =>
      ['submitted', 'approved', 'generated', 'sent'].includes(document.status),
    );
    const feedbackDocuments = postEventDocuments.filter((document) =>
      document.title.toLowerCase().includes('feedback') && document.status === 'submitted',
    );
    const approvedGuestFeedback = guestFeedback.filter((item) =>
      item.moderationStatus === 'approved' && item.privacyConsentAccepted && !item.privacyConsentWithdrawnAt,
    );
    const averageGuestRating = approvedGuestFeedback.length > 0
      ? Number((approvedGuestFeedback.reduce((sum, item) => sum + item.rating, 0) / approvedGuestFeedback.length).toFixed(2))
      : null;
    const segments = scheduleDays.flatMap((day) => day.segments);
    const lateSegments = segments.filter((segment) => segment.actualEndedAt && segment.actualEndedAt.getTime() > segment.plannedEndAt.getTime());
    const dimensions = buildInsightDimensions({ billingStatements, outstandingAmount, documents, postEventDocuments, submittedDocuments, supplierReviews, guestFeedback, feedbackDocuments, approvedGuestFeedback, complianceChecks, openChecks, logisticsCompletion, issues, segments, lateSegments, coordinatorFacts });

    return {
      summary: `Event Insights for ${event.eventName}: ${supplierReviews.length} supplier review(s), ${openChecks.length} open compliance issue(s), ${totalBilled} total billed.`,
      highlights: [
        supplierReviews.length > 0 ? `${supplierReviews.length} supplier review(s) captured` : 'No supplier reviews captured',
        submittedDocuments.length > 0 ? `${submittedDocuments.length} submitted/generated document(s)` : 'No close documents submitted',
        outstandingAmount === 0 ? 'Payment schedule closed' : `${outstandingAmount} outstanding payment balance`,
      ],
      risks: openChecks.map((check) => ({
        title: check.title,
        severity: (check as OpsComplianceCheck & { severity?: string }).severity ?? 'must_fix',
        status: check.status,
      })),
      supplierNotes: supplierReviews.map((review) => ({
        supplierId: review.supplierId,
        rating: review.rating,
        notes: review.notes,
        reviewedBy: review.reviewedBy,
      })),
      financialSummary: {
        billingCount: billingStatements.length,
        totalBilled,
        amountPaid,
        outstandingAmount,
      },
      documentSummary: {
        total: documents.length,
        submitted: submittedDocuments.length,
        pendingPostEventDocuments: postEventDocuments.filter((document) => document.status !== 'submitted').length,
      },
      feedbackSummary: {
        feedbackDocuments: feedbackDocuments.length,
        supplierReviews: supplierReviews.length,
        clientFeedbackSubmitted: feedbackDocuments.length > 0,
        guestFeedback: guestFeedback.length,
        approvedGuestFeedback: approvedGuestFeedback.length,
        averageGuestRating,
      },
      dimensions,
    };
  }
}

type EventInsightContext = {
  summary: string;
  highlights: string[];
  risks: Array<{ title: string; severity: string; status: string }>;
  supplierNotes: Array<{ supplierId: string; rating: number; notes: string; reviewedBy: string }>;
  financialSummary: {
    billingCount: number;
    totalBilled: number;
    amountPaid: number;
    outstandingAmount: number;
  };
  documentSummary: {
    total: number;
    submitted: number;
    pendingPostEventDocuments: number;
  };
  feedbackSummary: {
    feedbackDocuments: number;
    supplierReviews: number;
    clientFeedbackSubmitted: boolean;
    guestFeedback?: number;
    approvedGuestFeedback?: number;
    averageGuestRating?: number | null;
  };
  dimensions: Record<string, { status: 'evidence' | 'pending' | 'blocked'; summary: string; evidence: string[] }>;
};

type InsightDimension = { status: 'evidence' | 'pending' | 'blocked'; summary: string; evidence: string[] };

export function buildInsightDimensions(input: {
  billingStatements: Array<{ id: string }>;
  outstandingAmount: number;
  documents: Array<{ id: string }>;
  postEventDocuments: Array<{ id: string }>;
  submittedDocuments: Array<{ id: string }>;
  supplierReviews: Array<{ id: string }>;
  guestFeedback: Array<{ id: string }>;
  feedbackDocuments: Array<{ id: string }>;
  approvedGuestFeedback: Array<{ id: string }>;
  complianceChecks: Array<{ id: string }>;
  openChecks: Array<unknown>;
  logisticsCompletion: { id: string; assetReturnsVerified: boolean } | null;
  issues: Array<{ id: string }>;
  segments: Array<{ id: string }>;
  lateSegments: Array<{ id: string }>;
  coordinatorFacts: PrismCoordinatorInsightFacts;
}): Record<string, InsightDimension> {
  const logisticsRecorded = input.logisticsCompletion?.assetReturnsVerified === true;
  const coordinatorFacts = input.coordinatorFacts;
  const coordinatorEvidence = [
    `assignments:${coordinatorFacts.assignments}`,
    `awaiting-acknowledgement:${coordinatorFacts.awaitingAcknowledgement}`,
    `late-attendance:${coordinatorFacts.lateAttendance}`,
    `absent-attendance:${coordinatorFacts.absentAttendance}`,
    `replaced:${coordinatorFacts.replacedAssignments}`,
    `cancelled:${coordinatorFacts.cancelledAssignments}`,
    `reliability-notes:${coordinatorFacts.reliabilityNotes}`,
  ];
  return {
    finance: dimension(input.billingStatements.length > 0, `${input.billingStatements.length} billing statement(s), ${input.outstandingAmount} outstanding`, input.billingStatements.map(item => item.id)),
    documents: dimension(input.documents.length + input.postEventDocuments.length > 0, `${input.submittedDocuments.length} submitted document(s)`, [...input.documents, ...input.postEventDocuments].map(item => item.id)),
    suppliers: dimension(input.supplierReviews.length > 0, `${input.supplierReviews.length} supplier review(s) captured`, input.supplierReviews.map(item => item.id)),
    feedback: dimension(input.guestFeedback.length > 0 || input.feedbackDocuments.length > 0, `${input.approvedGuestFeedback.length} approved guest feedback item(s); ${input.feedbackDocuments.length} client feedback document(s)`, input.guestFeedback.map(item => item.id)),
    compliance: dimension(input.complianceChecks.length > 0, `${input.openChecks.length} open compliance check(s)`, input.complianceChecks.map(item => item.id)),
    logistics: logisticsRecorded
      ? { status: 'evidence', summary: 'Logistics completion recorded by PMCM; asset returns verified', evidence: input.logisticsCompletion ? [input.logisticsCompletion.id] : [] }
      : { status: 'blocked', summary: 'No authoritative logistics completion record', evidence: [] },
    issues: dimension(input.issues.length > 0, `${input.issues.length} unresolved urgent issue(s)`, input.issues.map(item => item.id)),
    schedule: dimension(input.segments.length > 0, `${input.lateSegments.length} schedule segment(s) ended late`, input.lateSegments.map(item => item.id)),
    coordinators: dimension(
      coordinatorFacts.assignments > 0 || coordinatorFacts.reliabilityNotes > 0,
      `${coordinatorFacts.assignments} assignment(s); ${coordinatorFacts.awaitingAcknowledgement} awaiting acknowledgement; ${coordinatorFacts.lateAttendance} late; ${coordinatorFacts.absentAttendance} absent; ${coordinatorFacts.replacedAssignments} replaced; ${coordinatorFacts.cancelledAssignments} cancelled or released; ${coordinatorFacts.reliabilityNotes} reliability note(s)`,
      coordinatorEvidence,
    ),
  };
}

function dimension(hasEvidence: boolean, summary: string, evidence: string[]): InsightDimension {
  return { status: hasEvidence ? 'evidence' : 'pending', summary, evidence };
}

function prepareWrapUpUpdate(existing: {
  sections: unknown;
  requiredItems: unknown;
  clientAcknowledgedAt: Date | null;
}, input: UpdateEventWrapUpInput) {
  const now = new Date();
  const sections = normalizeWrapUpSections({ ...defaultWrapUpSections(), ...(existing.sections as object ?? {}), ...(input.sections ?? {}) }, now);
  const requiredItems = { ...defaultRequiredItems(), ...(existing.requiredItems as object ?? {}), ...(input.requiredItems ?? {}) };
  const allRequired = Object.values(requiredItems).every(Boolean);
  const allSections = Object.values(sections).every((section) => (section as { status?: string }).status === 'complete');
  const acknowledged = input.clientAcknowledged === true || Boolean(existing.clientAcknowledgedAt);
  return { sections, requiredItems, acknowledged, complete: allRequired && allSections && acknowledged, now };
}

function normalizeWrapUpSections(rawSections: object, now: Date) {
  const sections = rawSections as Record<string, { status?: string; evidence?: string; completedAt?: string | null }>;
  return Object.fromEntries(Object.entries(sections).map(([key, section]) => [key, {
    ...section,
    completedAt: section.status === 'complete' ? section.completedAt ?? now.toISOString() : null,
  }]));
}
