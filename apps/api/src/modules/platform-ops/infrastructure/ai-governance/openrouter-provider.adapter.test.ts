import { describe, expect, it } from 'vitest';
import type { AiProviderRequest } from '../../contracts/ai-governance/ai-gateway.port';
import type { AiProviderStreamEvent } from '../../contracts/ai-governance/ai-gateway.port';
import {
  AI_PROVIDER_CONFORMANCE_REQUEST,
  AI_PROVIDER_CONFORMANCE_EXPECTED_RESPONSE,
} from './provider-conformance.fixtures';
import { OpenRouterProviderAdapter } from './openrouter-provider.adapter';

const API_KEY = 'test-openrouter-key-only';
const ENDPOINT_POLICY_ID = 'test-upstream';
const MODEL_ID = 'test/openrouter-model';
const CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

function responsePayload(overrides: Record<string, unknown> = {}) {
  const expectedTool = AI_PROVIDER_CONFORMANCE_EXPECTED_RESPONSE.toolCalls[0];
  return {
    model: MODEL_ID,
    choices: [{
      finish_reason: 'tool_calls',
      message: {
        role: 'assistant',
        content: AI_PROVIDER_CONFORMANCE_EXPECTED_RESPONSE.text,
        tool_calls: [{
          id: expectedTool.id,
          type: 'function',
          function: { name: expectedTool.name, arguments: JSON.stringify(expectedTool.input) },
        }],
      },
    }],
    usage: { prompt_tokens: 23, completion_tokens: 12 },
    ...overrides,
  };
}

function makeFetch(payload: unknown, status = 200) {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    requests.push({ url: input instanceof Request ? input.url : String(input), init });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json', 'x-request-id': 'or_req_fixture' },
    });
  };
  return { fetchImpl, requests };
}

function makeAdapter(fetchImpl: typeof fetch) {
  return new OpenRouterProviderAdapter({
    apiKey: API_KEY,
    endpointPolicyId: ENDPOINT_POLICY_ID,
    fetch: fetchImpl,
  });
}

