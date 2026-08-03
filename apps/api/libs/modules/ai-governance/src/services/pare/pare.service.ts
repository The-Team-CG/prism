import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/database';
import {
  buildPareEventContext,
  noCandidateBudgetAnalysis,
  rankSupplierCandidates,
  sanitizePareData,
} from '@prism/pare-core';
import type {
  PAREApprovalRecord,
  PAREApprovalStatus,
  PAREBudgetAnalysis,
  PARECandidate,
  PAREContext,
  PAREDrafts,
  PAREResult,
  PARERisk,
} from '@prism/types';
import { PARE_LIVE_MODEL_VERSION, PareAgentGateway, type PareMode } from './pare-agent.gateway';
import { PareSourceService } from './pare-source.service';

type ApprovalRow = {
  id: string;
  aiAuditLogId: string;
  eventId?: string | null;
  status: string;
  approvedBy?: string | null;
  approvedAt?: Date | string | null;
  requestedAt?: Date | string | null;
};
type AuditRow = {
  id: string;
  eventId?: string | null;
  modelVersion?: string | null;
  sanitizedPayload?: unknown;
  createdAt?: Date | string | null;
};

/**
 * PARE's interface: run a withdrawal through the engine, record what it saw, and
 * park the recommendation behind human approval.
 *
 * The decision logic lives in `@prism/pare-core`; the reasoning steps are the
 * `apps/agent-*` eve apps, reached through {@link PareAgentGateway}. Nothing here
 * acts on a recommendation — a PMCM Admin approves or rejects it first.
 */
@Injectable()
export class PAREService {
  private readonly mode: PareMode;
  private readonly source: PareSourceService;
  private readonly agents: PareAgentGateway;

  // In-memory fallback store — used when DB is unreachable
  private readonly memoryAuditLogs = new Map<string, AuditRow>();
  private readonly memoryApprovals = new Map<string, ApprovalRow>();

  constructor(private readonly prisma: PrismaService) {
    this.mode = (process.env.PARE_MODE as PareMode) ?? 'mock';
    this.source = new PareSourceService(prisma);
    this.agents = new PareAgentGateway(this.mode);
  }

  private async dbCreate<T>(model: any, data: Record<string, unknown>, memoryStore: Map<string, any>): Promise<T> {
    try {
      return await model.create({ data });
    } catch {
      const row = { ...data } as T;
      memoryStore.set(data.id as string, row);
      return row;
    }
  }

  private async dbUpdate<T>(model: any, id: string, data: Record<string, unknown>, memoryStore: Map<string, any>): Promise<T> {
    try {
      return await model.update({ where: { id }, data });
    } catch {
      const existing = memoryStore.get(id) ?? { id };
      const updated = { ...existing, ...data } as T;
      memoryStore.set(id, updated);
      return updated;
    }
  }

  async handleEmergencyTrigger(triggerId: string, prefetched?: { request: any; event: any }): Promise<PAREApprovalRecord> {
    const triggeredAt = new Date();

    // Step 1 — event context
    const ctx: PAREContext = buildPareEventContext(
      await this.source.loadTriggerInput(triggerId, prefetched),
    );

    // Step 2 — shortlist replacement candidates
    ctx.candidates = rankSupplierCandidates(ctx, await this.source.loadCandidateSuppliers(ctx));
    const top = ctx.candidates[0];

    // Steps 3 + 4 — independent of each other, so run them together
    const [budgetAnalysis, riskAssessment] = await Promise.all([
      top ? this.agents.runBudgetAgent(ctx, top) : Promise.resolve(noCandidateBudgetAnalysis()),
      this.agents.runRiskAgent(ctx),
    ]);
    ctx.budgetAnalysis = budgetAnalysis;
    ctx.riskAssessment = riskAssessment;

    // Step 5 — draft the messages PMCM will review
    ctx.drafts = await this.agents.runMessageDrafterAgent(ctx);

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
    const { data: sanitizedPayload, dataCategories } = sanitizePareData(
      pareResult as unknown as Record<string, unknown>,
    );
    const aiAuditLogId = randomUUID();
    const audit = await this.dbCreate<AuditRow>(
      this.prisma.opsAiAuditLog,
      {
        id: aiAuditLogId,
        eventId: ctx.eventId,
        featureName: 'PARE',
        modelVersion: this.mode === 'live' ? PARE_LIVE_MODEL_VERSION : 'mock',
        dataCategories,
        sanitizedPayload,
        zdrConfirmed: this.mode === 'live' ? false : true,
        humanApprovalRequired: true,
        status: 'pending_human_approval',
        createdAt: triggeredAt,
      },
      this.memoryAuditLogs,
    );

    // Create approval record — PMCM Admin must approve before any action fires
    const approvalRecordId = randomUUID();
    const approval = await this.dbCreate<ApprovalRow>(
      this.prisma.opsAiApprovalRecord,
      {
        id: approvalRecordId,
        aiAuditLogId,
        eventId: ctx.eventId,
        featureName: 'PARE',
        requestedBy: 'PARE Engine',
        status: 'pending_human_approval',
        requestedAt: triggeredAt,
      },
      this.memoryApprovals,
    );

    return this.mapApprovalRecord(approval, audit);
  }

