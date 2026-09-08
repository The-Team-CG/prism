import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsComplianceCheck, OpsEvent, OpsEventInsight, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { toPrismaJson } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, EventLifecycleService, OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import type { ArchiveSearchFilters, RecordActualEventEndInput, StartEventWrapUpInput, UpdateEventWrapUpInput } from '@prism/types';
import { EventAccessPolicyService, type EventOpsActorInput, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { FileRequirementsMatrixService } from '../files/file-requirements-matrix.service';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { archivedEventMatchesSearch } from '../../domain/archive-search.policy';
import { mapArchivedEventSearchHit } from './closure.mappers';

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
          clientAcknowledgedBy: input.clientAcknowledged ? actor.id : existing.clientAcknowledgedBy,
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
      where: { actualEndedAt: { not: null }, archived: false },
      select: { id: true, clientName: true, actualEndedAt: true },
    });
    const reminders: Array<{ eventId: string; hours: number }> = [];
    for (const event of events) {
      if (!event.actualEndedAt) continue;
      const record = await this.prisma.$transaction(async (tx) => {
        const current = await tx.opsEventWrapUp.findUnique({ where: { eventId: event.id } }) ??
          await this.createWrapUpRecord(event.id, event.actualEndedAt!, 'full', tx);
        if (current.status === 'complete') return current;
        for (const hours of WRAP_UP_REMINDER_HOURS) {
          const due = now.getTime() >= event.actualEndedAt!.getTime() + hours * 60 * 60 * 1000;
          const sentAt = hours === 12 ? current.twelveHourReminderAt : current.twentyFourHourReminderAt;
          if (!due || sentAt) continue;
          const update = hours === 12 ? { twelveHourReminderAt: now } : { twentyFourHourReminderAt: now };
          const claimed = await tx.opsEventWrapUp.updateMany({ where: { eventId: event.id, ...(hours === 12 ? { twelveHourReminderAt: null } : { twentyFourHourReminderAt: null }) }, data: update });
          if (claimed.count !== 1) continue;
          await writeNotification(this.notificationOutboxWriter, event.id, event.clientName, `Event wrap-up remains open after ${hours} hours. Delivery remains queued until the W11 email/Viber provider is configured.`, 'email', { idempotencyKey: `wrap-up-reminder:${event.id}:${hours}` }, { prisma: tx, correlationId: `wrap-up-reminder:${event.id}:${hours}` });
          await writeAudit(this.auditWriter, event.id, 'System', `Sent ${hours}-hour wrap-up reminder`, { actorRole: OpsUserRole.System, actionType: AuditActionType.Update, category: AuditCategory.Events, affectedType: 'event_wrap_up', affectedId: current.id, metadata: { hours, dueAt: new Date(event.actualEndedAt!.getTime() + hours * 60 * 60 * 1000).toISOString() } }, { prisma: tx, correlationId: `wrap-up-reminder:${event.id}:${hours}` });
          reminders.push({ eventId: event.id, hours });
        }
        return current;
      }, { isolationLevel: 'Serializable' });
      void record;
    }
    return { reminders, archivedEvents: 0 };
  }

  async archiveEvent(eventId: string, input: ArchiveEventInput = {}) {
    const actor = this.eventAccessPolicyService.resolveActor(input);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'event archive', eventId);
    const actorName = actor.name;
    const overrideReason = input.overrideReason?.trim();

    return this.prisma.$transaction(async (tx) => {
      const context = { prisma: tx, correlationId: `archive_${randomUUID()}` };
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
      await writeNotification(this.notificationOutboxWriter, eventId, event.clientName, 'Event workspace archived', undefined, {}, context);
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

  async generateEventInsights(eventId: string, actor: ResolvedEventOpsActor) {
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
        insightContext = await this.buildEventInsightContext(eventId, event);
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

  private syncWrapUpAtActualEnd(
    prisma: Prisma.TransactionClient,
    eventId: string,
    actualEndedAt: Date,
    isChanged: boolean,
  ) {
    if (!prisma.opsEventWrapUp) return Promise.resolve();
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

  private async buildEventInsightContext(eventId: string, event: OpsEvent): Promise<EventInsightContext> {
    const [supplierReviews, complianceChecks, billingStatements, paymentMilestones, documents, postEventDocuments, guestFeedback, issues, scheduleDays, wrapUp] =
      await Promise.all([
        this.prisma.opsSupplierReview.findMany({ where: { eventId } }),
        this.prisma.opsComplianceCheck.findMany({ where: { eventId } }),
        this.prisma.opsBillingStatement.findMany({ where: { eventId } }),
        this.prisma.opsPaymentMilestone.findMany({ where: { eventId } }),
        this.prisma.opsDocument.findMany({ where: { eventId } }),
        this.prisma.opsPostEventDocument.findMany({ where: { eventId } }),
        this.prisma.opsGuestFeedback.findMany({ where: { eventId } }),
        this.prisma.opsUrgentIssue.findMany({ where: { eventId } }),
        this.prisma.opsEventScheduleDay?.findMany({ where: { eventId }, include: { segments: true } }) ?? Promise.resolve([]),
        this.prisma.opsEventWrapUp?.findUnique({ where: { eventId } }) ?? Promise.resolve(null),
      ]);

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
    const wrapSections = (wrapUp?.sections ?? {}) as Record<string, { status?: string; evidence?: string }>;
    const dimensions = buildInsightDimensions({ billingStatements, outstandingAmount, documents, postEventDocuments, submittedDocuments, supplierReviews, guestFeedback, feedbackDocuments, approvedGuestFeedback, complianceChecks, openChecks, wrapSections, issues, segments, lateSegments });

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
  wrapSections: Record<string, { status?: string; evidence?: string }>;
  issues: Array<{ id: string }>;
  segments: Array<{ id: string }>;
  lateSegments: Array<{ id: string }>;
}): Record<string, InsightDimension> {
  const section = input.wrapSections.logistics;
  return {
    finance: dimension(input.billingStatements.length > 0, `${input.billingStatements.length} billing statement(s), ${input.outstandingAmount} outstanding`, input.billingStatements.map(item => item.id)),
    documents: dimension(input.documents.length + input.postEventDocuments.length > 0, `${input.submittedDocuments.length} submitted document(s)`, [...input.documents, ...input.postEventDocuments].map(item => item.id)),
    suppliers: dimension(input.supplierReviews.length > 0, `${input.supplierReviews.length} supplier review(s) captured`, input.supplierReviews.map(item => item.id)),
    feedback: dimension(input.guestFeedback.length > 0 || input.feedbackDocuments.length > 0, `${input.approvedGuestFeedback.length} approved guest feedback item(s); ${input.feedbackDocuments.length} client feedback document(s)`, input.guestFeedback.map(item => item.id)),
    compliance: dimension(input.complianceChecks.length > 0, `${input.openChecks.length} open compliance check(s)`, input.complianceChecks.map(item => item.id)),
    logistics: { status: section?.status === 'complete' ? 'evidence' : 'blocked', summary: section?.evidence || 'No authoritative logistics completion record', evidence: section?.evidence ? [section.evidence] : [] },
    issues: dimension(input.issues.length > 0, `${input.issues.length} unresolved urgent issue(s)`, input.issues.map(item => item.id)),
    schedule: dimension(input.segments.length > 0, `${input.lateSegments.length} schedule segment(s) ended late`, input.lateSegments.map(item => item.id)),
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
