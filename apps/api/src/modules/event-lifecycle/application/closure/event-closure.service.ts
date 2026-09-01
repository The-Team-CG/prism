import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsComplianceCheck, OpsEvent, OpsEventInsight, OpsPostEventDocument } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { toPrismaJson } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, EventLifecycleService, OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { EventAccessPolicyService, type EventOpsActorInput, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { FileRequirementsMatrixService } from '../files/file-requirements-matrix.service';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';

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

  async archiveEvent(eventId: string, input: ArchiveEventInput = {}) {
    const actor = this.eventAccessPolicyService.resolveActor(input);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'event archive', eventId);
    const actorName = input.actorName?.trim() || actor.name;
    let closeGates = await this.closeGates(eventId);
    const overrideReason = input.overrideReason?.trim();

    return this.workflowCommandService.execute<OpsEvent>({
      name: 'archive_event',
      eventId,
      validateState: async () => {
        const event = await this.requireEvent(eventId);
        this.eventLifecycleService.assertCanArchive(event, closeGates, overrideReason);
      },
      write: () =>
        this.prisma.opsEvent
          .update({
            where: { id: eventId },
            data: {
              archived: true,
              archivedAt: new Date(),
              archiveOverrideReason: overrideReason || null,
              archiveOverrideBy: overrideReason ? actorName : null,
              archiveChecklist: toPrismaJson(closeGates),
              status: 'archived',
              readiness: 'Closed',
            },
          })
          .catch(() => {
            throw new NotFoundException('Event not found');
          }),
      sideEffects: async (event) => {
        closeGates = await this.closeGates(eventId).catch(() => closeGates);
        await Promise.all([
          writeAudit(this.auditWriter, eventId, actorName, overrideReason ? 'Archived event with override' : 'Archived event', {
            actionType: AuditActionType.Archive,
            category: AuditCategory.Events,
            severity: overrideReason ? 'warning' : 'info',
            metadata: { overrideReason, missingKeys: closeGates.missingKeys, gates: closeGates.gates },
          }),
          writeNotification(this.notificationOutboxWriter, eventId, event.clientName, 'Event workspace archived'),
        ]);
      },
    });
  }

  async completePostEventDocument(eventId: string, documentId: string) {
    return this.workflowCommandService.execute<OpsPostEventDocument>({
      name: 'complete_post_event_document',
      eventId,
      validateState: async () => {
        await this.requireEvent(eventId);
      },
      write: () =>
        this.prisma.opsPostEventDocument
          .update({
            where: { id: documentId },
            data: { status: 'submitted' },
          })
          .catch(() => {
            throw new NotFoundException('Post-event document not found');
          }),
      sideEffects: async (document) => {
        await writeAudit(this.auditWriter, eventId, 'PMCM Admin', `Completed ${document.title}`);
      },
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

  private async requireEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
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
