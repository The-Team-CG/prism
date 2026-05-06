import { randomUUID } from 'node:crypto';
import { DataSanitizerService } from './data-sanitizer.service';
import { EventContextAgent } from './agents/event-context.agent';
import { SupplierFinderAgent } from './agents/supplier-finder.agent';
import { BudgetAgent } from './agents/budget.agent';
import { RiskAgent } from './agents/risk.agent';
import { MessageDrafterAgent } from './agents/message-drafter.agent';
import type { PAREContext, PAREResult } from './pare.types';

type PAREMode = 'mock' | 'live';

export class PAREService {
  private readonly mode: PAREMode;
  private readonly sanitizer: DataSanitizerService;
  private readonly eventContextAgent: EventContextAgent;
  private readonly supplierFinderAgent: SupplierFinderAgent;
  private readonly budgetAgent: BudgetAgent;
  private readonly riskAgent: RiskAgent;
  private readonly messageDrafterAgent: MessageDrafterAgent;

  constructor(private readonly prisma: any) {
    this.mode = (process.env.PARE_MODE as PAREMode) ?? 'mock';
    this.sanitizer = new DataSanitizerService();
    this.eventContextAgent = new EventContextAgent(prisma);
    this.supplierFinderAgent = new SupplierFinderAgent(prisma);
    this.budgetAgent = new BudgetAgent(this.mode);
    this.riskAgent = new RiskAgent(this.mode);
    this.messageDrafterAgent = new MessageDrafterAgent(this.mode);
  }

  async handleEmergencyTrigger(triggerId: string): Promise<PAREResult> {
    const triggeredAt = new Date();

    // Agent 1 — event context
    const ctx: PAREContext = await this.eventContextAgent.run(triggerId);

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

    // Log to OpsAiAuditLog (ZDR sanitized)
    const { data: sanitizedPayload, dataCategories } = this.sanitizer.sanitize(
      ctx as unknown as Record<string, unknown>,
    );
    const aiAuditLogId = randomUUID();
    await this.prisma.opsAiAuditLog.create({
      data: {
        id: aiAuditLogId,
        eventId: ctx.eventId,
        featureName: 'PARE',
        modelVersion: this.mode === 'live' ? 'claude-sonnet-4-6' : 'mock',
        dataCategories,
        sanitizedPayload,
        zdrConfirmed: this.mode === 'live' ? false : true,
        humanApprovalRequired: true,
        status: 'pending_human_approval',
      },
    });

    // Create approval record — PMCM Admin must approve before any action fires
    const approvalRecordId = randomUUID();
    await this.prisma.opsAiApprovalRecord.create({
      data: {
        id: approvalRecordId,
        aiAuditLogId,
        eventId: ctx.eventId,
        featureName: 'PARE',
        requestedBy: 'PARE Engine',
        status: 'pending_human_approval',
        requestedAt: triggeredAt,
      },
    });

    const replacement = budgetAnalysis.selectedCandidate;

    return {
      approvalRecordId,
      eventId: ctx.eventId,
      eventName: ctx.eventName,
      withdrawnSupplier: ctx.withdrawnSupplier.name,
      recommendedReplacement: replacement.supplierName,
      recommendedAmount: replacement.quotedAmount,
      costDelta: budgetAnalysis.costDelta,
      riskLevel: riskAssessment.level,
      riskFactors: riskAssessment.factors,
      supplierNotificationDraft: ctx.drafts.supplierNotification,
      clientReassuranceDraft: ctx.drafts.clientReassurance,
      status: 'pending_human_approval',
      triggeredAt: triggeredAt.toISOString(),
    };
  }

  async getPendingApprovals(eventId?: string) {
    const where: Record<string, unknown> = {
      featureName: 'PARE',
      status: 'pending_human_approval',
    };
    if (eventId) where['eventId'] = eventId;

    return this.prisma.opsAiApprovalRecord.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
    });
  }

  async approveRecommendation(approvalRecordId: string, approvedBy: string): Promise<void> {
    await this.prisma.opsAiApprovalRecord.update({
      where: { id: approvalRecordId },
      data: {
        status: 'approved',
        humanApproved: true,
        approvedBy,
        approvedAt: new Date(),
      },
    });
    const record = await this.prisma.opsAiApprovalRecord.findUnique({
      where: { id: approvalRecordId },
    });
    if (record?.aiAuditLogId) {
      await this.prisma.opsAiAuditLog.update({
        where: { id: record.aiAuditLogId },
        data: { humanApproved: true, status: 'approved' },
      });
    }
  }

  async rejectRecommendation(approvalRecordId: string, rejectedBy: string): Promise<void> {
    await this.prisma.opsAiApprovalRecord.update({
      where: { id: approvalRecordId },
      data: {
        status: 'rejected',
        humanApproved: false,
        approvedBy: rejectedBy,
        approvedAt: new Date(),
      },
    });
    const record = await this.prisma.opsAiApprovalRecord.findUnique({
      where: { id: approvalRecordId },
    });
    if (record?.aiAuditLogId) {
      await this.prisma.opsAiAuditLog.update({
        where: { id: record.aiAuditLogId },
        data: { humanApproved: false, status: 'rejected' },
      });
    }
  }
}
