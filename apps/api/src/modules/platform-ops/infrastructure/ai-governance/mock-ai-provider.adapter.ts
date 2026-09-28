import type {
  AiProviderAdapter,
  AiProviderRequest,
  AiProviderResponse,
  AiProviderStreamEvent,
} from '../../contracts/ai-governance/ai-gateway.port';

function getInput(request: AiProviderRequest): Record<string, unknown> {
  const message = request.messages.find((candidate) => candidate.role === 'user');
  if (!message || message.role !== 'user') return {};
  try {
    return JSON.parse(message.content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mockOutput(request: AiProviderRequest): Record<string, unknown> {
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
      reason: 'Selected by deterministic mock policy',
    };
    return {
      feasible: Number(candidate.quotedAmount ?? 0) <= Number(input.remainingBudget ?? 0),
      selectedCandidate: candidate,
      costDelta: 0,
      costDeltaLabel: 'No modeled cost change',
      summary: 'Deterministic mock recommendation; PMCM review required.',
    };
  }
  if (request.systemPrompt.includes('pare.risk')) {
    return { level: 'LOW', factors: [], recommendation: 'Review this mock result before approval.' };
  }
  if (request.systemPrompt.includes('pare.message-drafts')) {
    return {
      supplierNotification: 'Please review the proposed supplier update.',
      clientReassurance: 'Please review the proposed client update.',
    };
  }
  if (request.systemPrompt.includes('comms.draft')) {
    return {
      subject: 'Reminder: Please review your conforme',
      body: 'We are following up on the conforme sent for your event. Please review and sign it when convenient. If you have questions or need another copy, contact your PMCM coordinator. Thank you.',
    };
  }
  return {
    subject: 'Draft response for review',
    body: 'This deterministic draft must be reviewed before it is sent.',
  };
}

export class MockAiProviderAdapter implements AiProviderAdapter {
  readonly provider = 'mock' as const;
  readonly endpointPolicyId = 'deterministic-mock';

  async run(request: AiProviderRequest, signal?: AbortSignal): Promise<AiProviderResponse> {
    if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError');
    const text = JSON.stringify(mockOutput(request));
    const inputBytes = Buffer.byteLength(request.systemPrompt + JSON.stringify(request.messages));
    return {
      text,
      toolCalls: [],
      stopReason: 'end_turn',
      usage: {
        inputTokens: Math.ceil(inputBytes / 4),
        outputTokens: Math.ceil(Buffer.byteLength(text) / 4),
      },
      responseModel: 'mock-v1',
      endpointTag: 'deterministic-mock',
    };
  }

  async *stream(request: AiProviderRequest, signal?: AbortSignal): AsyncIterable<AiProviderStreamEvent> {
    const response = await this.run(request, signal);
    yield { type: 'text_delta', text: response.text };
    yield { type: 'final', response };
  }
}
