import { randomUUID } from 'node:crypto';
import type { OpsAiApprovalRecord, OpsAiAuditLog, Prisma } from '@prisma/client';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { assertPareExecutionAllowed, configuredPareMode, type PAREMode } from './pare-execution.policy';
import { DataSanitizerService } from './data-sanitizer.service';
import { EventContextAgent } from './agents/event-context.agent';
import { SupplierFinderAgent } from './agents/supplier-finder.agent';
import { BudgetAgent } from './agents/budget.agent';
import { RiskAgent } from './agents/risk.agent';
import { MessageDrafterAgent } from './agents/message-drafter.agent';
import type {
  PAREApprovalRecord,
  PAREApprovalStatus,
  PAREBudgetAnalysis,
  PARECandidate,
  PAREContext,
  PAREDrafts,
  PAREResult,
  PARERisk,
} from './pare.types';
import type { PareApprovalGovernance } from '../../../contracts/ai-governance/pare-approval-governance.port';

type ApprovalRow = {
  id: string;
  aiAuditLogId: string;
  featureName: string;
  eventId?: string | null;
  status: string;
  approvedBy?: string | null;
  approvedAt?: Date | string | null;
  requestedAt?: Date | string | null;
  sourceDispatchId?: string | null;
};
type AuditRow = {
  id: string;
  featureName?: string | null;
  eventId?: string | null;
  modelVersion?: string | null;
  sanitizedPayload?: unknown;
  createdAt?: Date | string | null;
};

function requireMatchingAudit<
  TRecord extends Pick<ApprovalRow, 'eventId' | 'featureName' | 'sourceDispatchId'>,
  TAudit extends Pick<AuditRow, 'eventId' | 'featureName'>,
>(record: TRecord, audit: (TAudit & Pick<AuditRow, 'sanitizedPayload'>) | null, expectedRequestId?: string, expectedSourceDispatchId?: string): TAudit & Pick<AuditRow, 'sanitizedPayload'> {
  const payload = audit?.sanitizedPayload !== undefined && audit.sanitizedPayload !== null && typeof audit.sanitizedPayload === 'object' && !Array.isArray(audit.sanitizedPayload)
    ? audit.sanitizedPayload as Record<string, unknown>
    : {};
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : typeof payload.triggerId === 'string' ? payload.triggerId : '';
  const payloadEventId = typeof payload.eventId === 'string' ? payload.eventId : '';
  if (
    !audit ||
    audit.featureName !== 'PARE' ||
    !record.eventId ||
    !audit.eventId ||
    audit.eventId !== record.eventId ||
    !requestId ||
    payloadEventId !== audit.eventId ||
    (expectedRequestId !== undefined && requestId !== expectedRequestId) ||
    (expectedSourceDispatchId !== undefined && record.sourceDispatchId !== expectedSourceDispatchId)
  ) {
    throw new BadRequestException('A matching durable PARE audit is required');
  }
  return audit;
}

function auditRequestId(audit: Pick<AuditRow, 'sanitizedPayload'>): string {
  const payload = audit.sanitizedPayload;
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return '';
  const data = payload as Record<string, unknown>;
  return typeof data.requestId === 'string' ? data.requestId : typeof data.triggerId === 'string' ? data.triggerId : '';
}

function isAbortSignal(value: unknown): value is AbortSignal {
  return Boolean(value && typeof value === 'object' && 'aborted' in value && 'addEventListener' in value);
}