describe('OpenRouterProviderAdapter', () => {
  it('maps the gateway request, pins the provider without fallback, and captures validated tool output metadata', async () => {
    const transport = makeFetch(responsePayload());
    const adapter = makeAdapter(transport.fetchImpl);
    const request: AiProviderRequest = {
      ...AI_PROVIDER_CONFORMANCE_REQUEST,
      model: MODEL_ID,
      messages: [
        ...AI_PROVIDER_CONFORMANCE_REQUEST.messages,
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call_previous', name: 'emit_draft', input: { subject: 'Earlier' } }],
        },
        { role: 'tool', toolResults: [{ toolCallId: 'call_previous', content: 'Earlier result', isError: true }] },
      ],
    };

    await expect(adapter.run(request)).resolves.toEqual({
      ...AI_PROVIDER_CONFORMANCE_EXPECTED_RESPONSE,
      responseModel: MODEL_ID,
      endpointTag: ENDPOINT_POLICY_ID,
    });

    expect(transport.requests).toHaveLength(1);
    const sent = transport.requests[0];
    expect(sent.url).toBe(CHAT_COMPLETIONS_URL);
    expect(sent.init.method).toBe('POST');
    expect(new Headers(sent.init.headers).get('authorization')).toBe(`Bearer ${API_KEY}`);
    const body = JSON.parse(String(sent.init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: MODEL_ID,
      max_tokens: AI_PROVIDER_CONFORMANCE_REQUEST.maxOutputTokens,
      stream: false,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'prism_ai_output',
          strict: true,
          schema: AI_PROVIDER_CONFORMANCE_REQUEST.outputSchema,
        },
      },
      tool_choice: { type: 'function', function: { name: 'emit_draft' } },
      provider: {
        only: [ENDPOINT_POLICY_ID], allow_fallbacks: false, require_parameters: true,
        zdr: true, data_collection: 'deny',
      },
    });
    expect(body.messages).toEqual([
      { role: 'system', content: AI_PROVIDER_CONFORMANCE_REQUEST.systemPrompt },
      { role: 'user', content: 'Create a short synthetic supplier update.' },
      {
        role: 'assistant', content: null,
        tool_calls: [{ id: 'call_previous', type: 'function', function: { name: 'emit_draft', arguments: '{"subject":"Earlier"}' } }],
      },
      { role: 'tool', tool_call_id: 'call_previous', content: 'Earlier result' },
    ]);
    expect(JSON.stringify(body)).not.toContain(API_KEY);
    expect(sent.init.signal).toBeUndefined();
  });

  it.each([
    ['429', 429, 'provider_unavailable', true],
    ['5xx', 503, 'provider_unavailable', true],
    ['nonretryable 4xx', 400, 'provider_rejected', false],
  ] as const)('normalizes %s once and never retries or exposes the response body', async (_label, status, code, retryable) => {
    const transport = makeFetch({ error: { message: 'sensitive upstream response' } }, status);
    const adapter = makeAdapter(transport.fetchImpl);

    await expect(adapter.run({ ...AI_PROVIDER_CONFORMANCE_REQUEST, model: MODEL_ID }))
      .rejects.toMatchObject({ code, retryable, details: { status, requestId: 'or_req_fixture' } });
    expect(transport.requests).toHaveLength(1);
  });

  it('rejects unknown or malformed tool calls before gateway execution', async () => {
    const payload = responsePayload({
      choices: [{
        finish_reason: 'tool_calls',
        message: {
          role: 'assistant',
          content: AI_PROVIDER_CONFORMANCE_EXPECTED_RESPONSE.text,
          tool_calls: [{
            id: 'call_fixture',
            type: 'function',
            function: { name: 'unregistered', arguments: JSON.stringify({ status: 'ok' }) },
          }],
        },
      }],
    });
    const adapter = makeAdapter(makeFetch(payload).fetchImpl);

    await expect(adapter.run({ ...AI_PROVIDER_CONFORMANCE_REQUEST, model: MODEL_ID }))
      .rejects.toMatchObject({ code: 'invalid_tool_call', retryable: false });
  });

  it('passes caller cancellation to fetch and makes no retry after abort', async () => {
    const controller = new AbortController();
    const requests: RequestInit[] = [];
    const fetchImpl: typeof fetch = async (_input, init = {}) => {
      requests.push(init);
      controller.abort();
      throw new DOMException('aborted', 'AbortError');
    };
    const adapter = makeAdapter(fetchImpl);

    await expect(adapter.run({ ...AI_PROVIDER_CONFORMANCE_REQUEST, model: MODEL_ID }, controller.signal))
      .rejects.toMatchObject({ code: 'aborted', retryable: false });
    expect(requests).toHaveLength(1);
    expect(requests[0].signal).toBe(controller.signal);
  });

  it('aborts an in-flight SSE read and cancels the response body', async () => {
    const encoder = new TextEncoder();
    let cancelled = false;
    const streamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          model: MODEL_ID,
          choices: [{ delta: { content: 'partial' }, finish_reason: null }],
        })}\n\n`));
      },
      cancel() {
        cancelled = true;
      },
    });
    const fetchImpl: typeof fetch = async () => new Response(streamBody, { headers: { 'content-type': 'text/event-stream' } });
    const adapter = makeAdapter(fetchImpl);
    const controller = new AbortController();
    const events = adapter.stream({ ...AI_PROVIDER_CONFORMANCE_REQUEST, model: MODEL_ID }, controller.signal);
    const iterator = events[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({ value: { type: 'text_delta', text: 'partial' }, done: false });
    const pendingNext = iterator.next();
    controller.abort();
    await expect(pendingNext).rejects.toMatchObject({ code: 'aborted', retryable: false });
    expect(cancelled).toBe(true);
  });

  it('reassembles streamed text and fragmented tool arguments and reports final usage', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      { model: MODEL_ID, choices: [{ index: 0, delta: { content: 'Draft ' }, finish_reason: null }] },
      { model: MODEL_ID, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_stream', type: 'function', function: { name: 'emit_draft', arguments: '{"subject":"Synthetic ' } }] }, finish_reason: null }] },
      { model: MODEL_ID, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: 'update","body":"Safe draft"}' } }] }, finish_reason: null }] },
      { model: MODEL_ID, choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] },
      { model: MODEL_ID, choices: [], usage: { prompt_tokens: 23, completion_tokens: 12 } },
    ];
    const body = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n';
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    });
    const fetchImpl: typeof fetch = async () => new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
    const adapter = makeAdapter(fetchImpl);
    const events: AiProviderStreamEvent[] = [];
    for await (const event of adapter.stream({ ...AI_PROVIDER_CONFORMANCE_REQUEST, model: MODEL_ID })) events.push(event);

    expect(events).toEqual([
      { type: 'text_delta', text: 'Draft ' },
      {
        type: 'final',
        response: {
          text: 'Draft ',
          toolCalls: [{ id: 'call_stream', name: 'emit_draft', input: { subject: 'Synthetic update', body: 'Safe draft' } }],
          stopReason: 'tool_use',
          usage: { inputTokens: 23, outputTokens: 12 },
          responseModel: MODEL_ID,
          endpointTag: ENDPOINT_POLICY_ID,
        },
      },
    ]);
  });
});
