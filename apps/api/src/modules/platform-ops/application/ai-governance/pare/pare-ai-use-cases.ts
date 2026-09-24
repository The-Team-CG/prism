import {
  pareBudgetAnalysisSchema,
  pareCandidateSchema,
  pareContextSchema,
  pareDraftsSchema,
  pareRiskSchema,
} from '@prism/types';
import type { AiToolHandler, AiUseCaseRegistry } from '../../../contracts/ai-governance/ai-gateway.port';
import type { PAREContext } from './pare.types';

const privateDataClasses = ['internal', 'personal'] as const;
const emptyInputSchema = pareContextSchema.pick({}).strict();
const supplierNameInputSchema = pareCandidateSchema.pick({ supplierName: true }).strict();

export const PARE_AI_USE_CASES = {
  'pare.budget': {
    id: 'pare.budget',
    promptVersion: 'pare-budget-v1',
    systemPrompt: [
      'You are the P.R.I.S.M supplier replacement budget analyst.',
      'Assess the candidate against the event budget and return only the structured analysis.',
      'Use read-only tools when useful. Never claim a supplier was selected or contacted.',
      'The PMCM approver makes every decision.',
    ].join(' '),
    inputSchema: pareContextSchema,
    outputSchema: pareBudgetAnalysisSchema,
    modelTier: 'strong',
    dataClasses: privateDataClasses,
    requiresZdr: true,
    approval: 'pmcm-required',
    limits: { maxSteps: 6, maxOutputTokens: 1024, timeoutMs: 30_000, dailyTokenBudget: 50_000 },
    delivery: 'run',
  },
  'pare.risk': {
    id: 'pare.risk',
    promptVersion: 'pare-risk-v1',
    systemPrompt: [
      'You are the P.R.I.S.M supplier replacement risk assessor.',
      'Assess timeline, client preferences, and the recommended replacement.',
      'Use read-only tools when useful and return only the structured assessment.',
      'The PMCM approver makes every decision.',
    ].join(' '),
    inputSchema: pareContextSchema,
    outputSchema: pareRiskSchema,
    modelTier: 'strong',
    dataClasses: privateDataClasses,
    requiresZdr: true,
    approval: 'pmcm-required',
    limits: { maxSteps: 8, maxOutputTokens: 1024, timeoutMs: 30_000, dailyTokenBudget: 50_000 },
    delivery: 'run',
  },
  'pare.message-drafts': {
    id: 'pare.message-drafts',
    promptVersion: 'pare-message-drafts-v1',
    systemPrompt: [
      'You draft supplier and client messages for P.R.I.S.M supplier replacement review.',
      'Use a professional, reassuring tone. Avoid claiming any message was sent.',
      'Return both drafts as structured output; PMCM must approve before any sending.',
    ].join(' '),
    inputSchema: pareContextSchema,
    outputSchema: pareDraftsSchema,
    modelTier: 'fast',
    dataClasses: privateDataClasses,
    requiresZdr: true,
    approval: 'pmcm-required',
    limits: { maxSteps: 6, maxOutputTokens: 2048, timeoutMs: 30_000, dailyTokenBudget: 50_000 },
    delivery: 'run',
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