  async getPendingApprovals(eventId?: string): Promise<PAREApprovalRecord[]> {
    const where: Record<string, unknown> = {
      featureName: 'PARE',
      status: 'pending_human_approval',
    };
    if (eventId) where['eventId'] = eventId;

    let approvals: ApprovalRow[];
    try {
      approvals = await this.prisma.opsAiApprovalRecord.findMany({
        where,
        take: 100,
        orderBy: { requestedAt: 'desc' },
      });
    } catch {
      approvals = Array.from(this.memoryApprovals.values()).filter(
        (r) => r.status === 'pending_human_approval' && (!eventId || r.eventId === eventId),
      );
    }
    return Promise.all(approvals.map((record: ApprovalRow) => this.mapApprovalRecordWithAudit(record)));
  }

  async approveRecommendation(approvalRecordId: string, approvedBy: string): Promise<PAREApprovalRecord> {
    const updateData = { status: 'approved', humanApproved: true, approvedBy, approvedAt: new Date() };
    const updated = await this.dbUpdate<ApprovalRow>(
      this.prisma.opsAiApprovalRecord, approvalRecordId, updateData, this.memoryApprovals,
    );
    if (updated?.aiAuditLogId) {
      await this.dbUpdate(
        this.prisma.opsAiAuditLog, updated.aiAuditLogId, { humanApproved: true, status: 'approved' }, this.memoryAuditLogs,
      );
    }
    return this.mapApprovalRecordWithAudit(updated);
  }

  async rejectRecommendation(approvalRecordId: string, rejectedBy: string): Promise<PAREApprovalRecord> {
    const updateData = { status: 'rejected', humanApproved: false, approvedBy: rejectedBy, approvedAt: new Date() };
    const updated = await this.dbUpdate<ApprovalRow>(
      this.prisma.opsAiApprovalRecord, approvalRecordId, updateData, this.memoryApprovals,
    );
    if (updated?.aiAuditLogId) {
      await this.dbUpdate(
        this.prisma.opsAiAuditLog, updated.aiAuditLogId, { humanApproved: false, status: 'rejected' }, this.memoryAuditLogs,
      );
    }
    return this.mapApprovalRecordWithAudit(updated);
  }

  private async mapApprovalRecordWithAudit(record: ApprovalRow): Promise<PAREApprovalRecord> {
    const audit = await this.findAuditLog(record.aiAuditLogId);
    return this.mapApprovalRecord(record, audit);
  }

  private async findAuditLog(aiAuditLogId: string): Promise<AuditRow | null> {
    if (!aiAuditLogId) return null;
    try {
      if (typeof this.prisma.opsAiAuditLog.findUnique === 'function') {
        return await this.prisma.opsAiAuditLog.findUnique({ where: { id: aiAuditLogId } });
      }
      const records = await this.prisma.opsAiAuditLog.findMany({ where: { id: aiAuditLogId }, take: 1 });
      return records[0] ?? null;
    } catch {
      return this.memoryAuditLogs.get(aiAuditLogId) ?? null;
    }
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
    // Distinct from `noCandidateBudgetAnalysis()`: that means "the category had no
    // replacement", this means "the stored payload could not be read".
    const fallbackBudget = this.unreadablePayloadBudgetAnalysis();
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
      mode: data.mode === 'live' || audit?.modelVersion === PARE_LIVE_MODEL_VERSION ? 'live' : 'mock',
      triggeredAt: this.asString(data.triggeredAt) || this.toIso(record.requestedAt ?? audit?.createdAt ?? new Date()),
    };
  }

  /** Shown when an audit row exists but its sanitized payload cannot be read. */
  private unreadablePayloadBudgetAnalysis(): PAREBudgetAnalysis {
    return {
      feasible: false,
      selectedCandidate: {
        supplierId: '',
        supplierName: 'No candidate found',
        tier: 'unknown',
        quotedAmount: 0,
        reliabilityScore: 0,
        halal: false,
        priorPmcmEvents: 0,
        reason: 'No PARE candidate payload was stored.',
      },
      costDelta: 0,
      costDeltaLabel: 'N/A',
      summary: 'PARE analysis payload was unavailable.',
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

  private mapApprovalStatus(status: string): PAREApprovalStatus {
    if (status === 'approved') return 'approved';
    if (status === 'rejected') return 'rejected';
    return 'pending';
  }

  private toIso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}
