import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsComplianceCheck, OpsEvent, OpsEventInsight, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { toPrismaJson } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, EventLifecycleService, OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import type { ArchiveSearchFilters, RecordActualEventEndInput } from '@prism/types';
import { EventAccessPolicyService, type EventOpsActorInput, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { FileRequirementsMatrixService } from '../files/file-requirements-matrix.service';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { archivedEventMatchesSearch } from '../../domain/archive-search.policy';
import { mapArchivedEventSearchHit } from './closure.mappers';

export type ArchiveEventInput = EventOpsActorInput & {
  overrideReason?: string;
  actorName?: string;
};

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
      if (current.actualEndedAt && current.actualEndedAt.getTime() !== actualEndedAt.getTime() && !input.correctionReason?.trim()) {
        throw new BadRequestException('A correction reason is required when changing the recorded event end');
      }
      const event = await tx.opsEvent.update({
        where: { id: eventId, actualEndedAt: current.actualEndedAt },
        data: { actualEndedAt, actualEndedBy: actor.id },
      });
      const context = { prisma: tx, correlationId: `actual_end_${randomUUID()}` };
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

  private async buildEventInsightContext(eventId: string, event: OpsEvent): Promise<EventInsightContext> {
    const [supplierReviews, complianceChecks, billingStatements, paymentMilestones, documents, postEventDocuments] =
      await Promise.all([
        this.prisma.opsSupplierReview.findMany({ where: { eventId } }),
        this.prisma.opsComplianceCheck.findMany({ where: { eventId } }),
        this.prisma.opsBillingStatement.findMany({ where: { eventId } }),
        this.prisma.opsPaymentMilestone.findMany({ where: { eventId } }),
        this.prisma.opsDocument.findMany({ where: { eventId } }),
        this.prisma.opsPostEventDocument.findMany({ where: { eventId } }),
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
      },
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
  };
};
