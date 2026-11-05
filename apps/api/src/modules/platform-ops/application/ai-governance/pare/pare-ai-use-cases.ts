import {
  pareBudgetAnalysisSchema,
  pareCandidateSchema,
  pareContextSchema,
  pareDraftsSchema,
  pareRiskSchema,
} from '@prism/types';
import type { AiToolHandler, AiUseCaseRegistry } from '../../../contracts/ai-governance/ai-gateway.port';
import type { PAREContext } from './pare.types';
import { MASKED_CANDIDATE_REASON } from './pare-model-view';

const privateDataClasses = ['internal', 'personal'] as const;
const emptyInputSchema = pareContextSchema.pick({}).strict();
const supplierNameInputSchema = pareCandidateSchema.pick({ supplierName: true }).strict();

const MASKED_IDENTITY_NOTE = [
  'Identities are masked: replacement suppliers are named Candidate 1, Candidate 2 and so on in ranked order, and the client, event and withdrawn supplier names are placeholders.',
  'Refer to suppliers only as Candidate N and never guess a real name.',
].join(' ');

/**
 * PARE hands the model a masked view (see pare-model-view.ts). The gateway keeps a candidate name or id
 * only when it is one of those aliases, so a raw supplier name or id is still flattened.
 */
const CANDIDATE_ALIAS_KEYS = {
  supplierName: /^Candidate \d+$/,
  supplierId: /^candidate-\d+$/,
  reason: new RegExp('^' + MASKED_CANDIDATE_REASON + '$'),
} as const;

/** Free text the model needs: client preferences, and the analysis the earlier stages wrote. */
const PREFERENCE_TEXT_KEYS = ['clientPreferences'] as const;
const ANALYSIS_TEXT_KEYS = ['summary', 'costDeltaLabel', 'factors', 'recommendation'] as const;

export const PARE_AI_USE_CASES = {
  'pare.budget': {
    id: 'pare.budget',
    promptVersion: 'pare-budget-v3',
    systemPrompt: [
      'Use case: pare.budget.',
      'You are the P.R.I.S.M supplier replacement budget analyst.',
      'Assess the candidate against the event budget.',
      'Use read-only tools when useful. Never claim a supplier was selected or contacted.',
      'The PMCM approver makes every decision.',
      MASKED_IDENTITY_NOTE,
      'Return only a JSON object with feasible, selectedCandidate, costDelta, costDeltaLabel, and summary. Copy all selectedCandidate fields from the supplied candidate. Do not add markdown or prose outside the JSON object.',
    ].join(' '),
    inputSchema: pareContextSchema,
    outputSchema: pareBudgetAnalysisSchema,
    modelTier: 'strong',
    dataClasses: privateDataClasses,
    requiresZdr: true,
    approval: 'pmcm-required',
    limits: { maxSteps: 6, maxOutputTokens: 1024, timeoutMs: 60_000, dailyTokenBudget: 50_000 },
    delivery: 'run',
    freeTextKeys: [...PREFERENCE_TEXT_KEYS],
    aliasKeys: CANDIDATE_ALIAS_KEYS,
  },
  'pare.risk': {
    id: 'pare.risk',
    promptVersion: 'pare-risk-v3',
    systemPrompt: [
      'Use case: pare.risk.',
      'You are the P.R.I.S.M supplier replacement risk assessor.',
      'Assess timeline, client preferences, and the recommended replacement.',
      'Use read-only tools when useful.',
      'The PMCM approver makes every decision.',
      MASKED_IDENTITY_NOTE,
      'Return only a JSON object with level (LOW, MEDIUM, or HIGH), factors (a string array), and recommendation (a string). Do not add markdown or prose outside the JSON object.',
    ].join(' '),
    inputSchema: pareContextSchema,
    outputSchema: pareRiskSchema,
    modelTier: 'strong',
    dataClasses: privateDataClasses,
    requiresZdr: true,
    approval: 'pmcm-required',
    limits: { maxSteps: 8, maxOutputTokens: 1024, timeoutMs: 90_000, dailyTokenBudget: 50_000 },
    delivery: 'run',
    freeTextKeys: [...PREFERENCE_TEXT_KEYS],
    aliasKeys: CANDIDATE_ALIAS_KEYS,
  },
  'pare.message-drafts': {
    id: 'pare.message-drafts',
    promptVersion: 'pare-message-drafts-v3',
    systemPrompt: [
      'Use case: pare.message-drafts.',
      'You draft supplier and client messages for P.R.I.S.M supplier replacement review.',
      'Use a professional, reassuring tone. Avoid claiming any message was sent.',
      'PMCM must approve before any sending.',
      MASKED_IDENTITY_NOTE,
      'Names are masked, so write [Client name] and [Supplier name] wherever a real name belongs; PMCM fills them in before anything is sent.',
      'Return only a JSON object with supplierNotification and clientReassurance as string fields. Encode paragraph breaks inside those strings. Do not add markdown or prose outside the JSON object.',
    ].join(' '),
    inputSchema: pareContextSchema,
    outputSchema: pareDraftsSchema,
    modelTier: 'fast',
    dataClasses: privateDataClasses,
    requiresZdr: true,
    approval: 'pmcm-required',
    limits: { maxSteps: 6, maxOutputTokens: 2048, timeoutMs: 60_000, dailyTokenBudget: 50_000 },
    delivery: 'run',
    freeTextKeys: [...PREFERENCE_TEXT_KEYS, ...ANALYSIS_TEXT_KEYS],
    aliasKeys: CANDIDATE_ALIAS_KEYS,
  },
} satisfies Pick<AiUseCaseRegistry, 'pare.budget' | 'pare.risk' | 'pare.message-drafts'>;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('PARE execution aborted');
  }
}

