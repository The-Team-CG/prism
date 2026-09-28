import { randomUUID } from 'node:crypto';
import {
  aiPareProvenanceChainEvidenceSchema,
  pareContextSchema,
  pareCandidateSchema,
  type AiSyntheticProvenance,
  type AiPareProvenanceChainEvidence,
  type AiPareProvenanceChainStage,
  type AiUseCaseId,
} from '@prism/types';
import type {
  AiSyntheticPareChain,
  AiSyntheticPareChainVerification,
  AiSyntheticProvenanceVerifier,
} from '../../../contracts/ai-governance/ai-gateway.port';
import { digestJson, digestJsonOrNull } from '../json-digest';

export const SYNTHETIC_PARE_CANDIDATE_FIXTURE = pareCandidateSchema.parse({
  supplierId: 'ai-fixture-candidate-v1',
  supplierName: 'Supplier Y',
  tier: 'standard',
  quotedAmount: 3_000,
  reliabilityScore: 0.96,
  halal: true,
  priorPmcmEvents: 4,
  reason: 'Synthetic replacement candidate',
});

export const SYNTHETIC_PARE_CONTEXT_FIXTURE = pareContextSchema.parse({
  triggerId: 'ai-fixture-trigger-v1',
  eventId: 'ai-fixture-event-v1',
  eventName: 'Synthetic Event',
  eventDate: '2030-01-01',
  daysUntilEvent: 30,
  clientName: 'Client A',
  totalBudget: 10_000,
  spentBudget: 2_500,
  remainingBudget: 7_500,
  withdrawnSupplier: {
    id: 'ai-fixture-supplier-v1',
    name: 'Supplier X',
    category: 'catering',
    tier: 'standard',
    quotedAmount: 2_500,
  },
  clientPreferences: ['Vegetarian options', 'Outdoor venue'],
});

export const SYNTHETIC_PARE_EVALUATION_CONTEXT_FIXTURE = pareContextSchema.parse({
  ...SYNTHETIC_PARE_CONTEXT_FIXTURE,
  triggerId: 'ai-fixture-trigger-evaluation-v1',
  eventId: 'ai-fixture-event-evaluation-v1',
  candidates: [SYNTHETIC_PARE_CANDIDATE_FIXTURE],
});

export const SYNTHETIC_PARE_CHAIN_ROOT_FIXTURE = pareContextSchema.parse({
  ...SYNTHETIC_PARE_EVALUATION_CONTEXT_FIXTURE,
  triggerId: 'ai-fixture-trigger-pare-chain-v1',
  eventId: 'ai-fixture-event-pare-chain-v1',
});

export const SYNTHETIC_PARE_MESSAGE_CONTEXT_FIXTURE = pareContextSchema.parse({
  ...SYNTHETIC_PARE_EVALUATION_CONTEXT_FIXTURE,
  budgetAnalysis: {
    feasible: true,
    selectedCandidate: SYNTHETIC_PARE_CANDIDATE_FIXTURE,
    costDelta: 500,
    costDeltaLabel: '500 more than withdrawn quote',
    summary: 'Synthetic candidate fits the remaining budget.',
  },
  riskAssessment: {
    level: 'LOW',
    factors: ['Synthetic quote is within the remaining budget'],
    recommendation: 'PMCM should review the synthetic candidate.',
  },
});

export const SYNTHETIC_COMMS_REQUEST_FIXTURE = {
  inquiryId: 'ai-fixture-inquiry-v1',
} as const;

export const SYNTHETIC_TOOL_RESULT_FIXTURE = {
  status: 'synthetic-result-v1',
  message: 'Synthetic tool result',
} as const;

export const SYNTHETIC_PARE_TOOL_RESULT_FIXTURES = {
  budgetSummary: {
    eventName: 'Synthetic Event',
    totalBudget: 10_000,
    spentBudget: 2_500,
    remainingBudget: 7_500,
    withdrawnSupplierQuote: 2_500,
    withdrawnSupplierName: 'Supplier X',
  },
  quoteDetails: {
    supplierName: 'Supplier Y',
    tier: 'standard',
    quotedAmount: 3_000,
    reliabilityScore: 0.96,
    halal: true,
    priorPmcmEvents: 4,
    reason: 'Synthetic replacement candidate',
  },
  supplierHistory: {
    supplierName: 'Supplier Y',
    tier: 'standard',
    reliabilityScore: 0.96,
    priorPmcmEvents: 4,
    halal: true,
    notes: 'Synthetic replacement candidate',
  },
  eventTimeline: {
    eventName: 'Synthetic Event',
    eventDate: '2030-01-01',
    daysUntilEvent: 30,
    urgency: 'NORMAL',
  },
  clientPreferences: {
    clientName: 'Client A',
    preferences: ['Vegetarian options', 'Outdoor venue'],
  },
  messageSummary: {
    event: {
      name: 'Synthetic Event',
      date: '2030-01-01',
      daysAway: 30,
      clientName: 'Client A',
      clientPreferences: ['Vegetarian options', 'Outdoor venue'],
    },
    withdrawnSupplier: {
      name: 'Supplier X',
      category: 'catering',
      tier: 'standard',
    },
    recommendedReplacement: {
      name: 'Supplier Y',
      tier: 'standard',
      reliabilityScore: 0.96,
      priorPmcmEvents: 4,
      halal: true,
      quotedAmount: 3_000,
    },
    riskLevel: 'LOW',
    budgetFeasible: true,
    budgetSummary: 'Synthetic candidate fits the remaining budget.',
  },
} as const;

