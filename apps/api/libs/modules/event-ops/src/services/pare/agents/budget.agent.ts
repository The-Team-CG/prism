import type { PAREBudgetAnalysis, PARECandidate, PAREContext } from '../pare.types';

// ─── Mock fallback ────────────────────────────────────────────────────────────

function mockAnalysis(ctx: PAREContext, candidate: PARECandidate): PAREBudgetAnalysis {
  const costDelta = candidate.quotedAmount - ctx.withdrawnSupplier.quotedAmount;
  const feasible = candidate.quotedAmount === 0 || costDelta <= ctx.remainingBudget;
  const costDeltaLabel =
    costDelta === 0
      ? 'same cost as withdrawn supplier'
      : costDelta > 0
        ? `₱${Math.abs(costDelta).toLocaleString()} over withdrawn quote`
        : `₱${Math.abs(costDelta).toLocaleString()} under withdrawn quote (savings)`;

  const summary =
    candidate.quotedAmount === 0
      ? `${candidate.supplierName} has no quote on file. A new quote request is recommended before final confirmation.`
      : feasible
        ? `${candidate.supplierName} is within budget at ₱${candidate.quotedAmount.toLocaleString()} (${costDeltaLabel}).`
        : `${candidate.supplierName} at ₱${candidate.quotedAmount.toLocaleString()} exceeds available budget (${costDeltaLabel}). Escalate to Ms. Mys.`;

  return { feasible, selectedCandidate: candidate, costDelta, costDeltaLabel, summary };
}

// ─── Tool definitions for Claude ─────────────────────────────────────────────

const BUDGET_TOOLS = [
  {
    name: 'get_event_budget_summary',
    description: 'Returns the total spent budget and remaining budget for the event based on all selected supplier quotes.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_quote_details',
    description: 'Returns the quoted amount, payment terms, and inclusions for a specific supplier candidate.',
    input_schema: {
      type: 'object' as const,
      properties: {
        supplierName: { type: 'string', description: 'Name of the supplier candidate' },
      },
      required: ['supplierName'],
    },
  },
  {
    name: 'submit_budget_analysis',
    description: 'Submit the final budget feasibility analysis after reviewing all available data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        feasible: { type: 'boolean', description: 'Whether the replacement is within budget' },
        costDelta: { type: 'number', description: 'Cost difference vs withdrawn supplier (negative = savings)' },
        costDeltaLabel: { type: 'string', description: 'Human-readable cost delta description' },
        summary: { type: 'string', description: 'One or two sentence budget summary for the PMCM Admin' },
      },
      required: ['feasible', 'costDelta', 'costDeltaLabel', 'summary'],
    },
  },
] as const;

// ─── Live tool executor ───────────────────────────────────────────────────────

function executeBudgetTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: PAREContext,
): string {
  if (toolName === 'get_event_budget_summary') {
    return JSON.stringify({
      eventName: ctx.eventName,
      totalBudget: ctx.totalBudget,
      spentBudget: ctx.spentBudget,
      remainingBudget: ctx.remainingBudget,
      withdrawnSupplierQuote: ctx.withdrawnSupplier.quotedAmount,
      withdrawnSupplierName: ctx.withdrawnSupplier.name,
    });
  }
  if (toolName === 'get_quote_details') {
    const name = String(input['supplierName'] ?? '').toLowerCase();
    const candidate = (ctx.candidates ?? []).find(
      (c) => c.supplierName.toLowerCase().includes(name),
    );
    if (!candidate) return JSON.stringify({ error: `No candidate found matching "${input['supplierName']}"` });
    return JSON.stringify({
      supplierName: candidate.supplierName,
      tier: candidate.tier,
      quotedAmount: candidate.quotedAmount,
      reliabilityScore: candidate.reliabilityScore,
      halal: candidate.halal,
      priorPmcmEvents: candidate.priorPmcmEvents,
      reason: candidate.reason,
    });
  }
  return JSON.stringify({ error: `Unknown tool: ${toolName}` });
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class BudgetAgent {
  constructor(private readonly mode: 'mock' | 'live' = 'mock') {}

  async run(ctx: PAREContext): Promise<PAREBudgetAnalysis> {
    const top = (ctx.candidates ?? [])[0];
    if (!top) {
      return {
        feasible: false,
        selectedCandidate: {
          supplierId: '', supplierName: 'No candidate found', tier: 'unknown',
          quotedAmount: 0, reliabilityScore: 0, halal: false, priorPmcmEvents: 0,
          reason: 'No available replacement suppliers found in the same category.',
        },
        costDelta: 0,
        costDeltaLabel: 'N/A',
        summary: 'No replacement candidates available for this category.',
      };
    }

    if (this.mode === 'live') {
      return this.runWithClaude(ctx, top);
    }
    return mockAnalysis(ctx, top);
  }

  private async runWithClaude(ctx: PAREContext, top: PARECandidate): Promise<PAREBudgetAnalysis> {
    // Dynamic import — only loads when live mode is active and SDK is installed
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `You are the Budget Analysis agent for P.R.I.S.M, an event management system.
A supplier emergency has occurred and you must assess whether the recommended replacement supplier is financially feasible.
Use the available tools to gather budget and quote data, then submit your analysis via submit_budget_analysis.
Be concise and practical. You are advising PMCM Admin (Ms. Mys) who needs a fast, clear answer.`;

    const userPrompt = `Emergency supplier replacement needed for event: ${ctx.eventName} (${ctx.daysUntilEvent} days away).
Withdrawn supplier: ${ctx.withdrawnSupplier.name} (${ctx.withdrawnSupplier.category}, ₱${ctx.withdrawnSupplier.quotedAmount.toLocaleString()})
Top replacement candidate: ${top.supplierName} (${top.tier}, quoted ₱${top.quotedAmount.toLocaleString()})
Other candidates available: ${(ctx.candidates ?? []).slice(1).map((c) => c.supplierName).join(', ') || 'none'}

Please check the event budget and quote details, then submit your budget feasibility analysis.`;

    const messages: any[] = [{ role: 'user', content: userPrompt }];

    // Agentic tool-use loop — Claude calls tools until it submits final analysis
    for (let i = 0; i < 6; i++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        tools: BUDGET_TOOLS as any,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') break;

      if (response.stop_reason === 'tool_use') {
        const toolResults: any[] = [];
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          if (block.name === 'submit_budget_analysis') {
            const input = block.input as any;
            return {
              feasible: input.feasible,
              selectedCandidate: top,
              costDelta: input.costDelta,
              costDeltaLabel: input.costDeltaLabel,
              summary: input.summary,
            };
          }

          const result = executeBudgetTool(block.name, block.input as Record<string, unknown>, ctx);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        }
        if (toolResults.length > 0) {
          messages.push({ role: 'user', content: toolResults });
        }
      }
    }

    // Fallback if Claude never submitted
    return mockAnalysis(ctx, top);
  }
}
