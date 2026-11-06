import type {
  AiProviderAdapter,
  AiProviderRequest,
  AiProviderResponse,
  AiProviderStreamEvent,
} from '../../contracts/ai-governance/ai-gateway.port';

/**
 * Test-only provider adapter. It speaks as the Anthropic route (so it matches the `anthropic-*`
 * profiles and the `anthropic-direct` endpoint policy) and answers every registered use case with a
 * fixed, schema-valid reply. Production code never imports it; the runtime has no fake provider.
 */
function getInput(request: AiProviderRequest): Record<string, unknown> {
  const message = request.messages.find((candidate) => candidate.role === 'user');
  if (!message || message.role !== 'user') return {};
  try {
    return JSON.parse(message.content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function fakeOutput(request: AiProviderRequest): Record<string, unknown> {
  const input = getInput(request);
  if (request.systemPrompt.includes('pare.budget')) {
    const candidates = Array.isArray(input.candidates) ? input.candidates : [];
    const fallback = input.withdrawnSupplier as Record<string, unknown> | undefined;
    const candidate = (candidates[0] as Record<string, unknown> | undefined) ?? {
      supplierId: fallback?.id ?? 'ai-fixture-supplier-v1',
      supplierName: fallback?.name ?? 'Supplier X',
      tier: fallback?.tier ?? 'standard',
      quotedAmount: fallback?.quotedAmount ?? 0,
      reliabilityScore: 0.8,
      halal: true,
      priorPmcmEvents: 1,
      reason: 'Selected by the fake provider',
    };
    return {
      feasible: Number(candidate.quotedAmount ?? 0) <= Number(input.remainingBudget ?? 0),
      selectedCandidate: candidate,
      costDelta: 0,
      costDeltaLabel: 'No modeled cost change',
      summary: 'Fake provider recommendation; PMCM review required.',
    };
  }
  if (request.systemPrompt.includes('pare.risk')) {
    return { level: 'LOW', factors: [], recommendation: 'Review this fake result before approval.' };
  }
  if (request.systemPrompt.includes('pare.message-drafts')) {
    return {
      supplierNotification: 'Please review the proposed supplier update.',
      clientReassurance: 'Please review the proposed client update.',
    };
  }
  if (request.systemPrompt.includes('inquiry.triage')) {
    return {
      fit: 'medium',
      summary: 'A corporate event with a reasonable lead time and a clear request.',
      signals: ['Lead time is workable'],
      risks: ['Guest count is not stated'],
      suggestedAction: 'request_more_info',
      suggestedQuestions: ['How many guests do you expect?'],
    };
  }
  if (request.systemPrompt.includes('proposal.draft')) {
    return {
      title: 'Your event proposal',
      summary: 'Thank you for the opportunity. This proposal covers the items in your estimate.',
      revisionNote: 'First draft of the proposal.',
      highlights: ['Venue and catering included'],
    };
  }
  return {
    subject: 'Reminder: Please review your conforme',
    body: 'We are following up on the conforme sent for your event. Please review and sign it when convenient. If you have questions or need another copy, contact your PMCM coordinator. Thank you.',
  };
}

export class FakeAiProviderAdapter implements AiProviderAdapter {
  readonly provider = 'anthropic' as const;
  readonly endpointPolicyId = 'anthropic-direct';
  readonly requests: AiProviderRequest[] = [];

  async run(request: AiProviderRequest, signal?: AbortSignal): Promise<AiProviderResponse> {
    if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError');
    this.requests.push(request);
    const text = JSON.stringify(fakeOutput(request));
    const inputBytes = Buffer.byteLength(request.systemPrompt + JSON.stringify(request.messages));
    return {
      text,
      toolCalls: [],
      stopReason: 'end_turn',
      usage: {
        inputTokens: Math.ceil(inputBytes / 4),
        outputTokens: Math.ceil(Buffer.byteLength(text) / 4),
      },
      responseModel: request.model,
      endpointTag: this.endpointPolicyId,
    };
  }

  async *stream(request: AiProviderRequest, signal?: AbortSignal): AsyncIterable<AiProviderStreamEvent> {
    const response = await this.run(request, signal);
    yield { type: 'text_delta', text: response.text };
    yield { type: 'final', response };
  }
}

/** Config values that select the real-data Anthropic route (ZDR confirmed) for tests using the fake adapter. */
export const FAKE_ZDR_ENV = { AI_PROVIDER: 'anthropic', AI_ZDR_CONFIRMED: 'true' } as const;