const pareProvenance = {
  source: 'test-fixture',
  sourceId: 'ai-pare-context-v1',
  verifier: 'test-fixture-registry',
} as const satisfies Omit<AiSyntheticProvenance, 'verifiedAt'>;

const evaluationProvenance = {
  source: 'test-fixture',
  sourceId: 'ai-pare-evaluation-v1',
  verifier: 'test-fixture-registry',
} as const satisfies Omit<AiSyntheticProvenance, 'verifiedAt'>;

const pareChainRootProvenance = {
  source: 'test-fixture',
  sourceId: 'ai-pare-chain-root-v1',
  verifier: 'test-fixture-registry',
} as const satisfies Omit<AiSyntheticProvenance, 'verifiedAt'>;

const registeredFixtures: ReadonlyArray<readonly [unknown, Omit<AiSyntheticProvenance, 'verifiedAt'>]> = [
  [SYNTHETIC_PARE_CONTEXT_FIXTURE, pareProvenance],
  [SYNTHETIC_PARE_EVALUATION_CONTEXT_FIXTURE, evaluationProvenance],
  [SYNTHETIC_PARE_CHAIN_ROOT_FIXTURE, pareChainRootProvenance],
  [SYNTHETIC_PARE_MESSAGE_CONTEXT_FIXTURE, evaluationProvenance],
  ...Object.values(SYNTHETIC_PARE_TOOL_RESULT_FIXTURES).map((result) => [result, evaluationProvenance] as const),
  [SYNTHETIC_COMMS_REQUEST_FIXTURE, {
    source: 'test-fixture', sourceId: 'ai-comms-inquiry-v1', verifier: 'test-fixture-registry',
  }],
  [SYNTHETIC_TOOL_RESULT_FIXTURE, {
    source: 'test-fixture', sourceId: 'ai-tool-result-v1', verifier: 'test-fixture-registry',
  }],
];

const registeredDigests = new Map<string, Omit<AiSyntheticProvenance, 'verifiedAt'>>(
  registeredFixtures.map(([value, provenance]) => [
    digestJson(value),
    provenance,
  ]),
);

const PARE_CHAIN_STAGES = ['pare.budget', 'pare.risk', 'pare.message-drafts'] as const satisfies readonly AiUseCaseId[];
type SyntheticPareContext = ReturnType<typeof pareContextSchema.parse>;

type SyntheticPareChainState = {
  correlationId: string;
  rootDigest: string;
  provenance: AiSyntheticProvenance;
  chainId: string;
  completed: Map<AiPareProvenanceChainStage, AiPareProvenanceChainEvidence>;
  pending: Map<AiPareProvenanceChainStage, AiSyntheticPareChainVerification>;
};

function resolvePareChainStage(
  state: SyntheticPareChainState,
  useCaseId: AiUseCaseId,
  stageCorrelationId: string | undefined,
): AiPareProvenanceChainStage | null {
  const stage = PARE_CHAIN_STAGES.find((candidate) => candidate === useCaseId);
  if (!stage || stageCorrelationId !== state.correlationId) return null;
  if (state.pending.has(stage) || state.completed.has(stage)) return null;
  return stage;
}

function parsePareChainStageInput(input: unknown, correlationId: string): SyntheticPareContext | null {
  const parsed = pareContextSchema.safeParse(input);
  if (!parsed.success || parsed.data.triggerId !== correlationId) return null;
  return parsed.data;
}

function hasExpectedStageOutputs(stage: AiPareProvenanceChainStage, data: SyntheticPareContext): boolean {
  const { budgetAnalysis, riskAssessment, drafts } = data;
  const isRootStage = stage === 'pare.budget' || stage === 'pare.risk';
  if (isRootStage && (budgetAnalysis || riskAssessment || drafts)) return false;
  if (stage === 'pare.message-drafts' && (!budgetAnalysis || !riskAssessment || drafts)) return false;
  return true;
}

function pareStagePriorRecords(
  stage: AiPareProvenanceChainStage,
  data: SyntheticPareContext,
  completed: SyntheticPareChainState['completed'],
): AiPareProvenanceChainEvidence[] | null {
  if (stage !== 'pare.message-drafts') return [];
  const budgetRecord = completed.get('pare.budget');
  const riskRecord = completed.get('pare.risk');
  if (!budgetRecord || !riskRecord) return null;
  if (digestJson(data.budgetAnalysis) !== budgetRecord.outputDigest ||
    digestJson(data.riskAssessment) !== riskRecord.outputDigest) return null;
  return [budgetRecord, riskRecord];
}

