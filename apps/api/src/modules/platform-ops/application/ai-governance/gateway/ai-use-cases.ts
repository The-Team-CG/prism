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
    systemPrompt: [
      'Use case: comms.draft.',
      'Write a concise, courteous PMCM reminder for a client with an accepted inquiry and an unsigned conforme sent at least five days ago.',
      'The request contains no client or event details. Do not invent names, event details, dates, amounts, deadlines, prior contact, or responses.',
      'Ask the client to review and sign the conforme when convenient, and direct questions to their PMCM coordinator.',
      'Do not claim the message has been sent. Return only JSON with subject and body.',
    ].join(' '),
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
