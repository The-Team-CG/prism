import type { PARERisk, PARERiskLevel, PAREContext } from '../pare.types';

// ─── Mock fallback ────────────────────────────────────────────────────────────

function mockRisk(ctx: PAREContext): PARERisk {
  const factors: string[] = [];
  let score = 0;

  if (ctx.daysUntilEvent <= 7) {
    factors.push(`Critical timeline: event is in ${ctx.daysUntilEvent} day(s)`);
    score += 3;
  } else if (ctx.daysUntilEvent <= 21) {
    factors.push(`Short timeline: event is in ${ctx.daysUntilEvent} days`);
    score += 2;
  } else {
    factors.push(`Adequate timeline: event is in ${ctx.daysUntilEvent} days`);
  }

  const top = ctx.candidates?.[0];
  if (!top) {
    factors.push('No replacement candidates found — high operational risk');
    score += 4;
  } else {
    if (top.tier === 'tier_3') { factors.push(`Replacement is Tier 3 (${top.supplierName}) — unproven`); score += 2; }
    else if (top.tier === 'tier_2') { factors.push(`Replacement is Tier 2 (${top.supplierName}) — previously worked with PMCM`); score += 1; }
    else { factors.push(`Replacement is Tier 1 (${top.supplierName}) — preferred partner`); }
    if (top.quotedAmount === 0) { factors.push('No quote on file — pricing unconfirmed'); score += 1; }
    if (top.priorPmcmEvents === 0) { factors.push('No prior events with PMCM — first booking'); score += 1; }
    if (top.reliabilityScore < 0.6) { factors.push(`Low reliability score (${top.reliabilityScore})`); score += 1; }
  }

  const halal = ctx.clientPreferences.some((p) => p.toLowerCase().includes('halal'));
  if (halal && top && !top.halal) {
    factors.push('Client requires halal — replacement is NOT halal-certified');
    score += 2;
  }

  const level: PARERiskLevel = score >= 5 ? 'HIGH' : score >= 3 ? 'MEDIUM' : 'LOW';
  const recommendation =
    level === 'HIGH'
      ? 'Escalate to Ms. Mys immediately. Do not confirm without her explicit sign-off.'
      : level === 'MEDIUM'
        ? 'Proceed with caution. Confirm details and brief client before finalizing.'
        : 'Proceed with replacement. Standard confirmation and readiness check apply.';

  return { level, factors, recommendation };
}

// ─── Tool definitions for Claude ─────────────────────────────────────────────

const RISK_TOOLS = [
  {
    name: 'get_supplier_history',
    description: 'Returns the reliability score, prior PMCM events, review history, and any complaints for a supplier candidate.',
    input_schema: {
      type: 'object' as const,
      properties: {
        supplierName: { type: 'string', description: 'Name of the supplier to check' },
      },
      required: ['supplierName'],
    },
  },
  {
    name: 'get_event_timeline',
    description: 'Returns days until the event and any time-sensitive milestones.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_client_preferences',
    description: 'Returns any special client requirements such as dietary restrictions, style preferences, or certifications needed.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'submit_risk_assessment',
    description: 'Submit the final risk assessment after reviewing all relevant data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        level: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], description: 'Overall risk level' },
        factors: { type: 'array', items: { type: 'string' }, description: 'List of specific risk factors identified' },
        recommendation: { type: 'string', description: 'One or two sentence action recommendation for PMCM Admin' },
      },
      required: ['level', 'factors', 'recommendation'],
    },
  },
] as const;

// ─── Live tool executor ───────────────────────────────────────────────────────

function executeRiskTool(toolName: string, input: Record<string, unknown>, ctx: PAREContext): string {
  if (toolName === 'get_supplier_history') {
    const name = String(input['supplierName'] ?? '').toLowerCase();
    const candidate = (ctx.candidates ?? []).find((c) => c.supplierName.toLowerCase().includes(name));
    if (!candidate) return JSON.stringify({ error: `No candidate matching "${input['supplierName']}"` });
    return JSON.stringify({
      supplierName: candidate.supplierName,
      tier: candidate.tier,
      reliabilityScore: candidate.reliabilityScore,
      priorPmcmEvents: candidate.priorPmcmEvents,
      halal: candidate.halal,
      notes: candidate.reason,
    });
  }
  if (toolName === 'get_event_timeline') {
    return JSON.stringify({
      eventName: ctx.eventName,
      eventDate: ctx.eventDate,
      daysUntilEvent: ctx.daysUntilEvent,
      urgency: ctx.daysUntilEvent <= 7 ? 'CRITICAL' : ctx.daysUntilEvent <= 21 ? 'HIGH' : 'NORMAL',
    });
  }
  if (toolName === 'get_client_preferences') {
    return JSON.stringify({
      clientName: ctx.clientName,
      preferences: ctx.clientPreferences.length > 0 ? ctx.clientPreferences : ['No special preferences recorded'],
    });
  }
  return JSON.stringify({ error: `Unknown tool: ${toolName}` });
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class RiskAgent {
  constructor(private readonly mode: 'mock' | 'live' = 'mock') {}

  async runPareRiskAgent(ctx: PAREContext): Promise<PARERisk> {
    if (this.mode === 'live') return this.runWithClaude(ctx);
    return mockRisk(ctx);
  }

  private async runWithClaude(ctx: PAREContext): Promise<PARERisk> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `You are the Risk Assessment agent for P.R.I.S.M, an event management system.
A supplier emergency has occurred. You MUST assess operational risk using the tools provided.
You MUST NOT respond in prose. Every response must be a tool call.
Step 1: call get_event_timeline to check urgency.
Step 2: call get_client_preferences to check special requirements.
Step 3: call get_supplier_history for the recommended replacement.
Step 4: call submit_risk_assessment with your final verdict (LOW, MEDIUM, or HIGH).
Be direct — PMCM Admin needs a clear risk level and actionable recommendation.`;

    const top = ctx.candidates?.[0];
    const userPrompt = `Emergency supplier replacement for: ${ctx.eventName}
Withdrawn: ${ctx.withdrawnSupplier.name} (${ctx.withdrawnSupplier.category}, ${ctx.withdrawnSupplier.tier})
Recommended replacement: ${top?.supplierName ?? 'none found'} (${top?.tier ?? 'unknown'})
Budget analysis: ${ctx.budgetAnalysis?.summary ?? 'not yet assessed'}

Call get_event_timeline, get_client_preferences, get_supplier_history, then submit_risk_assessment.`;

    const messages: any[] = [{ role: 'user', content: userPrompt }];

    for (let i = 0; i < 8; i++) {
      const isLastChance = i >= 6;
      const tool_choice = isLastChance
        ? { type: 'tool' as const, name: 'submit_risk_assessment' }
        : { type: 'any' as const };

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        tools: RISK_TOOLS as any,
        tool_choice,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'tool_use') {
        const toolResults: any[] = [];
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          if (block.name === 'submit_risk_assessment') {
            const input = block.input as any;
            return {
              level: input.level as PARERiskLevel,
              factors: input.factors as string[],
              recommendation: input.recommendation as string,
            };
          }

          const result = executeRiskTool(block.name, block.input as Record<string, unknown>, ctx);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        }
        if (toolResults.length > 0) {
          messages.push({ role: 'user', content: toolResults });
        }
      }
    }

    return mockRisk(ctx);
  }
}
