import type {
  AiProviderRequest,
  AiProviderResponse,
} from '../../contracts/ai-governance/ai-gateway.port';

/** PII-free fixture shared by provider adapter conformance tests. */
export const AI_PROVIDER_CONFORMANCE_REQUEST: AiProviderRequest = {
  model: 'claude-sonnet-4-6',
  systemPrompt: 'Return the requested synthetic draft through the registered tool.',
  messages: [{ role: 'user', content: 'Create a short synthetic supplier update.' }],
  tools: [
    {
      name: 'emit_draft',
      description: 'Return the generated synthetic draft.',
      inputSchema: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['subject', 'body'],
        additionalProperties: false,
      },
    },
  ],
  toolChoice: { type: 'tool', name: 'emit_draft' },
  maxOutputTokens: 256,
};

export const AI_PROVIDER_CONFORMANCE_EXPECTED_RESPONSE: AiProviderResponse = {
  text: 'Draft prepared.',
  toolCalls: [
    {
      id: 'toolu_fixture_001',
      name: 'emit_draft',
      input: {
        subject: 'Synthetic event update',
        body: 'The supplier confirmed the sample delivery window.',
      },
    },
  ],
  stopReason: 'tool_use',
  usage: { inputTokens: 23, outputTokens: 12 },
  responseModel: 'claude-sonnet-4-6',
  endpointTag: 'anthropic-direct',
};

/** This is syntactically valid text but violates the shared non-empty output contract. */
export const AI_PROVIDER_CONFORMANCE_INVALID_OUTPUT_TEXT = '{"subject":"","body":""}';
