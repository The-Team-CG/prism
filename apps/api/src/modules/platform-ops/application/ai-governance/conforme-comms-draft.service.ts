import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OpsAiApprovalRecord, OpsAiAuditLog } from '@prisma/client';
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

const DRAFT_FEATURE = 'FR-AI-09';
type DraftPayload = {
  requestId: string;
  inquiryId: string;
  reminderWindowBaseAt: string;
  decisionReminderAt?: string;
  source: 'ai' | 'manual';
  draft: CommsDraftResult;
  evidence?: AiAuditEvidence;
};
type DraftApproval = Pick<OpsAiApprovalRecord,
  'id' | 'aiAuditLogId' | 'featureName' | 'status' | 'requestedAt' | 'approvedBy' | 'approvedAt' | 'sourceDispatchId'>;
type DraftAudit = Pick<OpsAiAuditLog,
  'id' | 'featureName' | 'modelVersion' | 'sanitizedPayload' | 'status' | 'humanApproved' | 'createdAt'>;
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
    for (const approval of approvals) {
      const audit = await this.prisma.opsAiAuditLog.findUnique({ where: { id: approval.aiAuditLogId } });
      const payload = this.readPayload(audit, inquiryId);
      if (payload) return this.toReviewRecord(approval, audit!, payload, inquiry.lastConformeReminderAt);
    }
    return null;
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

    return this.streamAndPersist(input, inquiry, actor, signal);
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
    return this.toReviewRecord(saved.approval, saved.audit, payload, inquiry.lastConformeReminderAt);
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
    const payload = this.readPayload(audit, undefined);
    if (!payload || !approval.sourceDispatchId || this.draftKeyForPayload(payload) !== approval.sourceDispatchId) {
      throw new BadRequestException('A matching saved conforme draft is required');
    }
    const inquiry = await this.requireEligibleInquiry(payload.inquiryId);
    if (payload.reminderWindowBaseAt !== inquiry.reminderWindowBaseAt) {
      throw new ConflictException('The reminder window changed; refresh and create a new draft');
    }

    return this.prisma.$transaction(async (tx) => {
      const currentApproval = await tx.opsAiApprovalRecord.findUnique({ where: { id: draftId } });
      if (!currentApproval || currentApproval.featureName !== DRAFT_FEATURE) throw new NotFoundException('Conforme draft not found');
      if (currentApproval.status !== 'pending_human_approval') {
        throw new ConflictException('Only a pending conforme draft can be approved');
      }
      const currentAudit = await tx.opsAiAuditLog.findUnique({ where: { id: currentApproval.aiAuditLogId } });
      const currentPayload = this.readPayload(currentAudit, payload.inquiryId);
      if (!currentPayload || !currentApproval.sourceDispatchId || this.draftKeyForPayload(currentPayload) !== currentApproval.sourceDispatchId) {
        throw new BadRequestException('A matching saved conforme draft is required');
      }
      if (currentPayload.reminderWindowBaseAt !== inquiry.reminderWindowBaseAt) {
        throw new ConflictException('The reminder window changed; refresh and create a new draft');
      }

      const now = new Date();
      const updatedPayload: DraftPayload = { ...currentPayload, draft: editedDraft, decisionReminderAt: now.toISOString() };
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
        where: { id: currentAudit!.id, status: 'pending_human_approval' },
        data: {
          sanitizedPayload: toPrismaJson(updatedPayload),
          status: 'approved',
          humanApproved: true,
        },
      });
      if (updatedAudit.count !== 1) throw new ConflictException('Conforme draft audit is no longer pending');

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
      const savedAudit = await tx.opsAiAuditLog.findUniqueOrThrow({ where: { id: currentAudit!.id } });
      return this.toReviewRecord(savedApproval, savedAudit, updatedPayload, claimedWindow.lastConformeReminderAt);
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
      const audit = await tx.opsAiAuditLog.findUnique({ where: { id: approval.aiAuditLogId } });
      const payload = this.readPayload(audit, undefined);
      if (!payload || !approval.sourceDispatchId || this.draftKeyForPayload(payload) !== approval.sourceDispatchId) {
        throw new BadRequestException('A matching saved conforme draft is required');
      }
      const now = new Date();
      const claimed = await tx.opsAiApprovalRecord.updateMany({
        where: { id: draftId, status: 'pending_human_approval' },
        data: { status: 'rejected', humanApproved: false, approvedBy: actor.name, approvedAt: now },
      });
      if (claimed.count !== 1) throw new ConflictException('Conforme draft was already reviewed');
      const audited = await tx.opsAiAuditLog.updateMany({
        where: { id: audit!.id, status: 'pending_human_approval' },
        data: { status: 'rejected', humanApproved: false },
      });
      if (audited.count !== 1) throw new ConflictException('Conforme draft audit is no longer pending');
      const savedApproval = await tx.opsAiApprovalRecord.findUniqueOrThrow({ where: { id: draftId } });
      const savedAudit = await tx.opsAiAuditLog.findUniqueOrThrow({ where: { id: audit!.id } });
      return this.toReviewRecord(savedApproval, savedAudit, payload, null);
    });
  }

  private async *streamAndPersist(
    input: CommsDraftRequest,
    inquiry: EligibleInquiry,
    actor: ResolvedEventOpsActor,
    signal?: AbortSignal,
  ): AsyncIterable<AiGatewayStreamEvent<CommsDraftResult>> {
    const stream = this.aiGateway.stream('comms.draft', input, {
      correlationId: this.draftKey(inquiry),
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
          evidence,
        };
        const saved = await this.persistPendingDraft({
          sourceDispatchId: this.draftKey(inquiry),
          payload,
          actor,
          createdAt: new Date(),
          evidence,
        });
        yield { ...event, result: { ...event.result, output: this.readPayload(saved.audit, inquiry.inquiryId)!.draft } };
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
            dataCategories: toPrismaJson(input.evidence?.dataClasses ?? []),
            sanitizedPayload: toPrismaJson(input.payload),
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
        return { approval, audit };
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

  private draftKeyForPayload(payload: DraftPayload) {
    return `conforme-follow-up:${payload.inquiryId}:${Date.parse(payload.reminderWindowBaseAt)}:draft`;
  }

  private readPayload(audit: DraftAudit | null, expectedInquiryId?: string): DraftPayload | null {
    if (!audit || audit.featureName !== DRAFT_FEATURE) return null;
    const payload = parseDraftPayload(audit.sanitizedPayload);
    if (!payload || (expectedInquiryId && payload.inquiryId !== expectedInquiryId)) return null;
    return payload;
  }

  private toReviewRecord(
    approval: DraftApproval,
    audit: DraftAudit,
    payload: DraftPayload,
    lastConformeReminderAt: string | null,
  ) {
    return {
      draftId: approval.id,
      inquiryId: payload.inquiryId,
      draft: payload.draft,
      status: approval.status,
      source: payload.source,
      requestedAt: approval.requestedAt.toISOString(),
      reviewedBy: approval.approvedBy,
      reviewedAt: approval.approvedAt?.toISOString() ?? null,
      lastConformeReminderAt: payload.decisionReminderAt ?? lastConformeReminderAt,
      reminderWindowBaseAt: payload.reminderWindowBaseAt,
      requestId: payload.requestId,
      modelVersion: audit.modelVersion,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}

function parseDraftPayload(value: unknown): DraftPayload | null {
  if (!isRecord(value)) return null;
  const allowedKeys = new Set(['requestId', 'inquiryId', 'reminderWindowBaseAt', 'decisionReminderAt', 'source', 'draft', 'evidence']);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return null;
  if (typeof value.requestId !== 'string' || !value.requestId.trim()) return null;
  if (typeof value.inquiryId !== 'string' || !value.inquiryId.trim()) return null;
  if (typeof value.reminderWindowBaseAt !== 'string' || !isUtcDateTime(value.reminderWindowBaseAt)) return null;
  if (value.decisionReminderAt !== undefined && (typeof value.decisionReminderAt !== 'string' || !isUtcDateTime(value.decisionReminderAt))) return null;
  if (value.source !== 'ai' && value.source !== 'manual') return null;

  const draft = commsDraftResultSchema.safeParse(value.draft);
  if (!draft.success) return null;

  let evidence: AiAuditEvidence | undefined;
  if (value.evidence !== undefined) {
    const parsedEvidence = aiAuditEvidenceSchema.safeParse(value.evidence);
    if (!parsedEvidence.success) return null;
    evidence = parsedEvidence.data;
  }

  return {
    requestId: value.requestId.trim(),
    inquiryId: value.inquiryId.trim(),
    reminderWindowBaseAt: value.reminderWindowBaseAt,
    ...(typeof value.decisionReminderAt === 'string' ? { decisionReminderAt: value.decisionReminderAt } : {}),
    source: value.source,
    draft: draft.data,
    ...(evidence ? { evidence } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUtcDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return false;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return false;
  const normalized = value.replace(/\.(\d{1,3})\d*Z$/, (_, fraction: string) => `.${fraction.padEnd(3, '0')}Z`);
  return parsed.toISOString() === (normalized.includes('.') ? normalized : normalized.replace(/Z$/, '.000Z'));
}
