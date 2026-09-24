import { describe, expect, it } from 'vitest';
import type { AiToolHandler } from '../../../contracts/ai-governance/ai-gateway.port';
import {
  createPareBudgetToolHandlers,
  createPareMessageDraftToolHandlers,
  createPareRiskToolHandlers,
} from '../pare/pare-ai-use-cases';
import {
  SyntheticFixtureRegistry,
  SYNTHETIC_COMMS_REQUEST_FIXTURE,
  SYNTHETIC_PARE_CONTEXT_FIXTURE,
  SYNTHETIC_PARE_EVALUATION_CONTEXT_FIXTURE,
  SYNTHETIC_PARE_MESSAGE_CONTEXT_FIXTURE,
  SYNTHETIC_PARE_TOOL_RESULT_FIXTURES,
} from './synthetic-fixture-registry';

async function executeTool(handlers: readonly AiToolHandler[], name: string, input: unknown): Promise<unknown> {
  const handler = handlers.find((candidate) => candidate.name === name);
  if (!handler) throw new Error(`Missing synthetic evaluation tool: ${name}`);
  const parsed = handler.inputSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid synthetic evaluation tool input: ${name}`);
  return JSON.parse(await handler.execute(parsed.data));
}

describe('synthetic evaluation fixtures', () => {
  it('binds the fixed PARE stage inputs to one server-owned provenance identity', async () => {
    const registry = new SyntheticFixtureRegistry();
    const existing = await registry.verify(SYNTHETIC_PARE_CONTEXT_FIXTURE);
    const budget = await registry.verify(SYNTHETIC_PARE_EVALUATION_CONTEXT_FIXTURE);
    const message = await registry.verify(SYNTHETIC_PARE_MESSAGE_CONTEXT_FIXTURE);
    const comms = await registry.verify(SYNTHETIC_COMMS_REQUEST_FIXTURE);

    expect(SYNTHETIC_PARE_EVALUATION_CONTEXT_FIXTURE.candidates).toHaveLength(1);
    expect(existing).toMatchObject({ source: 'test-fixture', sourceId: 'ai-pare-context-v1' });
    expect(budget).toMatchObject({ source: 'test-fixture', sourceId: 'ai-pare-evaluation-v1' });
    expect(message).toMatchObject({ source: 'test-fixture', sourceId: 'ai-pare-evaluation-v1' });
    expect(comms).toMatchObject({ source: 'test-fixture', sourceId: 'ai-comms-inquiry-v1' });
  });

  it('accepts only the exact outputs produced by the PARE fixture tools', async () => {
    const registry = new SyntheticFixtureRegistry();
    const budgetTools = createPareBudgetToolHandlers(SYNTHETIC_PARE_EVALUATION_CONTEXT_FIXTURE);
    const riskTools = createPareRiskToolHandlers(SYNTHETIC_PARE_EVALUATION_CONTEXT_FIXTURE);
    const messageTools = createPareMessageDraftToolHandlers(SYNTHETIC_PARE_MESSAGE_CONTEXT_FIXTURE);
    const cases = [
      [budgetTools, 'get_event_budget_summary', {}, SYNTHETIC_PARE_TOOL_RESULT_FIXTURES.budgetSummary],
      [budgetTools, 'get_quote_details', { supplierName: 'Supplier Y' }, SYNTHETIC_PARE_TOOL_RESULT_FIXTURES.quoteDetails],
      [riskTools, 'get_supplier_history', { supplierName: 'Supplier Y' }, SYNTHETIC_PARE_TOOL_RESULT_FIXTURES.supplierHistory],
      [riskTools, 'get_event_timeline', {}, SYNTHETIC_PARE_TOOL_RESULT_FIXTURES.eventTimeline],
      [riskTools, 'get_client_preferences', {}, SYNTHETIC_PARE_TOOL_RESULT_FIXTURES.clientPreferences],
      [messageTools, 'get_event_and_replacement_summary', {}, SYNTHETIC_PARE_TOOL_RESULT_FIXTURES.messageSummary],
    ] as const;

    for (const [handlers, name, input, expected] of cases) {
      const output = await executeTool(handlers, name, input);
      expect(output).toEqual(expected);
      expect(await registry.verify(output)).toMatchObject({ sourceId: 'ai-pare-evaluation-v1' });
    }

    expect(await registry.verify({ ...SYNTHETIC_PARE_TOOL_RESULT_FIXTURES.quoteDetails, quotedAmount: 3_001 })).toBeNull();
    expect(await registry.verify({ error: 'Supplier candidate not found' })).toBeNull();
  });
});
