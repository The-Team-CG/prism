import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import type { AiProviderRequest } from '../../contracts/ai-governance/ai-gateway.port';
import {
  AI_PROVIDER_CONFORMANCE_EXPECTED_RESPONSE,
  AI_PROVIDER_CONFORMANCE_INVALID_OUTPUT_TEXT,
  AI_PROVIDER_CONFORMANCE_REQUEST,
} from './provider-conformance.fixtures';
import {
  ANTHROPIC_DIRECT_ENDPOINT_TAG,
  AnthropicProviderAdapter,
  createAnthropicProviderClient,
} from './anthropic-provider.adapter';
import { ProviderAdapterError } from './provider-adapter.error';

const TEST_API_KEY = 'test-anthropic-key-only';
const TEST_BASE_URL = 'https://anthropic.test';

type CapturedRequest = {
  url: string;
  method: string | undefined;
  headers: Headers;
  body: string;
  signal: AbortSignal | null | undefined;
};

function makeMessageResponse(options: {
  content: unknown[];
  stopReason: string | null;
  model?: string;
}): Record<string, unknown> {
  return {
    id: 'msg_fixture_001',
    type: 'message',
    role: 'assistant',
    model: options.model ?? 'claude-sonnet-4-6',
    content: options.content,
    stop_reason: options.stopReason,
    stop_sequence: null,
    stop_details: null,
    container: null,
    usage: {
      input_tokens: 23,
      output_tokens: 12,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      cache_creation: null,
      inference_geo: null,
      server_tool_use: null,
      service_tier: 'standard',
    },
  };
}

function makeResponseFetch(payload: unknown, status = 200) {
  const requests: CapturedRequest[] = [];
  const fetchMock: typeof fetch = async (input, init) => {
    requests.push({
      url: input instanceof Request ? input.url : String(input),
      method: init?.method,
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? init.body : String(init?.body ?? ''),
      signal: init?.signal,
    });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json', 'request-id': 'req_fixture_001' },
    });
  };

  return { fetchMock, requests };
}

function makeAdapter(fetchImpl: typeof fetch) {
  const client = createAnthropicProviderClient({
    apiKey: TEST_API_KEY,
    baseURL: TEST_BASE_URL,
    fetch: fetchImpl,
  });
  return new AnthropicProviderAdapter(client);
}

function responseWithValidForcedToolCall(): Record<string, unknown> {
  const expected = AI_PROVIDER_CONFORMANCE_EXPECTED_RESPONSE;
  const toolCall = expected.toolCalls[0];
  return makeMessageResponse({
    stopReason: 'tool_use',
    content: [
      { type: 'text', text: expected.text },
      {
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.input,
        caller: { type: 'direct' },
      },
    ],
  });
}

