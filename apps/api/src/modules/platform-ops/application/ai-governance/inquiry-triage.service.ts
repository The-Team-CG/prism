import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import {
  inquiryTriageInputSchema,
  inquiryTriageResultSchema,
  type InquiryTriageInput,
  type InquiryTriageRequest,
  type InquiryTriageReview,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { randomUUID } from 'node:crypto';
import { AI_GATEWAY, type AiGateway } from '../../contracts/ai-governance/ai-gateway.port';
import {
  PLATFORM_REFERENCE_READ_MODEL,
  type AiInquiryTriageSource,
  type PlatformReferenceReadModel,
} from '@prism/contexts/read-models';
import { aiRunFailureToHttpException } from './ai-run-failure';

export const INQUIRY_TRIAGE_FEATURE = 'FR-AI-01';
export const INQUIRY_TRIAGE_KEY_PREFIX = 'inquiry-triage:';
const TRIAGE_FEATURE = INQUIRY_TRIAGE_FEATURE;
const TRIAGE_KEY_PREFIX = INQUIRY_TRIAGE_KEY_PREFIX;
const MESSAGE_LIMIT = 4_000;
const REFERRAL_LIMIT = 1_000;
const MS_PER_DAY = 86_400_000;

/** The model sees the inquiry's shape and wording, never the applicant's name, email, phone or company. */
export function buildInquiryTriageInput(source: AiInquiryTriageSource, now: Date): InquiryTriageInput {
  return inquiryTriageInputSchema.parse({
    inquiryId: source.id,
    eventType: source.eventType,
    clientType: source.clientType,
    eventDate: source.eventDate.toISOString().slice(0, 10),
    daysUntilEvent: Math.ceil((source.eventDate.getTime() - now.getTime()) / MS_PER_DAY),
    hasOrganization: source.hasOrganization,
    source: source.source,
    referralDetails: source.referralDetails.slice(0, REFERRAL_LIMIT),
    message: source.message.slice(0, MESSAGE_LIMIT),
    duplicateInquiryCount: source.duplicateInquiryCount,
    previouslyDeclined: source.previouslyDeclined,
  });
}

/**
 * PMCM-only advice on a new inquiry (FR-AI-01). The result is stored as an advisory record linked to
 * the gateway audit row. It changes nothing: accepting, pending and declining stay human decisions.
 */
@Injectable()
export class InquiryTriageService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_GATEWAY) private readonly aiGateway: AiGateway,
    private readonly access: EventAccessPolicyService,
    @Inject(PLATFORM_REFERENCE_READ_MODEL) private readonly references: PlatformReferenceReadModel,
  ) {}

  async latest(inquiryId: string, verifiedActor: PrismVerifiedEventActor): Promise<InquiryTriageReview | null> {
    await this.requirePmcm(verifiedActor);
    const record = await this.prisma.opsAiApprovalRecord.findFirst({
      where: { featureName: TRIAGE_FEATURE, sourceDispatchId: { startsWith: `${TRIAGE_KEY_PREFIX}${inquiryId}:` } },
      orderBy: { requestedAt: 'desc' },
      include: { auditLog: { select: { requestId: true, modelVersion: true } } },
    });
    if (!record) return null;
    const payload = (record.reviewPayload ?? {}) as { result?: unknown };
    const result = inquiryTriageResultSchema.safeParse(payload.result);
    if (!result.success || !record.auditLog.requestId) return null;
    return {
      reviewId: record.id,
      inquiryId,
      result: result.data,
      requestedAt: record.requestedAt.toISOString(),
      requestedBy: record.requestedBy,
      requestId: record.auditLog.requestId,
      modelVersion: record.auditLog.modelVersion,
    };
  }

  async run(
    request: InquiryTriageRequest,
    verifiedActor: PrismVerifiedEventActor,
    signal?: AbortSignal,
  ): Promise<InquiryTriageReview> {
    const actor = await this.requirePmcm(verifiedActor);
    const source = await this.references.findInquiryTriageSource(request.inquiryId);
    if (!source) throw new NotFoundException('Inquiry not found');

    const requestedAt = new Date();
    const result = await this.aiGateway.run('inquiry.triage', buildInquiryTriageInput(source, requestedAt), { signal });
    if (result.outcome !== 'completed') throw aiRunFailureToHttpException(result);

    const { evidence } = result;
    const output = inquiryTriageResultSchema.parse(result.output);
    const reviewId = `aia_${randomUUID()}`;
    await this.prisma.opsAiApprovalRecord.create({
      data: {
        id: reviewId,
        aiAuditLogId: `aia_${evidence.requestId}`,
        featureName: TRIAGE_FEATURE,
        requestedBy: actor.name,
        humanApproved: false,
        status: 'advisory',
        requestedAt,
        sourceDispatchId: `${TRIAGE_KEY_PREFIX}${request.inquiryId}:${evidence.requestId}`,
        reviewPayload: toPrismaJson({ inquiryId: request.inquiryId, result: output }),
      },
    });
    return {
      reviewId,
      inquiryId: request.inquiryId,
      result: output,
      requestedAt: requestedAt.toISOString(),
      requestedBy: actor.name,
      requestId: evidence.requestId,
      modelVersion: evidence.responseModel ?? evidence.requestedModel,
    };
  }

  private async requirePmcm(verifiedActor: PrismVerifiedEventActor) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'inquiry triage');
    return actor;
  }
}
