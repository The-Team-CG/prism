import { randomUUID } from 'node:crypto';
import type { OpsAiApprovalRecord, OpsAiAuditLog, Prisma } from '@prisma/client';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { PLATFORM_REFERENCE_READ_MODEL, type PlatformReferenceReadModel } from '@prism/contexts/read-models';
import {
  aiAuditEvidenceSchema,
  aiPareProvenanceChainEvidenceSchema,
  type AiAuditEvidence,
  type AiUseCaseId,
} from '@prism/types';
import { AI_GATEWAY, type AiGateway, type AiSyntheticPareChain, type AiSyntheticProvenanceVerifier } from '../../../contracts/ai-governance/ai-gateway.port';
import {
  AI_GATEWAY_RUNTIME_CONFIG,
  AI_SYNTHETIC_PROVENANCE_VERIFIER,
  type AiGatewayRuntimeConfig,
} from '../gateway/ai-gateway.config';
import { assertPareExecutionAllowed, configuredPareMode, PareConfigurationError, type PAREMode } from './pare-execution.policy';
import { DataSanitizerService } from './data-sanitizer.service';
import { PareSourceNotFoundError } from './pare-source.errors';
import { EventContextAgent } from './agents/event-context.agent';
import { SupplierFinderAgent } from './agents/supplier-finder.agent';
import { BudgetAgent } from './agents/budget.agent';
import { RiskAgent } from './agents/risk.agent';
import { MessageDrafterAgent } from './agents/message-drafter.agent';
import { isPareRoutePolicyEligibleEvidence } from './pare-ai-gateway';
import { canonicalJson, digestJson, digestSerializedText } from '../json-digest';
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

const PARE_LINEAR_CHAIN_PROVENANCE_VERSION = 1;
const PARE_CHAIN_PROVENANCE_VERSION = 2;

