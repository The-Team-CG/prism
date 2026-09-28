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

    const chainId = `pare_${randomUUID()}`;
    const stageIds: readonly AiUseCaseId[] = ['pare.budget', 'pare.risk', 'pare.message-drafts'];
    const completed: AiPareProvenanceChainEvidence[] = [];
    let pending: AiSyntheticPareChainVerification | undefined;

    const chain: AiSyntheticPareChain = {
      verifyStage: async (stageInput, useCaseId, stageCorrelationId) => {
        if (pending || stageCorrelationId !== correlationId || completed.length >= stageIds.length ||
          stageIds[completed.length] !== useCaseId) return null;
        const parsed = pareContextSchema.safeParse(stageInput);
        if (!parsed.success || parsed.data.triggerId !== correlationId) return null;

        const data = parsed.data;
        const { budgetAnalysis, riskAssessment, drafts, ...base } = data;
        if (digestJson(base) !== rootDigest) return null;
        const stage = stageIds[completed.length] as AiPareProvenanceChainStage;
        if ((completed.length === 0 && (budgetAnalysis || riskAssessment || drafts)) ||
          (completed.length === 1 && (!budgetAnalysis || riskAssessment || drafts)) ||
          (completed.length === 2 && (!budgetAnalysis || !riskAssessment || drafts))) return null;
        if (completed.length >= 1 && digestJson(budgetAnalysis) !== completed[0].outputDigest) return null;
        if (completed.length >= 2 && digestJson(riskAssessment) !== completed[1].outputDigest) return null;

        pending = {
          provenance: { ...provenance, verifiedAt: new Date().toISOString() },
          chainId,
          rootFixtureId: provenance.sourceId,
          rootDigest,
          stage,
          stageIndex: completed.length,
          inputDigest: digestJson(data)!,
          priorRecords: [...completed],
        };
        return pending;
      },
      completeStage: (rawEvidence, output) => {
        if (!pending) return false;
        const parsedEvidence = aiPareProvenanceChainEvidenceSchema.safeParse(rawEvidence);
        const outputDigest = digestJsonOrNull(output);
        if (!parsedEvidence.success || !outputDigest) return false;
        const evidence = parsedEvidence.data;
        const expected = pending;
        if (evidence.chainId !== expected.chainId || evidence.rootFixtureId !== expected.rootFixtureId ||
          evidence.rootDigest !== expected.rootDigest || evidence.stage !== expected.stage ||
          evidence.stageIndex !== expected.stageIndex || evidence.inputDigest !== expected.inputDigest ||
          evidence.outputDigest !== outputDigest ||
          JSON.stringify(evidence.priorAuditIds) !== JSON.stringify(expected.priorRecords.map((record) => record.auditId)) ||
          JSON.stringify(evidence.priorOutputDigests) !== JSON.stringify(expected.priorRecords.map((record) => record.outputDigest))) {
          return false;
        }
        completed.push(evidence);
        pending = undefined;
        return true;
      },
    };
    return chain;
  }
}
