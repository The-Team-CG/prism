import type { PAREDrafts, PAREContext } from '../pare.types';

// ─── Mock fallback ────────────────────────────────────────────────────────────

function mockDrafts(ctx: PAREContext): PAREDrafts {
  const replacement = ctx.budgetAnalysis?.selectedCandidate;
  const replacementName = replacement?.supplierName ?? 'a qualified replacement supplier';
  const replacementTier = replacement?.tier?.replace('tier_', 'Tier ') ?? 'Tier 2';

  const supplierNotification = `Dear ${replacementName} Team,

We are reaching out regarding an urgent assignment opportunity for an upcoming PMCM-managed event.

Event: ${ctx.eventName}
Date: ${ctx.eventDate}
Category Required: ${ctx.withdrawnSupplier.category}

Due to an unforeseen change with our previously assigned ${ctx.withdrawnSupplier.category} supplier, we would like to offer you this engagement. Based on your track record and our records, you are our recommended replacement for this event.

Please confirm your availability and readiness at the earliest opportunity. Our team will follow up with full briefing details and contract terms upon your confirmation.

We value your partnership with PMCM Events and look forward to working with you.

Warm regards,
PMCM Events Coordination Team`.trim();

  const clientReassurance = `Dear ${ctx.clientName},

We are writing to update you regarding your upcoming event, ${ctx.eventName}, on ${ctx.eventDate}.

Our originally assigned ${ctx.withdrawnSupplier.category} supplier has encountered an unforeseen circumstance and will be unable to fulfill their commitment.

We want to assure you that we have already identified a qualified ${replacementTier} replacement — ${replacementName} — who meets your event requirements and has a strong track record with PMCM-managed events. We are coordinating confirmation with them immediately.

Your event plans remain on track, and our team is actively managing this transition on your behalf. You will receive a full update as soon as the replacement is confirmed.

If you have any questions, please do not hesitate to reach out to your PMCM coordinator.

Sincerely,
PMCM Events Management`.trim();

  return { supplierNotification, clientReassurance };
}

// ─── Tool definitions for Claude ─────────────────────────────────────────────

const DRAFTER_TOOLS = [
  {
    name: 'get_event_and_replacement_summary',
    description: 'Returns full event details, withdrawn supplier info, recommended replacement details, risk level, and any client preferences needed for drafting messages.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'submit_message_drafts',
    description: 'Submit the final drafted messages. Both messages will be shown to PMCM Admin for review before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        supplierNotification: {
          type: 'string',
          description: 'Professional message to the replacement supplier offering them the assignment. Should be warm, clear, and urgent but not alarming.',
        },
        clientReassurance: {
          type: 'string',
          description: 'Professional message to the client informing them of the supplier change. Should be reassuring, confident, and avoid unnecessary detail about what went wrong.',
        },
      },
      required: ['supplierNotification', 'clientReassurance'],
    },
  },
] as const;

// ─── Live tool executor ───────────────────────────────────────────────────────

function executeDrafterTool(toolName: string, ctx: PAREContext): string {
  if (toolName === 'get_event_and_replacement_summary') {
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
  }
  return JSON.stringify({ error: `Unknown tool: ${toolName}` });
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class MessageDrafterAgent {
  constructor(private readonly mode: 'mock' | 'live' = 'mock') {}

  async runPareMessageDraftAgent(ctx: PAREContext): Promise<PAREDrafts> {
    if (this.mode === 'live') return this.runWithClaude(ctx);
    return mockDrafts(ctx);
  }

  private async runWithClaude(ctx: PAREContext): Promise<PAREDrafts> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `You are the Communications Drafting agent for P.R.I.S.M, an event management system run by PMCM Events (led by Ms. Mys).
A supplier emergency has occurred. You MUST NOT respond in prose. Every response must be a tool call.
Step 1: call get_event_and_replacement_summary to retrieve full event, supplier, and client context.
Step 2: call submit_message_drafts with both drafted messages.

Tone guidelines:
- Supplier message: warm, professional, urgent but not panicked. Make them feel valued and chosen.
- Client message: reassuring, confident, no unnecessary detail about what went wrong. Protect the client relationship.
- Both messages should sound like they come from a professional event coordination team, not a system.
- Do not use the word "unfortunate" or imply the situation is a disaster.

These drafts will be reviewed and approved by PMCM Admin (Ms. Mys) before sending.`;

    const userPrompt = `Draft the supplier notification and client reassurance messages for this emergency supplier replacement. Call get_event_and_replacement_summary first, then submit_message_drafts.`;

    const messages: any[] = [{ role: 'user', content: userPrompt }];

    for (let i = 0; i < 6; i++) {
      const isLastChance = i >= 4;
      const tool_choice = isLastChance
        ? { type: 'tool' as const, name: 'submit_message_drafts' }
        : { type: 'any' as const };

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        tools: DRAFTER_TOOLS as any,
        tool_choice,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'tool_use') {
        const toolResults: any[] = [];
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          if (block.name === 'submit_message_drafts') {
            const input = block.input as any;
            return {
              supplierNotification: input.supplierNotification as string,
              clientReassurance: input.clientReassurance as string,
            };
          }

          const result = executeDrafterTool(block.name, ctx);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        }
        if (toolResults.length > 0) {
          messages.push({ role: 'user', content: toolResults });
        }
      }
    }

    return mockDrafts(ctx);
  }
}