type ApprovalRow = {
  id: string;
  aiAuditLogId: string;
  featureName: string;
  eventId?: string | null;
  status: string;
  reviewPayload?: unknown;
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

function assertMatchingAuditCore<
  TRecord extends Pick<ApprovalRow, 'eventId' | 'featureName' | 'sourceDispatchId'>,
  TAudit extends Pick<AuditRow, 'eventId' | 'featureName' | 'sanitizedPayload'>,
>(record: TRecord, audit: TAudit | null): asserts audit is TAudit & { eventId: string; featureName: 'PARE' } {
  if (!audit) throw new BadRequestException('A matching durable PARE audit is required');
  if (audit.featureName !== 'PARE') throw new BadRequestException('A matching durable PARE audit is required');
  if (!record.eventId) throw new BadRequestException('A matching durable PARE audit is required');
  if (!audit.eventId) throw new BadRequestException('A matching durable PARE audit is required');
  if (audit.eventId !== record.eventId) throw new BadRequestException('A matching durable PARE audit is required');
  const requestId = auditRequestId(audit);
  if (!requestId) throw new BadRequestException('A matching durable PARE audit is required');
  const payloadEventId = auditEventId(audit);
  if (!payloadEventId) throw new BadRequestException('A matching durable PARE audit is required');
  if (payloadEventId !== audit.eventId) throw new BadRequestException('A matching durable PARE audit is required');
}

function requireMatchingAudit<
  TRecord extends Pick<ApprovalRow, 'eventId' | 'featureName' | 'sourceDispatchId'>,
  TAudit extends Pick<AuditRow, 'eventId' | 'featureName' | 'sanitizedPayload'>,
>(record: TRecord, audit: TAudit | null, expectedRequestId?: string, expectedSourceDispatchId?: string): TAudit & { eventId: string; featureName: 'PARE' } {
  assertMatchingAuditCore(record, audit);
  const requestId = auditRequestId(audit);
  if (expectedRequestId !== undefined && requestId !== expectedRequestId) {
    throw new BadRequestException('A matching durable PARE audit is required');
  }
  if (expectedSourceDispatchId !== undefined && record.sourceDispatchId !== expectedSourceDispatchId) {
    throw new BadRequestException('A matching durable PARE audit is required');
  }
  return audit;
}

function auditPayload(audit: Pick<AuditRow, 'sanitizedPayload'>): Record<string, unknown> {
  const payload = audit?.sanitizedPayload !== undefined && audit.sanitizedPayload !== null && typeof audit.sanitizedPayload === 'object' && !Array.isArray(audit.sanitizedPayload)
    ? audit.sanitizedPayload as Record<string, unknown>
    : {};
  return payload;
}

function auditRequestId(audit: Pick<AuditRow, 'sanitizedPayload'>): string {
  const data = auditPayload(audit);
  return typeof data.requestId === 'string' ? data.requestId : typeof data.triggerId === 'string' ? data.triggerId : '';
}

function auditEventId(audit: Pick<AuditRow, 'sanitizedPayload'>): string {
  const value = auditPayload(audit).eventId;
  return typeof value === 'string' ? value : '';
}

type PareChainEvidence = NonNullable<AiAuditEvidence['pareChain']>;
type PareChainVersion = typeof PARE_LINEAR_CHAIN_PROVENANCE_VERSION | typeof PARE_CHAIN_PROVENANCE_VERSION;
type BudgetAgentRun = Awaited<ReturnType<BudgetAgent['runPareBudgetAgent']>>;
type RiskAgentRun = Awaited<ReturnType<RiskAgent['runPareRiskAgent']>>;
type DraftAgentRun = Awaited<ReturnType<MessageDrafterAgent['runPareMessageDraftAgent']>>;
type PareAgentRuns = { budgetRun: BudgetAgentRun; riskRun: RiskAgentRun; draftRun: DraftAgentRun };

type PareChainLayout = {
  stages: readonly AiUseCaseId[];
  stageIndexes: readonly number[];
  parentIndexes: readonly (readonly number[])[];
};

function pareChainLayout(version: PareChainVersion): PareChainLayout {
  return version === PARE_LINEAR_CHAIN_PROVENANCE_VERSION
    ? { stages: ['pare.budget', 'pare.risk', 'pare.message-drafts'], stageIndexes: [0, 1, 2], parentIndexes: [[], [0], [0, 1]] }
    : { stages: ['pare.budget', 'pare.risk', 'pare.message-drafts'], stageIndexes: [0, 0, 2], parentIndexes: [[], [], [0, 1]] };
}

function assertPareChainStageOrder(
  evidence: AiAuditEvidence,
  item: PareChainEvidence,
  requestId: string,
  expectedStage: AiUseCaseId,
  expectedIndex: number,
): void {
  if (evidence.useCaseId !== expectedStage || evidence.correlationId !== requestId ||
    item.stage !== expectedStage || item.stageIndex !== expectedIndex) {
    throw new BadRequestException('PARE provenance stages are not one ordered completed chain');
  }
}

function assertPareChainAuditIdentity(evidence: AiAuditEvidence, item: PareChainEvidence): void {
  if (item.auditId !== `aia_${evidence.requestId}` || item.rootFixtureId !== evidence.syntheticProvenance?.sourceId) {
    throw new BadRequestException('PARE provenance stages are not one ordered completed chain');
  }
}

function assertPareChainSharedIdentity(item: PareChainEvidence, first: PareChainEvidence): void {
  if (item.chainId !== first.chainId || item.rootFixtureId !== first.rootFixtureId || item.rootDigest !== first.rootDigest) {
    throw new BadRequestException('PARE provenance stages are not one ordered completed chain');
  }
}

function assertPareChainParents(item: PareChainEvidence, parentRecords: PareChainEvidence[]): void {
  const parentAuditIds = parentRecords.map((parent) => parent.auditId);
  const parentOutputDigests = parentRecords.map((parent) => parent.outputDigest);
  if (JSON.stringify(item.priorAuditIds) !== JSON.stringify(parentAuditIds) ||
    JSON.stringify(item.priorOutputDigests) !== JSON.stringify(parentOutputDigests)) {
    throw new BadRequestException('PARE provenance stages are not one ordered completed chain');
  }
}

function durableStageIdentityMatches(
  row: OpsAiAuditLog,
  item: AiAuditEvidence,
  expectedUseCase: AiUseCaseId,
): boolean {
  return row.id === `aia_${item.requestId}` &&
    row.requestId === item.requestId &&
    row.useCaseId === expectedUseCase &&
    row.correlationId === item.correlationId &&
    row.status === 'completed' &&
    row.outcome === 'completed';
}

function durableProviderEvidenceMatches(row: OpsAiAuditLog, item: AiAuditEvidence): boolean {
  return row.profileId === item.profileId &&
    row.provider === item.provider &&
    row.requestedModel === item.requestedModel &&
    row.promptVersion === item.promptVersion &&
    (row.responseModel ?? undefined) === item.responseModel &&
    row.endpointTag === item.endpointTag;
}

function durableApprovalEvidenceMatches(row: OpsAiAuditLog, item: AiAuditEvidence): boolean {
  return row.zdrBasis === item.zdrBasis &&
    row.approvalState === item.approvalState &&
    row.humanApprovalRequired === true &&
    row.humanApproved === false;
}

function durableRouteEvidenceMatches(route: Record<string, unknown>, item: AiAuditEvidence): boolean {
  return route.routeRevision === item.routeRevision &&
    route.routePolicyOutcome === item.routePolicyOutcome &&
    route.endpointPolicyId === item.endpointTag;
}

function durableChainEvidenceMatches(
  row: OpsAiAuditLog,
  item: AiAuditEvidence,
  storedChain: ReturnType<typeof aiPareProvenanceChainEvidenceSchema.safeParse>,
): boolean {
  if (!storedChain.success) return false;
  return canonicalJson(storedChain.data) === canonicalJson(item.pareChain) &&
    canonicalJson(row.syntheticProvenance) === canonicalJson(item.syntheticProvenance) &&
    canonicalJson(row.dataCategories) === canonicalJson(item.dataClasses);
}

type PareRootStageState = {
  cancellation: AbortController;
  hasFailure: boolean;
  firstFailure?: unknown;
};

async function runPareRootStage<T>(operation: () => Promise<T>, state: PareRootStageState): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!state.hasFailure) {
      state.hasFailure = true;
      state.firstFailure = error;
    }
    state.cancellation.abort(error);
    throw error;
  }
}

