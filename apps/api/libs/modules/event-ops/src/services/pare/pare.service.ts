import { randomUUID } from 'node:crypto';
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

type PAREMode = 'mock' | 'live';
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

export class PAREService {
  private readonly mode: PAREMode;
  private readonly sanitizer: DataSanitizerService;
  private readonly eventContextAgent: EventContextAgent;
  private readonly supplierFinderAgent: SupplierFinderAgent;
  private readonly budgetAgent: BudgetAgent;
  private readonly riskAgent: RiskAgent;
  private readonly messageDrafterAgent: MessageDrafterAgent;

  // In-memory fallback store — used when DB is unreachable
  private readonly memoryAuditLogs = new Map<string, AuditRow>();
  private readonly memoryApprovals = new Map<string, ApprovalRow>();

  constructor(private readonly prisma: any) {
    this.mode = (process.env.PARE_MODE as PAREMode) ?? 'mock';
    this.sanitizer = new DataSanitizerService();
    this.eventContextAgent = new EventContextAgent(prisma);
    this.supplierFinderAgent = new SupplierFinderAgent(prisma);
    this.budgetAgent = new BudgetAgent(this.mode);
    this.riskAgent = new RiskAgent(this.mode);
    this.messageDrafterAgent = new MessageDrafterAgent(this.mode);
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

    // Agent 1 — event context
    const ctx: PAREContext = await this.eventContextAgent.run(triggerId, prefetched);

    // Agent 2 — find replacement candidates
    ctx.candidates = await this.supplierFinderAgent.run(ctx);

    // Agents 3 + 4 — run in parallel (independent of each other)
    const [budgetAnalysis, riskAssessment] = await Promise.all([
      this.budgetAgent.run(ctx),
      this.riskAgent.run(ctx),
    ]);
    ctx.budgetAnalysis = budgetAnalysis;
    ctx.riskAssessment = riskAssessment;

    // Agent 5 — draft messages
    ctx.drafts = await this.messageDrafterAgent.run(ctx);

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
    const audit = await this.dbCreate<AuditRow>(
      this.prisma.opsAiAuditLog,
      {
        id: aiAuditLogId,
        eventId: ctx.eventId,
        featureName: 'PARE',
        modelVersion: this.mode === 'live' ? 'claude-sonnet-4-6' : 'mock',
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