describe('AnthropicProviderAdapter', () => {
  it('maps forced tool calls, history, model, usage, endpoint and isolates the key to the HTTP header', async () => {
    const transport = makeResponseFetch(responseWithValidForcedToolCall());
    const adapter = makeAdapter(transport.fetchMock);
    const request: AiProviderRequest = {
      ...AI_PROVIDER_CONFORMANCE_REQUEST,
      messages: [
        ...AI_PROVIDER_CONFORMANCE_REQUEST.messages,
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              id: 'toolu_previous_001',
              name: 'emit_draft',
              input: { subject: 'Prior synthetic draft' },
            },
          ],
        },
        {
          role: 'tool',
          toolResults: [
            {
              toolCallId: 'toolu_previous_001',
              content: 'Previous synthetic result',
              isError: true,
            },
          ],
        },
      ],
    };

    const result = await adapter.run(request);

    expect(result).toEqual(AI_PROVIDER_CONFORMANCE_EXPECTED_RESPONSE);
    expect(transport.requests).toHaveLength(1);
    const sent = transport.requests[0];
    expect(sent.url).toBe(`${TEST_BASE_URL}/v1/messages`);
    expect(sent.method).toBe('POST');
    expect(sent.headers.get('x-api-key')).toBe(TEST_API_KEY);
    expect(sent.body).not.toContain(TEST_API_KEY);

    const body = JSON.parse(sent.body) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: AI_PROVIDER_CONFORMANCE_REQUEST.model,
      max_tokens: AI_PROVIDER_CONFORMANCE_REQUEST.maxOutputTokens,
      system: AI_PROVIDER_CONFORMANCE_REQUEST.systemPrompt,
      tool_choice: { type: 'tool', name: 'emit_draft' },
      tools: [
        {
          name: 'emit_draft',
          description: 'Return the generated synthetic draft.',
          input_schema: AI_PROVIDER_CONFORMANCE_REQUEST.tools[0].inputSchema,
        },
      ],
      messages: [
        { role: 'user', content: 'Create a short synthetic supplier update.' },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_previous_001',
              name: 'emit_draft',
              input: { subject: 'Prior synthetic draft' },
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_previous_001',
              content: 'Previous synthetic result',
              is_error: true,
            },
          ],
        },
      ],
    });
  });

  it('passes automatic and any tool choices using Anthropic tool-choice vocabulary', async () => {
    for (const [choice, expectedChoice] of [
      ['auto', { type: 'auto' }],
      ['any', { type: 'any' }],
    ] as const) {
      const transport = makeResponseFetch(
        makeMessageResponse({ content: [{ type: 'text', text: 'Complete.' }], stopReason: 'end_turn' }),
      );
      const adapter = makeAdapter(transport.fetchMock);

      await adapter.run({ ...AI_PROVIDER_CONFORMANCE_REQUEST, toolChoice: choice });

      expect(JSON.parse(transport.requests[0].body)).toMatchObject({
        tool_choice: expectedChoice,
      });
    }
  });

  it('passes invalid output text through for the gateway output schema to reject', async () => {
    const transport = makeResponseFetch(
      makeMessageResponse({
        content: [{ type: 'text', text: AI_PROVIDER_CONFORMANCE_INVALID_OUTPUT_TEXT }],
        stopReason: 'end_turn',
      }),
    );
    const adapter = makeAdapter(transport.fetchMock);

    const result = await adapter.run({
      ...AI_PROVIDER_CONFORMANCE_REQUEST,
      tools: [],
      toolChoice: 'auto',
    });

    expect(result.text).toBe(AI_PROVIDER_CONFORMANCE_INVALID_OUTPUT_TEXT);
    expect(result.toolCalls).toEqual([]);
  });

  it.each([
    {
      name: 'an unregistered tool name',
      toolName: 'unexpected_tool',
      input: { subject: 'Synthetic' },
    },
    { name: 'a non-object tool input', toolName: 'emit_draft', input: 'malformed' },
  ])('rejects malformed provider tool calls: $name', async ({ toolName, input }) => {
    const transport = makeResponseFetch(
      makeMessageResponse({
        stopReason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_malformed_001',
            name: toolName,
            input,
            caller: { type: 'direct' },
          },
        ],
      }),
    );
    const adapter = makeAdapter(transport.fetchMock);

    await expect(adapter.run(AI_PROVIDER_CONFORMANCE_REQUEST)).rejects.toMatchObject({
      name: 'ProviderAdapterError',
      code: 'invalid_tool_call',
      retryable: false,
    });
  });

  it.each([
    { status: 429, code: 'provider_unavailable', retryable: true },
    { status: 503, code: 'provider_unavailable', retryable: true },
    { status: 400, code: 'provider_rejected', retryable: false },
  ] as const)(
    'normalizes HTTP $status with a single SDK attempt',
    async ({ status, code, retryable }) => {
      const transport = makeResponseFetch(
        {
          type: 'error',
          error: {
            type: status === 429 ? 'rate_limit_error' : 'api_error',
            message: 'Synthetic provider error fixture',
          },
        },
        status,
      );
      const adapter = makeAdapter(transport.fetchMock);

      await expect(adapter.run(AI_PROVIDER_CONFORMANCE_REQUEST)).rejects.toMatchObject({
        name: 'ProviderAdapterError',
        code,
        retryable,
        details: { status, requestId: 'req_fixture_001' },
      });
      expect(transport.requests).toHaveLength(1);
    },
  );

  it('streams text deltas and a final response with usage and model metadata', async () => {
    const events = [
      {
        type: 'message_start',
        message: makeMessageResponse({ content: [], stopReason: null }),
      },
      {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Draft ' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'prepared.' },
      },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: {
          output_tokens: 12,
          input_tokens: null,
          cache_creation_input_tokens: null,
          cache_read_input_tokens: null,
        },
      },
      { type: 'message_stop' },
    ];
    const sse = events
      .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      .join('');
    const transport = makeResponseFetch(sse);
    const streamFetch: typeof fetch = async (input, init) => {
      transport.requests.push({
        url: input instanceof Request ? input.url : String(input),
        method: init?.method,
        headers: new Headers(init?.headers),
        body: typeof init?.body === 'string' ? init.body : String(init?.body ?? ''),
        signal: init?.signal,
      });
      return new Response(sse, {
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'request-id': 'req_stream_fixture_001' },
      });
    };
    const adapter = makeAdapter(streamFetch);

    const received = [];
    for await (const event of adapter.stream({
      ...AI_PROVIDER_CONFORMANCE_REQUEST,
      tools: [],
      toolChoice: 'auto',
    })) {
      received.push(event);
    }

    expect(received).toEqual([
      { type: 'text_delta', text: 'Draft ' },
      { type: 'text_delta', text: 'prepared.' },
      {
        type: 'final',
        response: {
          text: 'Draft prepared.',
          toolCalls: [],
          stopReason: 'end_turn',
          usage: { inputTokens: 23, outputTokens: 12 },
          responseModel: 'claude-sonnet-4-6',
          endpointTag: ANTHROPIC_DIRECT_ENDPOINT_TAG,
        },
      },
    ]);
    expect(transport.requests).toHaveLength(1);
    expect(JSON.parse(transport.requests[0].body)).toMatchObject({ stream: true });
  });

  it('propagates cancellation into the SDK HTTP request and normalizes the abort', async () => {
    let resolveStarted: (signal: AbortSignal | null | undefined) => void = () => undefined;
    const started = new Promise<AbortSignal | null | undefined>((resolve) => {
      resolveStarted = resolve;
    });
    const fetchMock: typeof fetch = async (_input, init) => {
      resolveStarted(init?.signal);
      return new Promise<Response>((_resolve, reject) => {
        if (init?.signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      });
    };
    const adapter = makeAdapter(fetchMock);
    const controller = new AbortController();
    const consume = async () => {
      for await (const _event of adapter.stream(
        { ...AI_PROVIDER_CONFORMANCE_REQUEST, tools: [], toolChoice: 'auto' },
        controller.signal,
      )) {
        // Consume until the pending request is aborted.
      }
    };
    const pending = consume();
    const sdkSignal = await started;

    controller.abort();

    await expect(pending).rejects.toMatchObject({
      name: 'ProviderAdapterError',
      code: 'aborted',
      retryable: false,
    });
    expect(sdkSignal?.aborted).toBe(true);
  });

  it('propagates cancellation for non-streaming calls as well', async () => {
    let resolveStarted: (signal: AbortSignal | null | undefined) => void = () => undefined;
    const started = new Promise<AbortSignal | null | undefined>((resolve) => {
      resolveStarted = resolve;
    });
    const fetchMock: typeof fetch = async (_input, init) => {
      resolveStarted(init?.signal);
      return new Promise<Response>((_resolve, reject) => {
        if (init?.signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      });
    };
    const adapter = makeAdapter(fetchMock);
    const controller = new AbortController();
    const pending = adapter.run(
      { ...AI_PROVIDER_CONFORMANCE_REQUEST, tools: [], toolChoice: 'auto' },
      controller.signal,
    );
    const sdkSignal = await started;

    controller.abort();

    await expect(pending).rejects.toMatchObject({
      name: 'ProviderAdapterError',
      code: 'aborted',
      retryable: false,
    });
    expect(sdkSignal?.aborted).toBe(true);
  });

  it('refuses a forced tool choice that is not registered before any network call', async () => {
    const transport = makeResponseFetch(responseWithValidForcedToolCall());
    const adapter = makeAdapter(transport.fetchMock);

    await expect(
      adapter.run({
        ...AI_PROVIDER_CONFORMANCE_REQUEST,
        toolChoice: { type: 'tool', name: 'unregistered' },
      }),
    ).rejects.toBeInstanceOf(ProviderAdapterError);
    expect(transport.requests).toHaveLength(0);
  });

  it('requires an explicit non-empty key and disables SDK retries for gateway ownership', () => {
    expect(() => createAnthropicProviderClient({ apiKey: '  ' })).toThrow(
      'An Anthropic API key is required',
    );

    const client = createAnthropicProviderClient({ apiKey: TEST_API_KEY });
    expect(client.maxRetries).toBe(0);
    expect(() => new AnthropicProviderAdapter(new Anthropic({ apiKey: TEST_API_KEY }))).toThrow(
      'Anthropic SDK retries must be disabled',
    );
  });
});