async function settlePareRootStages<TBudget, TRisk>(
  budget: () => Promise<TBudget>,
  risk: () => Promise<TRisk>,
  cancellation: AbortController,
): Promise<[TBudget, TRisk]> {
  const state: PareRootStageState = { cancellation, hasFailure: false };
  const [budgetSettled, riskSettled] = await Promise.allSettled([
    runPareRootStage(budget, state),
    runPareRootStage(risk, state),
  ]);
  if (state.hasFailure) throw state.firstFailure;
  if (budgetSettled.status === 'rejected') throw budgetSettled.reason;
  if (riskSettled.status === 'rejected') throw riskSettled.reason;
  return [budgetSettled.value, riskSettled.value];
}

function createPareGatewaySignal(executionSignal: AbortSignal | undefined, cancellation: AbortController): AbortSignal {
  return AbortSignal.any(executionSignal
    ? [executionSignal, cancellation.signal]
    : [cancellation.signal]);
}

function assertLivePareRoute(runtime: AiGatewayRuntimeConfig): void {
  if (runtime.isProduction) {
    throw new PareConfigurationError('Live PARE is disabled in production until its activation is approved');
  }
  const requiredUseCases: AiUseCaseId[] = ['pare.budget', 'pare.risk', 'pare.message-drafts'];
  if (!requiredUseCases.every((id) => runtime.liveUseCases.has(id))) {
    throw new PareConfigurationError('Live PARE requires all three PARE use cases in AI_LIVE_USE_CASES');
  }
}

function assertMockApprovalAudit(audit: OpsAiAuditLog, payload: Record<string, unknown>): void {
  const noGatewayEvidence = payload.runEvidence === undefined ||
    (Array.isArray(payload.runEvidence) && payload.runEvidence.length === 0);
  if (audit.modelVersion !== 'mock' || !audit.zdrConfirmed || !noGatewayEvidence) {
    throw new BadRequestException('A matching durable PARE audit is required');
  }
}

function requireLiveRunEvidence(audit: OpsAiAuditLog, payload: Record<string, unknown>): AiAuditEvidence[] {
  const parsed = aiAuditEvidenceSchema.array().safeParse(payload.runEvidence);
  if (
    payload.mode !== 'live' ||
    audit.modelVersion !== 'ai-gateway' ||
    audit.zdrConfirmed ||
    !parsed.success ||
    parsed.data.length !== 3
  ) {
    throw new BadRequestException('A matching durable PARE audit is required');
  }
  return parsed.data;
}

