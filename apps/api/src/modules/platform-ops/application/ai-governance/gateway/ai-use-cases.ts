import {
  commsDraftRequestSchema,
  commsDraftResultSchema,
  pareBudgetAnalysisSchema,
  pareContextSchema,
  pareDraftsSchema,
  pareRiskSchema,
} from '@prism/types';
import type { AiUseCaseRegistry } from '../../../contracts/ai-governance/ai-gateway.port';

const LIMITS = {
  maxSteps: 4,
  maxOutputTokens: 900,
  timeoutMs: 30_000,
  dailyTokenBudget: 30_000,
} as const;

const PARE_DATA_CLASSES = ['internal', 'personal', 'synthetic'] as const;

export const AI_USE_CASE_REGISTRY: AiUseCaseRegistry = {
  'pare.budget': {
    id: 'pare.budget',
    promptVersion: 'pare-budget-v1',
    systemPrompt: 'Use case: pare.budget. Return only the JSON output object.',
    inputSchema: pareContextSchema,
    outputSchema: pareBudgetAnalysisSchema,
    modelTier: 'fast',
    dataClasses: PARE_DATA_CLASSES,
    requiresZdr: true,
    approval: 'pmcm-required',
    limits: LIMITS,
    delivery: 'run',
  },
  'pare.risk': {
    id: 'pare.risk',
    promptVersion: 'pare-risk-v1',
    systemPrompt: 'Use case: pare.risk. Return only the JSON output object.',
    inputSchema: pareContextSchema,
    outputSchema: pareRiskSchema,
    modelTier: 'fast',
    dataClasses: PARE_DATA_CLASSES,
    requiresZdr: true,
    approval: 'pmcm-required',
    limits: LIMITS,
    delivery: 'run',
  },
  'pare.message-drafts': {
    id: 'pare.message-drafts',
    promptVersion: 'pare-message-drafts-v1',
    systemPrompt: 'Use case: pare.message-drafts. Return only the JSON output object.',
    inputSchema: pareContextSchema,
    outputSchema: pareDraftsSchema,
    modelTier: 'fast',
    dataClasses: PARE_DATA_CLASSES,
    requiresZdr: true,
    approval: 'pmcm-required',
    limits: LIMITS,
    delivery: 'run',
  },
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