export function createPareBudgetToolHandlers(ctx: PAREContext): readonly AiToolHandler[] {
  return [
    {
      name: 'get_event_budget_summary',
      description: 'Read the event budget and selected supplier quote totals.',
      inputSchema: emptyInputSchema,
      execute: async (_input, signal) => {
        throwIfAborted(signal);
        return JSON.stringify({
          eventName: ctx.eventName,
          totalBudget: ctx.totalBudget,
          spentBudget: ctx.spentBudget,
          remainingBudget: ctx.remainingBudget,
          withdrawnSupplierQuote: ctx.withdrawnSupplier.quotedAmount,
          withdrawnSupplierName: ctx.withdrawnSupplier.name,
        });
      },
    },
    {
      name: 'get_quote_details',
      description: 'Read the quote and reliability details for a named replacement candidate.',
      inputSchema: supplierNameInputSchema,
      execute: async ({ supplierName }, signal) => {
        throwIfAborted(signal);
        const candidate = (ctx.candidates ?? []).find(
          (item) => item.supplierName.toLowerCase() === supplierName.toLowerCase(),
        );
        if (!candidate) return JSON.stringify({ error: 'Supplier candidate not found' });
        return JSON.stringify({
          supplierName: candidate.supplierName,
          tier: candidate.tier,
          quotedAmount: candidate.quotedAmount,
          reliabilityScore: candidate.reliabilityScore,
          halal: candidate.halal,
          priorPmcmEvents: candidate.priorPmcmEvents,
          reason: candidate.reason,
        });
      },
    },
  ];
}

export function createPareRiskToolHandlers(ctx: PAREContext): readonly AiToolHandler[] {
  return [
    {
      name: 'get_supplier_history',
      description: 'Read reliability, prior PMCM events, and notes for a replacement candidate.',
      inputSchema: supplierNameInputSchema,
      execute: async ({ supplierName }, signal) => {
        throwIfAborted(signal);
        const candidate = (ctx.candidates ?? []).find(
          (item) => item.supplierName.toLowerCase() === supplierName.toLowerCase(),
        );
        if (!candidate) return JSON.stringify({ error: 'Supplier candidate not found' });
        return JSON.stringify({
          supplierName: candidate.supplierName,
          tier: candidate.tier,
          reliabilityScore: candidate.reliabilityScore,
          priorPmcmEvents: candidate.priorPmcmEvents,
          halal: candidate.halal,
          notes: candidate.reason,
        });
      },
    },
    {
      name: 'get_event_timeline',
      description: 'Read event timing and urgency.',
      inputSchema: emptyInputSchema,
      execute: async (_input, signal) => {
        throwIfAborted(signal);
        return JSON.stringify({
          eventName: ctx.eventName,
          eventDate: ctx.eventDate,
          daysUntilEvent: ctx.daysUntilEvent,
          urgency: ctx.daysUntilEvent <= 7 ? 'CRITICAL' : ctx.daysUntilEvent <= 21 ? 'HIGH' : 'NORMAL',
        });
      },
    },
    {
      name: 'get_client_preferences',
      description: 'Read client requirements relevant to the replacement.',
      inputSchema: emptyInputSchema,
      execute: async (_input, signal) => {
        throwIfAborted(signal);
        return JSON.stringify({
          clientName: ctx.clientName,
          preferences: ctx.clientPreferences.length > 0
            ? ctx.clientPreferences
            : ['No special preferences recorded'],
        });
      },
    },
  ];
}

export function createPareMessageDraftToolHandlers(ctx: PAREContext): readonly AiToolHandler[] {
  return [
    {
      name: 'get_event_and_replacement_summary',
      description: 'Read event, supplier, budget, risk, and client preference details for drafting.',
      inputSchema: emptyInputSchema,
      execute: async (_input, signal) => {
        throwIfAborted(signal);
        const replacement = ctx.budgetAnalysis?.selectedCandidate;
        return JSON.stringify({
          event: {
            name: ctx.eventName,
            date: ctx.eventDate,
            daysAway: ctx.daysUntilEvent,
            clientName: ctx.clientName,
            clientPreferences: ctx.clientPreferences,
          },
          withdrawnSupplier: {
            name: ctx.withdrawnSupplier.name,
            category: ctx.withdrawnSupplier.category,
            tier: ctx.withdrawnSupplier.tier,
          },
          recommendedReplacement: replacement
            ? {
                name: replacement.supplierName,
                tier: replacement.tier,
                reliabilityScore: replacement.reliabilityScore,
                priorPmcmEvents: replacement.priorPmcmEvents,
                halal: replacement.halal,
                quotedAmount: replacement.quotedAmount,
              }
            : null,
          riskLevel: ctx.riskAssessment?.level ?? 'UNKNOWN',
          budgetFeasible: ctx.budgetAnalysis?.feasible ?? null,
          budgetSummary: ctx.budgetAnalysis?.summary ?? null,
        });
      },
    },
  ];
}