function isExpectedLiveEvidence(
  evidence: AiAuditEvidence,
  requestId: string,
  expected: ReadonlySet<AiUseCaseId>,
  seen: ReadonlySet<AiUseCaseId>,
): evidence is AiAuditEvidence & { syntheticProvenance: NonNullable<AiAuditEvidence['syntheticProvenance']> } {
  return expected.has(evidence.useCaseId) &&
    !seen.has(evidence.useCaseId) &&
    evidence.outcome === 'completed' &&
    evidence.correlationId === requestId &&
    isPareRoutePolicyEligibleEvidence(evidence);
}

function assertLiveEvidenceSet(evidenceSet: AiAuditEvidence[], requestId: string): void {
  const expected: readonly AiUseCaseId[] = ['pare.budget', 'pare.risk', 'pare.message-drafts'];
  let provenanceIdentity: string | undefined;
  for (const [index, evidence] of evidenceSet.entries()) {
    if (evidence.useCaseId !== expected[index] || !isExpectedLiveEvidence(evidence, requestId, new Set(expected), new Set(expected.slice(0, index)))) {
      throw new BadRequestException('A matching durable PARE audit is required');
    }
    const provenance = evidence.syntheticProvenance;
    const identity = JSON.stringify([provenance.source, provenance.sourceId, provenance.verifier]);
    if (provenanceIdentity !== undefined && provenanceIdentity !== identity) {
      throw new BadRequestException('A matching durable PARE audit is required');
    }
    provenanceIdentity = identity;
  }
  if (evidenceSet.length !== expected.length) {
    throw new BadRequestException('A matching durable PARE audit is required');
  }
}

function assertPareChainEvidenceSet(
  evidenceSet: AiAuditEvidence[],
  requestId: string,
  version: PareChainVersion,
): void {
  const layout = pareChainLayout(version);
  const chain = evidenceSet.map((evidence) => evidence.pareChain);
  if (evidenceSet.length !== layout.stages.length || chain.some((item) => !item)) {
    throw new BadRequestException('A complete server-owned PARE provenance chain is required');
  }
  const first = chain[0]!;
  for (const [index, evidence] of evidenceSet.entries()) {
    const item = evidence.pareChain!;
    const parentIndexes = layout.parentIndexes[index];
    const parentRecords = parentIndexes.map((parentIndex) => chain[parentIndex]!);
    assertPareChainStageOrder(evidence, item, requestId, layout.stages[index], layout.stageIndexes[index]);
    assertPareChainAuditIdentity(evidence, item);
    assertPareChainSharedIdentity(item, first);
    assertPareChainParents(item, parentRecords);
  }
}

