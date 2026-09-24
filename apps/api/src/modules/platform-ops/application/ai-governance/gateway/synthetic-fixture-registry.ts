import { createHash } from 'node:crypto';
import {
  pareContextSchema,
  type AiSyntheticProvenance,
} from '@prism/types';
import type { AiSyntheticProvenanceVerifier } from '../../../contracts/ai-governance/ai-gateway.port';

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

export const SYNTHETIC_COMMS_REQUEST_FIXTURE = {
  inquiryId: 'ai-fixture-inquiry-v1',
} as const;

export const SYNTHETIC_TOOL_RESULT_FIXTURE = {
  status: 'synthetic-result-v1',
  message: 'Synthetic tool result',
} as const;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const registeredDigests = new Map<string, Omit<AiSyntheticProvenance, 'verifiedAt'>>([
  [
    createHash('sha256').update(canonicalJson(SYNTHETIC_PARE_CONTEXT_FIXTURE)).digest('hex'),
    {
      source: 'test-fixture',
      sourceId: 'ai-pare-context-v1',
      verifier: 'test-fixture-registry',
    },
  ],
  [
    createHash('sha256').update(canonicalJson(SYNTHETIC_COMMS_REQUEST_FIXTURE)).digest('hex'),
    {
      source: 'test-fixture',
      sourceId: 'ai-comms-inquiry-v1',
      verifier: 'test-fixture-registry',
    },
  ],
  [
    createHash('sha256').update(canonicalJson(SYNTHETIC_TOOL_RESULT_FIXTURE)).digest('hex'),
    {
      source: 'test-fixture',
      sourceId: 'ai-tool-result-v1',
      verifier: 'test-fixture-registry',
    },
  ],
]);

/** Only exact, server-owned fixtures can be certified synthetic. */
export class SyntheticFixtureRegistry implements AiSyntheticProvenanceVerifier {
  async verify(input: unknown): Promise<AiSyntheticProvenance | null> {
    let digest: string;
    try {
      digest = createHash('sha256').update(canonicalJson(input)).digest('hex');
    } catch {
      return null;
    }
    const registered = registeredDigests.get(digest);
    return registered ? { ...registered, verifiedAt: new Date().toISOString() } : null;
  }
}
