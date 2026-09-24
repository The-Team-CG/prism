import {
  commsDraftRequestSchema,
  commsDraftResultSchema,
} from '@prism/types';
import type { AiUseCaseRegistry } from '../../../contracts/ai-governance/ai-gateway.port';
import { PARE_AI_USE_CASES } from '../pare/pare-ai-use-cases';

const LIMITS = {
  maxSteps: 4,
  maxOutputTokens: 900,
  timeoutMs: 30_000,
  dailyTokenBudget: 30_000,
} as const;

export const AI_USE_CASE_REGISTRY: AiUseCaseRegistry = {
  ...PARE_AI_USE_CASES,
  'comms.draft': {
    id: 'comms.draft',
    promptVersion: 'comms-draft-v1',
    systemPrompt: 'Use case: comms.draft. Return only the JSON output object.',
    inputSchema: commsDraftRequestSchema,
    outputSchema: commsDraftResultSchema,
    modelTier: 'strong',
    dataClasses: ['internal', 'personal'],
    requiresZdr: true,
    approval: 'pmcm-required',
    limits: LIMITS,
    delivery: 'stream',
  },
};
