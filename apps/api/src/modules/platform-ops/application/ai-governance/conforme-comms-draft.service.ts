import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OpsAiApprovalRecord, OpsAiAuditLog, OpsConformeCommsDraft } from '@prisma/client';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import {
  CONFORME_REMINDER_WINDOW_CLAIMER,
  type ConformeReminderWindowClaimer,
  type EligibleConformeReminderInquiry,
} from '@prism/contexts/event-lifecycle/conforme-reminder-window';
import {
  writeNotification,
  type NotificationOutboxWriter,
} from '../../contracts/notifications/notification-outbox-writer.port';
import { NOTIFICATION_OUTBOX_WRITER } from '../../contracts/notifications/notification-ops.tokens';
import { AI_GATEWAY, type AiGateway } from '../../contracts/ai-governance/ai-gateway.port';
import {
  aiAuditEvidenceSchema,
  commsDraftResultSchema,
  type AiAuditEvidence,
  type AiGatewayStreamEvent,
  type CommsDraftRequest,
  type CommsDraftResult,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { randomUUID } from 'node:crypto';
import { SYNTHETIC_COMMS_REQUEST_FIXTURE } from './gateway/synthetic-fixture-registry';

const DRAFT_FEATURE = 'FR-AI-09';
type DraftPayload = {
  requestId: string;
  inquiryId: string;
  reminderWindowBaseAt: string;
  source: 'ai' | 'manual';
  draft: CommsDraftResult;
};
type DraftApproval = Pick<OpsAiApprovalRecord,
  'id' | 'aiAuditLogId' | 'featureName' | 'status' | 'requestedAt' | 'approvedBy' | 'approvedAt' | 'sourceDispatchId'>;
type DraftAudit = Pick<OpsAiAuditLog,
  'id' | 'featureName' | 'modelVersion' | 'status' | 'humanApproved' | 'createdAt'>;
type SavedDraft = Pick<OpsConformeCommsDraft,
  'id' | 'inquiryId' | 'reminderWindowBaseAt' | 'decisionReminderAt' | 'requestId' | 'source' | 'subject' | 'body'>;
type EligibleInquiry = EligibleConformeReminderInquiry;

@Injectable()
export class ConformeCommsDraftService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_GATEWAY) private readonly aiGateway: AiGateway,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(CONFORME_REMINDER_WINDOW_CLAIMER)
    private readonly conformeReminderWindowClaimer: ConformeReminderWindowClaimer,
  ) {}

  async loadForInquiry(inquiryId: string, verifiedActor: PrismVerifiedEventActor) {
    await this.requirePmcm(verifiedActor);
    const inquiry = await this.conformeReminderWindowClaimer.getInquiry(inquiryId);
    if (!inquiry) throw new NotFoundException('Inquiry not found');

    const prefix = `conforme-follow-up:${inquiryId}:`;
    const approvals = await this.prisma.opsAiApprovalRecord.findMany({
      where: { featureName: DRAFT_FEATURE, sourceDispatchId: { startsWith: prefix } },
      orderBy: { requestedAt: 'desc' },
      take: 20,
    });
    if (!approvals.length) return null;
    const [audits, drafts] = await Promise.all([
      this.prisma.opsAiAuditLog.findMany({ where: { id: { in: approvals.map((approval) => approval.aiAuditLogId) } } }),
      this.prisma.opsConformeCommsDraft.findMany({
        where: { id: { in: approvals.map((approval) => approval.id) }, inquiryId },
      }),
    ]);
    const auditsById = new Map(audits.map((audit) => [audit.id, audit]));
    const draftsById = new Map(drafts.map((draft) => [draft.id, draft]));
    const reviews = approvals.map((approval) => {
      const audit = auditsById.get(approval.aiAuditLogId);
      const draft = draftsById.get(approval.id) ?? null;
      if (audit?.featureName === DRAFT_FEATURE && this.isUsableDraft(draft) && draft.inquiryId === inquiryId) {
        return this.toReviewRecord(approval, audit, draft, inquiry.lastConformeReminderAt);
      }
      return null;
    });
    return reviews.find((review) => review !== null) ?? null;
  }

  async prepareStream(
    input: CommsDraftRequest,
    verifiedActor: PrismVerifiedEventActor,
    signal?: AbortSignal,
  ): Promise<AsyncIterable<AiGatewayStreamEvent<CommsDraftResult>>> {
    const actor = await this.requirePmcm(verifiedActor);
    const inquiry = await this.requireEligibleInquiry(input.inquiryId);
    const sourceDispatchId = this.draftKey(inquiry);
    const existing = await this.prisma.opsAiApprovalRecord.findUnique({ where: { sourceDispatchId } });
    if (existing) throw new ConflictException('A draft already exists for this reminder window');

    return this.streamAndPersist(inquiry, actor, signal);
  }

  async saveManual(
    inquiryId: string,
    draftInput: CommsDraftResult,
    verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requirePmcm(verifiedActor);
    const draft = commsDraftResultSchema.parse(draftInput);
    const inquiry = await this.requireEligibleInquiry(inquiryId);
    const sourceDispatchId = this.draftKey(inquiry);
    const now = new Date();
    const payload: DraftPayload = {
      requestId: randomUUID(),
      inquiryId,
      reminderWindowBaseAt: inquiry.reminderWindowBaseAt,
      source: 'manual',
      draft,
    };
    const saved = await this.persistPendingDraft({
      sourceDispatchId,
      payload,
      actor,
      createdAt: now,
      evidence: undefined,
    });
    return this.toReviewRecord(saved.approval, saved.audit, saved.draft, inquiry.lastConformeReminderAt);
  }

  async approve(draftId: string, draftInput: CommsDraftResult, verifiedActor: PrismVerifiedEventActor) {
    const actor = await this.requirePmcm(verifiedActor);
    const editedDraft = commsDraftResultSchema.parse(draftInput);
    const approval = await this.prisma.opsAiApprovalRecord.findUnique({ where: { id: draftId } });
    if (!approval || approval.featureName !== DRAFT_FEATURE) throw new NotFoundException('Conforme draft not found');
    if (approval.status !== 'pending_human_approval') {
      throw new ConflictException('Only a pending conforme draft can be approved');
    }
    const audit = await this.prisma.opsAiAuditLog.findUnique({ where: { id: approval.aiAuditLogId } });
    const { draft } = this.requireMatchingDraft(approval, audit,
      await this.prisma.opsConformeCommsDraft.findUnique({ where: { id: draftId } }));
    const inquiry = await this.requireEligibleInquiry(draft.inquiryId);
    if (draft.reminderWindowBaseAt !== inquiry.reminderWindowBaseAt) {
      throw new ConflictException('The reminder window changed; refresh and create a new draft');
    }

    return this.prisma.$transaction(async (tx) => {
      const currentApproval = await tx.opsAiApprovalRecord.findUnique({ where: { id: draftId } });
      if (!currentApproval || currentApproval.featureName !== DRAFT_FEATURE) throw new NotFoundException('Conforme draft not found');
      if (currentApproval.status !== 'pending_human_approval') {
        throw new ConflictException('Only a pending conforme draft can be approved');
      }
      const currentAuditRow = await tx.opsAiAuditLog.findUnique({ where: { id: currentApproval.aiAuditLogId } });
      const { draft: currentDraft, audit: currentAudit } = this.requireMatchingDraft(currentApproval, currentAuditRow,
        await tx.opsConformeCommsDraft.findUnique({ where: { id: draftId } }));
      if (currentDraft.inquiryId !== inquiry.inquiryId || currentDraft.reminderWindowBaseAt !== inquiry.reminderWindowBaseAt) {
        throw new ConflictException('The reminder window changed; refresh and create a new draft');
      }

      const now = new Date();
      const claimedApproval = await tx.opsAiApprovalRecord.updateMany({
        where: { id: draftId, status: 'pending_human_approval' },
        data: {
          status: 'approved',
          humanApproved: true,
          approvedBy: actor.name,
          approvedAt: now,
        },
      });
      if (claimedApproval.count !== 1) throw new ConflictException('Conforme draft was already reviewed');
      const updatedAudit = await tx.opsAiAuditLog.updateMany({
        where: { id: currentAudit.id, status: 'pending_human_approval' },
        data: {
          dataCategories: toPrismaJson(['personal']),
          status: 'approved',
          humanApproved: true,
        },
      });
      if (updatedAudit.count !== 1) throw new ConflictException('Conforme draft audit is no longer pending');
      const savedDraft = await tx.opsConformeCommsDraft.update({
        where: { id: draftId },
        data: { subject: editedDraft.subject, body: editedDraft.body, decisionReminderAt: now.toISOString() },
      });

      const reminderMessage = `${editedDraft.subject}\n\n${editedDraft.body}`;
      const claimedWindow = await this.conformeReminderWindowClaimer.claim({
        inquiryId: inquiry.inquiryId,
        expectedConformeSentAt: inquiry.conformeSentAt,
        expectedLastConformeReminderAt: inquiry.lastConformeReminderAt,
        now,
      }, { prisma: tx, correlationId: this.draftKey(inquiry) });
      const notificationContext: PrismTransactionContext = { prisma: tx, correlationId: claimedWindow.windowKey };
      await writeNotification(
        this.notificationOutboxWriter,
        undefined,
        claimedWindow.recipient,
        reminderMessage,
        'email',
        { correlationId: claimedWindow.windowKey, idempotencyKey: `${claimedWindow.windowKey}:email` },
        notificationContext,
      );
      const savedApproval = await tx.opsAiApprovalRecord.findUniqueOrThrow({ where: { id: draftId } });
      const savedAudit = await tx.opsAiAuditLog.findUniqueOrThrow({ where: { id: currentAudit.id } });
      return this.toReviewRecord(savedApproval, savedAudit, savedDraft, claimedWindow.lastConformeReminderAt);
    });
  }

  async cancel(draftId: string, verifiedActor: PrismVerifiedEventActor) {
    const actor = await this.requirePmcm(verifiedActor);
    return this.prisma.$transaction(async (tx) => {
      const approval = await tx.opsAiApprovalRecord.findUnique({ where: { id: draftId } });
      if (!approval || approval.featureName !== DRAFT_FEATURE) throw new NotFoundException('Conforme draft not found');
      if (approval.status !== 'pending_human_approval') {
        throw new ConflictException('Only a pending conforme draft can be cancelled');
      }
      const auditRow = await tx.opsAiAuditLog.findUnique({ where: { id: approval.aiAuditLogId } });
      const { draft, audit } = this.requireMatchingDraft(approval, auditRow,
        await tx.opsConformeCommsDraft.findUnique({ where: { id: draftId } }));
      const now = new Date();
      const claimed = await tx.opsAiApprovalRecord.updateMany({
        where: { id: draftId, status: 'pending_human_approval' },
        data: { status: 'rejected', humanApproved: false, approvedBy: actor.name, approvedAt: now },
      });
      if (claimed.count !== 1) throw new ConflictException('Conforme draft was already reviewed');
      const audited = await tx.opsAiAuditLog.updateMany({
        where: { id: audit.id, status: 'pending_human_approval' },
        data: { status: 'rejected', humanApproved: false },
      });
      if (audited.count !== 1) throw new ConflictException('Conforme draft audit is no longer pending');
      const savedApproval = await tx.opsAiApprovalRecord.findUniqueOrThrow({ where: { id: draftId } });
      const savedAudit = await tx.opsAiAuditLog.findUniqueOrThrow({ where: { id: audit.id } });
      return this.toReviewRecord(savedApproval, savedAudit, draft, null);
    });
  }

  private async *streamAndPersist(
    inquiry: EligibleInquiry,
    actor: ResolvedEventOpsActor,
    signal?: AbortSignal,
  ): AsyncIterable<AiGatewayStreamEvent<CommsDraftResult>> {
    // Inquiry identity stays inside PRISM; the provider sees a registered generic fixture.
    const stream = this.aiGateway.stream('comms.draft', SYNTHETIC_COMMS_REQUEST_FIXTURE, {
      signal,
    });
    for await (const event of stream) {
      if (event.type === 'complete') {
        if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('Draft generation cancelled');
        const currentInquiry = await this.requireEligibleInquiry(inquiry.inquiryId);
        if (currentInquiry.reminderWindowBaseAt !== inquiry.reminderWindowBaseAt) {
          throw new ConflictException('The reminder window changed while the draft was generating');
        }
        const draft = commsDraftResultSchema.parse(event.result.output);
        const evidence = aiAuditEvidenceSchema.parse(event.result.evidence);
        if (evidence.useCaseId !== 'comms.draft') throw new BadRequestException('Gateway returned evidence for a different use case');
        const payload: DraftPayload = {
          requestId: evidence.requestId,
          inquiryId: inquiry.inquiryId,
          reminderWindowBaseAt: inquiry.reminderWindowBaseAt,
          source: 'ai',
          draft,
        };
        const saved = await this.persistPendingDraft({
          sourceDispatchId: this.draftKey(inquiry),
          payload,
          actor,
          createdAt: new Date(),
          evidence,
        });
        yield { ...event, result: { ...event.result, output: { subject: saved.draft.subject, body: saved.draft.body } } };
      } else {
        yield event;
      }
    }
  }

  private async persistPendingDraft(input: {
    sourceDispatchId: string;
    payload: DraftPayload;
    actor: ResolvedEventOpsActor;
    createdAt: Date;
    evidence?: AiAuditEvidence;
  }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.opsAiApprovalRecord.findUnique({ where: { sourceDispatchId: input.sourceDispatchId } });
        if (existing) throw new ConflictException('A draft already exists for this reminder window');
        const auditId = `ai_${randomUUID()}`;
        const approvalId = `aia_${randomUUID()}`;
        const audit = await tx.opsAiAuditLog.create({
          data: {
            id: auditId,
            featureName: DRAFT_FEATURE,
            modelVersion: input.evidence?.responseModel ?? input.evidence?.requestedModel ?? 'manual',
            dataCategories: toPrismaJson(input.evidence?.dataClasses ?? ['personal']),
            sanitizedPayload: toPrismaJson({ source: input.payload.source, draftRecordId: approvalId }),
            zdrConfirmed: input.evidence?.zdrBasis === 'provider-enforced',
            humanApprovalRequired: true,
            status: 'pending_human_approval',
            createdAt: input.createdAt,
          },
        });
        const approval = await tx.opsAiApprovalRecord.create({
          data: {
            id: approvalId,
            aiAuditLogId: auditId,
            featureName: DRAFT_FEATURE,
            requestedBy: input.actor.name,
            humanApproved: false,
            status: 'pending_human_approval',
            requestedAt: input.createdAt,
            sourceDispatchId: input.sourceDispatchId,
          },
        });
        const draft = await tx.opsConformeCommsDraft.create({
          data: {
            id: approvalId,
            inquiryId: input.payload.inquiryId,
            reminderWindowBaseAt: input.payload.reminderWindowBaseAt,
            requestId: input.payload.requestId,
            source: input.payload.source,
            subject: input.payload.draft.subject,
            body: input.payload.draft.body,
            createdAt: input.createdAt,
          },
        });
        return { approval, audit, draft };
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('A draft already exists for this reminder window');
      }
      throw error;
    }
  }

  private requireEligibleInquiry(inquiryId: string): Promise<EligibleInquiry> {
    return this.conformeReminderWindowClaimer.requireEligible(inquiryId);
  }

  private async requirePmcm(verifiedActor: PrismVerifiedEventActor): Promise<ResolvedEventOpsActor> {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'conforme communication drafts');
    return actor;
  }

  private draftKey(inquiry: EligibleInquiry) {
    return `conforme-follow-up:${inquiry.inquiryId}:${Date.parse(inquiry.reminderWindowBaseAt)}:draft`;
  }

  private draftKeyForRecord(draft: SavedDraft) {
    return `conforme-follow-up:${draft.inquiryId}:${Date.parse(draft.reminderWindowBaseAt)}:draft`;
  }

  private isUsableDraft(draft: SavedDraft | null): draft is SavedDraft {
    return Boolean(draft && isCanonicalUtc(draft.reminderWindowBaseAt) &&
      (!draft.decisionReminderAt || isCanonicalUtc(draft.decisionReminderAt)) &&
      (draft.source === 'ai' || draft.source === 'manual') &&
      draft.requestId.trim() && draft.inquiryId.trim() &&
      commsDraftResultSchema.safeParse({ subject: draft.subject, body: draft.body }).success);
  }

  private requireMatchingDraft(approval: DraftApproval, audit: DraftAudit | null, draft: SavedDraft | null): {
    audit: DraftAudit;
    draft: SavedDraft;
  } {
    if (audit?.featureName !== DRAFT_FEATURE || !this.isUsableDraft(draft) || !approval.sourceDispatchId ||
      this.draftKeyForRecord(draft) !== approval.sourceDispatchId) {
      throw new BadRequestException('A matching saved conforme draft is required');
    }
    return { audit, draft };
  }

  private toReviewRecord(
    approval: DraftApproval,
    audit: DraftAudit,
    draft: SavedDraft,
    lastConformeReminderAt: string | null,
  ) {
    return {
      draftId: approval.id,
      inquiryId: draft.inquiryId,
      draft: { subject: draft.subject, body: draft.body },
      status: approval.status,
      source: draft.source,
      requestedAt: approval.requestedAt.toISOString(),
      reviewedBy: approval.approvedBy,
      reviewedAt: approval.approvedAt?.toISOString() ?? null,
      lastConformeReminderAt: draft.decisionReminderAt ?? lastConformeReminderAt,
      reminderWindowBaseAt: draft.reminderWindowBaseAt,
      requestId: draft.requestId,
      modelVersion: audit.modelVersion,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}

function isCanonicalUtc(value: string): boolean {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}