@Injectable()
export class PAREService implements PareApprovalGovernance {
  private readonly mode: PAREMode;
  private readonly sanitizer: DataSanitizerService;
  private readonly eventContextAgent: EventContextAgent;
  private readonly supplierFinderAgent: SupplierFinderAgent;
  private readonly budgetAgent: BudgetAgent;
  private readonly riskAgent: RiskAgent;
  private readonly messageDrafterAgent: MessageDrafterAgent;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(AUDIT_WRITER) private readonly auditWriter?: AuditWriter,
  ) {
    this.mode = configuredPareMode(process.env.PARE_MODE);
    this.sanitizer = new DataSanitizerService();
    this.eventContextAgent = new EventContextAgent(prisma);
    this.supplierFinderAgent = new SupplierFinderAgent(prisma);
    this.budgetAgent = new BudgetAgent(this.mode);
    this.riskAgent = new RiskAgent(this.mode);
    this.messageDrafterAgent = new MessageDrafterAgent(this.mode);
  }

  async handleEmergencyTrigger(
    triggerId: string,
    sourceDispatchIdOrPrefetched?: string | NonNullable<Parameters<EventContextAgent['buildPareEventContext']>[1]>,
    prefetchedOrSignal?: NonNullable<Parameters<EventContextAgent['buildPareEventContext']>[1]> | AbortSignal,
    signal?: AbortSignal,
  ): Promise<PAREApprovalRecord> {
    const sourceDispatchId = typeof sourceDispatchIdOrPrefetched === 'string' ? sourceDispatchIdOrPrefetched : undefined;
    const executionSignal = isAbortSignal(prefetchedOrSignal) ? prefetchedOrSignal : signal;
    const preparedContext = typeof sourceDispatchIdOrPrefetched === 'object'
      ? sourceDispatchIdOrPrefetched
      : isAbortSignal(prefetchedOrSignal) ? undefined : prefetchedOrSignal;
    if (sourceDispatchId) {
      const existing = await this.prisma.opsAiApprovalRecord.findUnique({ where: { sourceDispatchId } });
      if (existing) return this.mapApprovalRecordWithAudit(existing, triggerId, sourceDispatchId);
    }
    assertPareExecutionAllowed(this.mode);
    this.throwIfAborted(executionSignal);
    const triggeredAt = new Date();

    // Agent 1 — event context
    const ctx: PAREContext = await this.eventContextAgent.buildPareEventContext(triggerId, preparedContext, Boolean(sourceDispatchId), executionSignal);

    // Agent 2 — find replacement candidates
    ctx.candidates = await this.supplierFinderAgent.findPareSupplierCandidates(ctx, executionSignal);

    // Agents 3 + 4 — run in parallel (independent of each other)
    const [budgetAnalysis, riskAssessment] = await Promise.all([
      this.budgetAgent.runPareBudgetAgent(ctx, executionSignal),
      this.riskAgent.runPareRiskAgent(ctx, executionSignal),
    ]);
    ctx.budgetAnalysis = budgetAnalysis;
    ctx.riskAssessment = riskAssessment;

    // Agent 5 — draft messages
    ctx.drafts = await this.messageDrafterAgent.runPareMessageDraftAgent(ctx, executionSignal);
    this.throwIfAborted(executionSignal);

    const pareResult: PAREResult = {
      requestId: ctx.triggerId,
      eventId: ctx.eventId,
      eventName: ctx.eventName,
      withdrawnSupplier: ctx.withdrawnSupplier,
      candidates: ctx.candidates ?? [],
      budgetAnalysis,
      riskAssessment,
      drafts: ctx.drafts,
      mode: this.mode,
      triggeredAt: triggeredAt.toISOString(),
    };

    // Log to OpsAiAuditLog (ZDR sanitized)
    const { data: sanitizedPayload, dataCategories } = this.sanitizer.sanitize(
      pareResult as unknown as Record<string, unknown>,
    );
    const aiAuditLogId = randomUUID();
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (sourceDispatchId) {
          const existing = await tx.opsAiApprovalRecord.findUnique({ where: { sourceDispatchId } });
          if (existing) return this.mapApprovalRecordWithTransactionAudit(tx, existing, triggerId, sourceDispatchId);
        }
        const audit = await tx.opsAiAuditLog.create({ data: {
          id: aiAuditLogId,
          eventId: ctx.eventId,
          featureName: 'PARE',
          modelVersion: 'mock',
          dataCategories: toPrismaJson(dataCategories),
          sanitizedPayload: toPrismaJson(sanitizedPayload),
          zdrConfirmed: true,
          humanApprovalRequired: true,
          status: 'pending_human_approval',
          createdAt: triggeredAt,
        } });

        const approval = await tx.opsAiApprovalRecord.create({ data: {
          id: randomUUID(),
          aiAuditLogId,
          eventId: ctx.eventId,
          featureName: 'PARE',
          requestedBy: 'PARE Engine',
          status: 'pending_human_approval',
          requestedAt: triggeredAt,
          sourceDispatchId: sourceDispatchId ?? null,
        } });

        return this.mapApprovalRecord(approval, audit);
      });
    } catch (error) {
      if (sourceDispatchId) {
        const existing = await this.prisma.opsAiApprovalRecord.findUnique({ where: { sourceDispatchId } });
        if (existing) return this.mapApprovalRecordWithAudit(existing, triggerId, sourceDispatchId);
      }
      throw error;
    }
  }

  async recordDispatchActivity(
    dispatch: { id: string; eventId: string; requestId: string },
    approval: PAREApprovalRecord,
  ): Promise<void> {
    if (!this.auditWriter) return;
    const existing = await this.prisma.opsAuditLog.findFirst({
      where: {
        eventId: dispatch.eventId,
        actionType: 'pare_triggered',
        affectedType: 'supplier_quote_request',
        affectedId: dispatch.requestId,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return;
    const candidate = approval.pareResult.budgetAnalysis.selectedCandidate;
    const label = candidate.supplierName
      ? `Recommended: ${candidate.supplierName} (${approval.pareResult.mode} mode)`
      : 'PARE engine completed';
    await writeAudit(
      this.auditWriter,
      dispatch.eventId,
      'PARE Engine',
      `PARE triggered for ${approval.pareResult.withdrawnSupplier.name} - ${label}`,
      {
        actorRole: OpsUserRole.System,
        actionType: 'pare_triggered',
        category: AuditCategory.Suppliers,
        affectedType: 'supplier_quote_request',
        affectedId: dispatch.requestId,
        affectedLabel: approval.pareResult.withdrawnSupplier.name,
        metadata: { dispatchId: dispatch.id, approvalRecordId: approval.id, mode: approval.pareResult.mode },
      },
    );
  }

  async getPendingApprovals(eventId?: string): Promise<PAREApprovalRecord[]> {
    const where: Record<string, unknown> = {
      featureName: 'PARE',
      status: 'pending_human_approval',
    };
    if (eventId) where['eventId'] = eventId;

    const approvals = await this.prisma.opsAiApprovalRecord.findMany({
        where,
        take: 100,
        orderBy: { requestedAt: 'desc' },
    });
    return Promise.all(approvals.map((record: ApprovalRow) => this.mapApprovalRecordWithAudit(record)));
  }

  async approveRecommendation(approvalRecordId: string, approvedBy: string): Promise<PAREApprovalRecord> {
    assertPareExecutionAllowed(this.mode);
    return this.reviewRecommendation(approvalRecordId, approvedBy, 'approved');
  }

  async rejectRecommendation(approvalRecordId: string, rejectedBy: string): Promise<PAREApprovalRecord> {
    return this.reviewRecommendation(approvalRecordId, rejectedBy, 'rejected');
  }

  private async reviewRecommendation(id: string, reviewedBy: string, status: 'approved' | 'rejected') {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.opsAiApprovalRecord.findUnique({ where: { id } });
      if (!record || record.featureName !== 'PARE') throw new NotFoundException('PARE recommendation not found');
      if (record.status !== 'pending_human_approval') throw new BadRequestException('Only pending PARE recommendations can be reviewed');
      const audit = requireMatchingAudit(record, await tx.opsAiAuditLog.findUnique({ where: { id: record.aiAuditLogId } }));
      await this.assertDispatchMatches(tx, record, audit);
      if (status === 'approved') this.assertMockAudit(audit);
      const data = { status, humanApproved: status === 'approved', approvedBy: reviewedBy, approvedAt: new Date() };
      const claimed = await tx.opsAiApprovalRecord.updateMany({
        where: { id, status: 'pending_human_approval' }, data,
      });
      if (claimed.count !== 1) throw new ConflictException('PARE recommendation was already reviewed');
      const audited = await tx.opsAiAuditLog.updateMany({
        where: { id: audit.id, status: 'pending_human_approval' },
        data: { status, humanApproved: data.humanApproved },
      });
      if (audited.count !== 1) throw new ConflictException('PARE audit is no longer pending');
      return this.mapApprovalRecord({ ...record, ...data }, audit);
    });
  }

  private assertMockAudit(audit: OpsAiAuditLog) {
    const payload = this.asRecord(audit.sanitizedPayload);
    const verifiedMock = audit.modelVersion === 'mock' && payload.mode === 'mock' && audit.zdrConfirmed;
    assertPareExecutionAllowed(verifiedMock ? 'mock' : 'live');
  }

  private async mapApprovalRecordWithAudit(record: ApprovalRow, expectedRequestId?: string, expectedSourceDispatchId?: string): Promise<PAREApprovalRecord> {
    const audit = await this.findAuditLog(record.aiAuditLogId);
    const matchingAudit = requireMatchingAudit(record, audit, expectedRequestId, expectedSourceDispatchId);
    await this.assertDispatchMatches(this.prisma, record, matchingAudit);
    return this.mapApprovalRecord(record, matchingAudit);
  }

  private async mapApprovalRecordWithTransactionAudit(
    tx: Prisma.TransactionClient,
    record: ApprovalRow,
    expectedRequestId?: string,
    expectedSourceDispatchId?: string,
  ): Promise<PAREApprovalRecord> {
    const audit = await tx.opsAiAuditLog.findUnique({ where: { id: record.aiAuditLogId } });
    const matchingAudit = requireMatchingAudit(record, audit, expectedRequestId, expectedSourceDispatchId);
    await this.assertDispatchMatches(tx, record, matchingAudit);
    return this.mapApprovalRecord(record, matchingAudit);
  }

  private async assertDispatchMatches(
    prisma: { opsPareDispatch: { findUnique(args: { where: { id: string } }): Promise<{ requestId: string; eventId: string } | null> } },
    record: ApprovalRow,
    audit: Pick<AuditRow, 'sanitizedPayload'>,
  ) {
    if (!record.sourceDispatchId) return;
    const dispatch = await prisma.opsPareDispatch.findUnique({ where: { id: record.sourceDispatchId } });
    if (!dispatch || dispatch.requestId !== auditRequestId(audit) || dispatch.eventId !== record.eventId) {
      throw new BadRequestException('A matching durable PARE audit is required');
    }
  }

  private throwIfAborted(signal?: AbortSignal) {
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('PARE execution aborted');
  }

  private async findAuditLog(aiAuditLogId: string): Promise<AuditRow | null> {
    if (!aiAuditLogId) return null;
    return this.prisma.opsAiAuditLog.findUnique({ where: { id: aiAuditLogId } });
  }

  private mapApprovalRecord(record: ApprovalRow, audit: AuditRow | null): PAREApprovalRecord {
    const pareResult = this.mapPareResult(audit?.sanitizedPayload, record, audit);
    return {
      id: record.id,
      eventId: pareResult.eventId,
      requestId: pareResult.requestId,
      status: this.mapApprovalStatus(record.status),
      pareResult,
      reviewedBy: record.approvedBy ?? null,
      reviewedAt: record.approvedAt ? this.toIso(record.approvedAt) : null,
      createdAt: this.toIso(record.requestedAt ?? audit?.createdAt ?? new Date()),
    };
  }

  private mapPareResult(payload: unknown, record: ApprovalRow, audit: AuditRow | null): PAREResult {
    const data = this.asRecord(payload);
    const withdrawnSupplier = this.asRecord(data.withdrawnSupplier);
    const fallbackCandidate = this.fallbackCandidate('No candidate found', 'No PARE candidate payload was stored.');
    const fallbackBudget = this.fallbackBudgetAnalysis(fallbackCandidate);
    const fallbackRisk: PARERisk = {
      level: 'HIGH',
      factors: ['PARE analysis payload was unavailable.'],
      recommendation: 'Review the supplier replacement manually.',
    };
    const fallbackDrafts: PAREDrafts = {
      supplierNotification: '',
      clientReassurance: '',
    };

    return {
      requestId: this.asString(data.requestId ?? data.triggerId),
      eventId: this.asString(data.eventId ?? record.eventId ?? audit?.eventId),
      eventName: this.asString(data.eventName),
      withdrawnSupplier: {
        id: this.asString(withdrawnSupplier.id),
        name: this.asString(withdrawnSupplier.name),
        category: this.asString(withdrawnSupplier.category),
        tier: this.asString(withdrawnSupplier.tier),
        quotedAmount: this.asNumber(withdrawnSupplier.quotedAmount),
      },
      candidates: this.asArray<PARECandidate>(data.candidates),
      budgetAnalysis: this.asBudgetAnalysis(data.budgetAnalysis, fallbackBudget),
      riskAssessment: this.asRiskAssessment(data.riskAssessment, fallbackRisk),
      drafts: this.asDrafts(data.drafts, fallbackDrafts),
      mode: data.mode === 'live' || audit?.modelVersion === 'claude-sonnet-4-6' ? 'live' : 'mock',
      triggeredAt: this.asString(data.triggeredAt) || this.toIso(record.requestedAt ?? audit?.createdAt ?? new Date()),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private asArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? value as T[] : [];
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private asNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private asBudgetAnalysis(value: unknown, fallback: PAREBudgetAnalysis): PAREBudgetAnalysis {
    const data = this.asRecord(value);
    const selectedCandidate = this.asRecord(data.selectedCandidate);
    return {
      feasible: typeof data.feasible === 'boolean' ? data.feasible : fallback.feasible,
      selectedCandidate: {
        supplierId: this.asString(selectedCandidate.supplierId) || fallback.selectedCandidate.supplierId,
        supplierName: this.asString(selectedCandidate.supplierName) || fallback.selectedCandidate.supplierName,
        tier: this.asString(selectedCandidate.tier) || fallback.selectedCandidate.tier,
        quotedAmount: this.asNumber(selectedCandidate.quotedAmount),
        reliabilityScore: this.asNumber(selectedCandidate.reliabilityScore),
        halal: typeof selectedCandidate.halal === 'boolean' ? selectedCandidate.halal : fallback.selectedCandidate.halal,
        priorPmcmEvents: this.asNumber(selectedCandidate.priorPmcmEvents),
        reason: this.asString(selectedCandidate.reason) || fallback.selectedCandidate.reason,
      },
      costDelta: this.asNumber(data.costDelta),
      costDeltaLabel: this.asString(data.costDeltaLabel) || fallback.costDeltaLabel,
      summary: this.asString(data.summary) || fallback.summary,
    };
  }

  private asRiskAssessment(value: unknown, fallback: PARERisk): PARERisk {
    const data = this.asRecord(value);
    const level = data.level === 'LOW' || data.level === 'MEDIUM' || data.level === 'HIGH' ? data.level : fallback.level;
    return {
      level,
      factors: this.asArray<string>(data.factors).filter((factor) => typeof factor === 'string'),
      recommendation: this.asString(data.recommendation) || fallback.recommendation,
    };
  }

  private asDrafts(value: unknown, fallback: PAREDrafts): PAREDrafts {
    const data = this.asRecord(value);
    return {
      supplierNotification: this.asString(data.supplierNotification) || fallback.supplierNotification,
      clientReassurance: this.asString(data.clientReassurance) || fallback.clientReassurance,
    };
  }

  private fallbackCandidate(supplierName: string, reason: string): PARECandidate {
    return {
      supplierId: '',
      supplierName,
      tier: 'unknown',
      quotedAmount: 0,
      reliabilityScore: 0,
      halal: false,
      priorPmcmEvents: 0,
      reason,
    };
  }

  private fallbackBudgetAnalysis(candidate: PARECandidate): PAREBudgetAnalysis {
    return {
      feasible: false,
      selectedCandidate: candidate,
      costDelta: 0,
      costDeltaLabel: 'N/A',
      summary: 'PARE analysis payload was unavailable.',
    };
  }

  private mapApprovalStatus(status: string): PAREApprovalStatus {
    if (status === 'approved') return 'approved';
    if (status === 'rejected') return 'rejected';
    return 'pending';
  }

  private toIso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}