function verifyPareChainStage(
  state: SyntheticPareChainState,
  stageInput: unknown,
  useCaseId: AiUseCaseId,
  stageCorrelationId: string | undefined,
): AiSyntheticPareChainVerification | null {
  const stage = resolvePareChainStage(state, useCaseId, stageCorrelationId);
  if (!stage) return null;
  const data = parsePareChainStageInput(stageInput, state.correlationId);
  if (!data) return null;
  const { budgetAnalysis: _budget, riskAssessment: _risk, drafts: _drafts, ...base } = data;
  if (digestJson(base) !== state.rootDigest || !hasExpectedStageOutputs(stage, data)) return null;
  const priorRecords = pareStagePriorRecords(stage, data, state.completed);
  if (!priorRecords) return null;

  const verification: AiSyntheticPareChainVerification = {
    provenance: { ...state.provenance, verifiedAt: new Date().toISOString() },
    chainId: state.chainId,
    rootFixtureId: state.provenance.sourceId,
    rootDigest: state.rootDigest,
    stage,
    stageIndex: stage === 'pare.message-drafts' ? 2 : 0,
    inputDigest: digestJson(data)!,
    priorRecords,
  };
  state.pending.set(stage, verification);
  return verification;
}

function matchesPareChainIdentity(
  evidence: AiPareProvenanceChainEvidence,
  expected: AiSyntheticPareChainVerification,
): boolean {
  return evidence.chainId === expected.chainId &&
    evidence.rootFixtureId === expected.rootFixtureId &&
    evidence.rootDigest === expected.rootDigest;
}

function matchesPareStageIdentity(
  evidence: AiPareProvenanceChainEvidence,
  expected: AiSyntheticPareChainVerification,
): boolean {
  return evidence.stage === expected.stage && evidence.stageIndex === expected.stageIndex;
}

function matchesPareStageDigests(
  evidence: AiPareProvenanceChainEvidence,
  expected: AiSyntheticPareChainVerification,
  outputDigest: string,
): boolean {
  return evidence.inputDigest === expected.inputDigest && evidence.outputDigest === outputDigest;
}

function matchesParePriorRecords(
  evidence: AiPareProvenanceChainEvidence,
  expected: AiSyntheticPareChainVerification,
): boolean {
  return JSON.stringify(evidence.priorAuditIds) === JSON.stringify(expected.priorRecords.map((record) => record.auditId)) &&
    JSON.stringify(evidence.priorOutputDigests) === JSON.stringify(expected.priorRecords.map((record) => record.outputDigest));
}

function matchesPareChainEvidence(
  evidence: AiPareProvenanceChainEvidence,
  expected: AiSyntheticPareChainVerification,
  outputDigest: string,
): boolean {
  return matchesPareChainIdentity(evidence, expected) &&
    matchesPareStageIdentity(evidence, expected) &&
    matchesPareStageDigests(evidence, expected, outputDigest) &&
    matchesParePriorRecords(evidence, expected);
}

function completePareChainStage(
  state: SyntheticPareChainState,
  rawEvidence: unknown,
  output: unknown,
): boolean {
  const parsedEvidence = aiPareProvenanceChainEvidenceSchema.safeParse(rawEvidence);
  const outputDigest = digestJsonOrNull(output);
  if (!parsedEvidence.success || !outputDigest) return false;
  const evidence = parsedEvidence.data;
  const expected = state.pending.get(evidence.stage);
  if (!expected || !matchesPareChainEvidence(evidence, expected, outputDigest)) return false;
  state.completed.set(evidence.stage, evidence);
  state.pending.delete(evidence.stage);
  return true;
}

/** Only exact, server-owned fixtures can be certified synthetic. */
export class SyntheticFixtureRegistry implements AiSyntheticProvenanceVerifier {
  async verify(input: unknown): Promise<AiSyntheticProvenance | null> {
    const digest = digestJsonOrNull(input);
    if (!digest) return null;
    const registered = registeredDigests.get(digest);
    return registered ? { ...registered, verifiedAt: new Date().toISOString() } : null;
  }

  async beginPareChain(input: unknown, correlationId: string): Promise<AiSyntheticPareChain | null> {
    const root = pareContextSchema.safeParse(input);
    if (!root.success || root.data.triggerId !== correlationId) return null;
    const rootDigest = digestJsonOrNull(root.data);
    if (!rootDigest || rootDigest !== digestJson(SYNTHETIC_PARE_CHAIN_ROOT_FIXTURE)) return null;
    const provenance = await this.verify(root.data);
    if (!provenance || provenance.sourceId !== pareChainRootProvenance.sourceId) return null;

    const state: SyntheticPareChainState = {
      correlationId,
      rootDigest,
      provenance,
      chainId: `pare_${randomUUID()}`,
      completed: new Map(),
      pending: new Map(),
    };
    const chain: AiSyntheticPareChain = {
      verifyStage: async (stageInput, useCaseId, stageCorrelationId) =>
        verifyPareChainStage(state, stageInput, useCaseId, stageCorrelationId),
      completeStage: (rawEvidence, output) => completePareChainStage(state, rawEvidence, output),
    };
    return chain;
  }
}