function assertPareResultMatchesChain(evidenceSet: AiAuditEvidence[], pareResult: PAREResult): void {
  const outputs = [pareResult.budgetAnalysis, pareResult.riskAssessment, pareResult.drafts];
  if (evidenceSet.length !== outputs.length || evidenceSet.some((evidence, index) =>
    evidence.pareChain?.outputDigest !== digestJson(outputs[index]))) {
    throw new BadRequestException('PARE review result does not match its completed provenance chain');
  }
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
    @Optional() @Inject(AI_GATEWAY) private readonly aiGateway?: AiGateway,
    @Optional() @Inject(AI_GATEWAY_RUNTIME_CONFIG) private readonly aiRuntime?: AiGatewayRuntimeConfig,
    @Optional() @Inject(AI_SYNTHETIC_PROVENANCE_VERIFIER)
    private readonly syntheticVerifier?: AiSyntheticProvenanceVerifier,
    @Optional() @Inject(PLATFORM_REFERENCE_READ_MODEL)
    private readonly platformReferences?: PlatformReferenceReadModel,
  ) {
    this.mode = configuredPareMode(process.env.PARE_MODE, this.aiRuntime?.localSyntheticProviderMode === true);
    if (this.mode === 'live' && this.aiRuntime) assertLivePareRoute(this.aiRuntime);
    this.sanitizer = new DataSanitizerService();
    this.eventContextAgent = new EventContextAgent();
    this.supplierFinderAgent = new SupplierFinderAgent();
    this.budgetAgent = new BudgetAgent(this.mode, this.aiGateway);
    this.riskAgent = new RiskAgent(this.mode, this.aiGateway);
    this.messageDrafterAgent = new MessageDrafterAgent(this.mode, this.aiGateway);
  }

  async handleEmergencyTrigger(
    triggerId: string,
    sourceDispatchId?: string,
    executionSignal?: AbortSignal,
  ): Promise<PAREApprovalRecord> {
    const existing = await this.findExistingDispatchApproval(triggerId, sourceDispatchId);
    if (existing) return existing;
    this.assertExecutionDependencies();
    this.throwIfAborted(executionSignal);
    const triggeredAt = new Date();
    const ctx = await this.buildPareContext(triggerId, sourceDispatchId, executionSignal);
    const syntheticPareChain = await this.beginSyntheticPareChain(ctx);
    this.throwIfAborted(executionSignal);
    const gatewayCancellation = new AbortController();
    const gatewaySignal = createPareGatewaySignal(executionSignal, gatewayCancellation);
    const runs = await this.runPareAgents(ctx, gatewaySignal, gatewayCancellation, syntheticPareChain, executionSignal);
    return this.createRecommendationFromRuns(ctx, runs, triggeredAt, sourceDispatchId, syntheticPareChain);
  }

  private async findExistingDispatchApproval(
    triggerId: string,
    sourceDispatchId?: string,
  ): Promise<PAREApprovalRecord | null> {
    if (!sourceDispatchId) return null;
    const existing = await this.prisma.opsAiApprovalRecord.findUnique({ where: { sourceDispatchId } });
    if (!existing) return null;
    return this.mapApprovalRecordWithAudit(existing, triggerId, sourceDispatchId);
  }

  private assertExecutionDependencies(): void {
    assertPareExecutionAllowed(this.mode);
    if (this.mode === 'live' && !this.aiGateway) {
      throw new PareConfigurationError('PARE AI gateway is not registered; live PARE is disabled');
    }
    if (this.mode === 'live' && this.aiRuntime && !this.syntheticVerifier?.beginPareChain) {
      throw new PareConfigurationError('Live PARE requires a server-owned synthetic provenance-chain verifier');
    }
  }

  private async buildPareContext(
    triggerId: string,
    sourceDispatchId: string | undefined,
    signal: AbortSignal | undefined,
  ): Promise<PAREContext> {
    if (!this.platformReferences) {
      throw new PareConfigurationError('Platform reference read model is unavailable; PARE execution is disabled');
    }
    const source = await this.platformReferences.findPareEventSource(triggerId);
    if (!source) throw new PareSourceNotFoundError(`PARE: quote request ${triggerId} has no matching event source`);
    if (sourceDispatchId) {
      const dispatch = await this.prisma.opsPareDispatch.findUnique({
        where: { id: sourceDispatchId },
        select: { id: true, requestId: true, eventId: true },
      });
      if (!dispatch || dispatch.requestId !== triggerId || dispatch.eventId !== source.event.id) {
        throw new PareSourceNotFoundError(`PARE: dispatch ${sourceDispatchId} does not match quote request ${triggerId}`);
      }
    }
    const ctx = await this.eventContextAgent.buildPareEventContext(
      triggerId,
      source,
      Boolean(sourceDispatchId),
      signal,
    );
    const suppliers = await this.platformReferences.findPareSupplierCandidates({
      category: ctx.withdrawnSupplier.category,
      withdrawnSupplierId: ctx.withdrawnSupplier.id,
      withdrawnSupplierName: ctx.withdrawnSupplier.name,
      eventId: ctx.eventId,
    });
    ctx.candidates = await this.supplierFinderAgent.findPareSupplierCandidates(ctx, suppliers, signal);
    return ctx;
  }

  private async beginSyntheticPareChain(ctx: PAREContext): Promise<AiSyntheticPareChain | undefined> {
    if (this.mode === 'live' && this.syntheticVerifier?.beginPareChain) {
      const syntheticPareChain = await this.syntheticVerifier.beginPareChain(ctx, ctx.triggerId) ?? undefined;
      if (!syntheticPareChain) {
        throw new BadRequestException('PARE input is not a registered synthetic provenance-chain root');
      }
      return syntheticPareChain;
    }
    return undefined;
  }

  private async runPareAgents(
    ctx: PAREContext,
    gatewaySignal: AbortSignal,
    gatewayCancellation: AbortController,
    syntheticPareChain: AiSyntheticPareChain | undefined,
    executionSignal: AbortSignal | undefined,
  ): Promise<PareAgentRuns> {
    const [budgetRun, riskRun] = await settlePareRootStages(
      () => this.budgetAgent.runPareBudgetAgent(ctx, gatewaySignal, syntheticPareChain),
      () => this.riskAgent.runPareRiskAgent(ctx, gatewaySignal, syntheticPareChain),
      gatewayCancellation,
    );
    ctx.budgetAnalysis = budgetRun.output;
    ctx.riskAssessment = riskRun.output;
    const draftRun = await this.messageDrafterAgent
      .runPareMessageDraftAgent(ctx, gatewaySignal, syntheticPareChain)
      .catch((error: unknown) => {
        gatewayCancellation.abort(error);
        throw error;
      });
    ctx.drafts = draftRun.output;
    this.throwIfAborted(executionSignal);
    return { budgetRun, riskRun, draftRun };
  }

  private async createRecommendationFromRuns(
    ctx: PAREContext,
    runs: PareAgentRuns,
    triggeredAt: Date,
    sourceDispatchId: string | undefined,
    syntheticPareChain: AiSyntheticPareChain | undefined,
  ): Promise<PAREApprovalRecord> {
    const { budgetRun, riskRun, draftRun } = runs;
    const runEvidence = [budgetRun.evidence, riskRun.evidence, draftRun.evidence]
      .filter((evidence): evidence is AiAuditEvidence => evidence !== null);
    if (this.mode === 'live' && runEvidence.length !== 3) {
      throw new PareConfigurationError('PARE live run is missing gateway evidence');
    }
    if (this.mode === 'live' && syntheticPareChain) {
      assertPareChainEvidenceSet(runEvidence, ctx.triggerId, PARE_CHAIN_PROVENANCE_VERSION);
    }

    const pareResult: PAREResult = {
      requestId: ctx.triggerId,
      eventId: ctx.eventId,
      eventName: ctx.eventName,
      withdrawnSupplier: ctx.withdrawnSupplier,
      candidates: ctx.candidates ?? [],
      budgetAnalysis: budgetRun.output,
      riskAssessment: riskRun.output,
      drafts: draftRun.output,
      mode: this.mode,
      runEvidence,
      triggeredAt: triggeredAt.toISOString(),
    };

    if (syntheticPareChain) assertPareResultMatchesChain(runEvidence, pareResult);

    return this.persistRecommendation(ctx, pareResult, triggeredAt, sourceDispatchId);
  }

  private async persistRecommendation(
    ctx: PAREContext,
    pareResult: PAREResult,
    triggeredAt: Date,
    sourceDispatchId?: string,
  ): Promise<PAREApprovalRecord> {
    const runEvidence = pareResult.runEvidence;
    // Log to OpsAiAuditLog (ZDR sanitized)
    const { runEvidence: _runEvidence, ...reviewResult } = pareResult;
    const { data: reviewPayload, dataCategories } = this.sanitizer.sanitize(
      reviewResult as unknown as Record<string, unknown>,
    );
    const serializedReviewPayload = JSON.stringify(reviewPayload);
    if (typeof serializedReviewPayload !== 'string') {
      throw new BadRequestException('PARE review payload could not be serialized');
    }
    const aiAuditLogId = randomUUID();
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (sourceDispatchId) {
          const existing = await tx.opsAiApprovalRecord.findUnique({ where: { sourceDispatchId } });
          if (existing) return this.mapApprovalRecordWithTransactionAudit(tx, existing, ctx.triggerId, sourceDispatchId);
        }
        // QUERY_AUDIT_RAW_SQL: use PostgreSQL JSONB canonical text for the payload digest persisted with this approval.
        const serializedRows = await tx.$queryRaw<Array<{ canonicalPayload: string }>>`
          SELECT ${serializedReviewPayload}::jsonb::text AS "canonicalPayload"
        `;
        const canonicalPayload = serializedRows[0]?.canonicalPayload;
        if (typeof canonicalPayload !== 'string') {
          throw new BadRequestException('PARE review payload could not be serialized by the database');
        }
        const sanitizedPayload = {
          requestId: pareResult.requestId,
          eventId: pareResult.eventId,
          mode: pareResult.mode,
          pareProvenanceVersion: runEvidence.length === 3 && runEvidence.every((evidence) => evidence.pareChain)
            ? PARE_CHAIN_PROVENANCE_VERSION
            : 0,
          runEvidence,
          triggeredAt: pareResult.triggeredAt,
          reviewPayloadDigest: digestSerializedText(canonicalPayload),
        };
        const audit = await tx.opsAiAuditLog.create({ data: {
          id: aiAuditLogId,
          eventId: ctx.eventId,
          featureName: 'PARE',
          modelVersion: this.mode === 'mock' ? 'mock' : 'ai-gateway',
          dataCategories: toPrismaJson(dataCategories),
          sanitizedPayload: toPrismaJson(sanitizedPayload),
          zdrConfirmed: this.mode === 'mock' || runEvidence.every((evidence) => evidence.routePolicyOutcome === 'zdr_approved'),
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
          reviewPayload: toPrismaJson(reviewPayload),
        } });

        return this.mapApprovalRecord(approval, audit);
      });
    } catch (error) {
      if (sourceDispatchId) {
        const existing = await this.prisma.opsAiApprovalRecord.findUnique({ where: { sourceDispatchId } });
        if (existing) return this.mapApprovalRecordWithAudit(existing, ctx.triggerId, sourceDispatchId);
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
    if (approvals.length === 0) return [];

    const auditLogIds = Array.from(new Set(approvals.map((record: ApprovalRow) => record.aiAuditLogId)));
    const sourceDispatchIds = Array.from(new Set(
      approvals
        .map((record: ApprovalRow) => record.sourceDispatchId)
        .filter((id): id is string => id !== null && id !== undefined),
    ));
    const [auditLogs, dispatches] = await Promise.all([
      this.prisma.opsAiAuditLog.findMany({ where: { id: { in: auditLogIds } } }),
      sourceDispatchIds.length === 0
        ? Promise.resolve([])
        : this.prisma.opsPareDispatch.findMany({
            where: { id: { in: sourceDispatchIds } },
            select: { id: true, requestId: true, eventId: true },
          }),
    ]);
    const auditLogsById = new Map(auditLogs.map((audit) => [audit.id, audit]));
    const dispatchesById = new Map(dispatches.map((dispatch) => [dispatch.id, dispatch]));

    return approvals.map((record: ApprovalRow) => {
      const audit = auditLogsById.get(record.aiAuditLogId) ?? null;
      const matchingAudit = requireMatchingAudit(record, audit);
      const dispatch = record.sourceDispatchId ? dispatchesById.get(record.sourceDispatchId) ?? null : null;
      this.assertDispatchRecordMatches(record, matchingAudit, dispatch);
      return this.mapApprovalRecord(record, matchingAudit);
    });
  }

  async approveRecommendation(approvalRecordId: string, approvedBy: string): Promise<PAREApprovalRecord> {
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
      if (status === 'approved') await this.assertApprovableAudit(tx, audit, record.id);
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

  private async assertApprovableAudit(
    prisma: Prisma.TransactionClient,
    audit: OpsAiAuditLog,
    approvalRecordId: string,
  ): Promise<void> {
    const payload = this.asRecord(audit.sanitizedPayload);
    const reviewPayloadDigest = payload.reviewPayloadDigest;
    await this.assertSavedReviewPayloadDigest(prisma, payload, reviewPayloadDigest, approvalRecordId);
    if (payload.mode === 'mock') {
      assertMockApprovalAudit(audit, payload);
      return;
    }
    await this.assertLiveApprovalAudit(prisma, audit, payload);
  }

  private async assertSavedReviewPayloadDigest(
    prisma: Prisma.TransactionClient,
    payload: Record<string, unknown>,
    reviewPayloadDigest: unknown,
    approvalRecordId: string,
  ): Promise<void> {
    const hasVersionedChain = payload.pareProvenanceVersion === PARE_LINEAR_CHAIN_PROVENANCE_VERSION ||
      payload.pareProvenanceVersion === PARE_CHAIN_PROVENANCE_VERSION;
    if (hasVersionedChain && typeof reviewPayloadDigest !== 'string') {
      throw new BadRequestException('The saved PARE review payload does not match its audited digest');
    }
    if (typeof reviewPayloadDigest !== 'string') return;
    // QUERY_AUDIT_RAW_SQL: re-read the saved JSONB canonical text before accepting an approval.
    const serializedRows = await prisma.$queryRaw<Array<{ canonicalPayload: string }>>`
      SELECT "review_payload"::text AS "canonicalPayload"
      FROM "trust_ops"."ai_approval_records"
      WHERE "id" = ${approvalRecordId}
    `;
    const canonicalPayload = serializedRows[0]?.canonicalPayload;
    if (typeof canonicalPayload !== 'string' || digestSerializedText(canonicalPayload) !== reviewPayloadDigest) {
      throw new BadRequestException('The saved PARE review payload does not match its audited digest');
    }
  }

  private async assertLiveApprovalAudit(
    prisma: Prisma.TransactionClient,
    audit: OpsAiAuditLog,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const evidence = requireLiveRunEvidence(audit, payload);
    assertLiveEvidenceSet(evidence, auditRequestId(audit));
    if (payload.pareProvenanceVersion === PARE_CHAIN_PROVENANCE_VERSION ||
      payload.pareProvenanceVersion === PARE_LINEAR_CHAIN_PROVENANCE_VERSION) {
      if (!this.syntheticVerifier?.beginPareChain) {
        throw new BadRequestException('The server-owned PARE provenance-chain verifier is unavailable');
      }
      assertPareChainEvidenceSet(
        evidence,
        auditRequestId(audit),
        payload.pareProvenanceVersion,
      );
      await this.assertDurablePareChainAudits(prisma, evidence);
    } else if (payload.pareProvenanceVersion !== 0 || evidence.some((item) => item.pareChain)) {
      throw new BadRequestException('A supported PARE provenance version is required');
    }
  }

  private async assertDurablePareChainAudits(
    prisma: Prisma.TransactionClient,
    evidence: AiAuditEvidence[],
  ): Promise<void> {
    const expectedUseCases: readonly AiUseCaseId[] = ['pare.budget', 'pare.risk', 'pare.message-drafts'];
    const ids = evidence.map((item) => item.pareChain!.auditId);
    const rows = await prisma.opsAiAuditLog.findMany({ where: { id: { in: ids } } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const [index, item] of evidence.entries()) {
      const row = byId.get(item.pareChain!.auditId);
      if (!row || !this.isMatchingDurablePareAudit(row, item, expectedUseCases[index])) {
        throw new BadRequestException('A matching durable completed PARE stage audit is required');
      }
    }
  }

  private isMatchingDurablePareAudit(
    row: OpsAiAuditLog,
    item: AiAuditEvidence,
    expectedUseCase: AiUseCaseId,
  ): boolean {
    const payload = this.asRecord(row.sanitizedPayload);
    const route = this.asRecord(payload._aiGatewayRoute);
    const storedChain = aiPareProvenanceChainEvidenceSchema.safeParse(payload._aiPareChain);
    return durableStageIdentityMatches(row, item, expectedUseCase) &&
      durableProviderEvidenceMatches(row, item) &&
      durableApprovalEvidenceMatches(row, item) &&
      durableRouteEvidenceMatches(route, item) &&
      durableChainEvidenceMatches(row, item, storedChain);
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
    this.assertDispatchRecordMatches(record, audit, dispatch);
  }

  private assertDispatchRecordMatches(
    record: ApprovalRow,
    audit: Pick<AuditRow, 'sanitizedPayload'>,
    dispatch: { requestId: string; eventId: string } | null,
  ) {
    if (!record.sourceDispatchId) return;
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
    const payload = {
      ...this.asRecord(record.reviewPayload),
      ...this.asRecord(audit?.sanitizedPayload),
    };
    const pareResult = this.mapPareResult(payload, record, audit);
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
    const runEvidence = aiAuditEvidenceSchema.array().safeParse(data.runEvidence);
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
      mode: data.mode === 'mock' ? 'mock' : 'live',
      runEvidence: runEvidence.success ? runEvidence.data : [],
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
