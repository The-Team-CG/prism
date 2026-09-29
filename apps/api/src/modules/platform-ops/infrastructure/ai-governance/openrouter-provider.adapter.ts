import type {
  AiProviderAdapter,
  AiProviderMessage,
  AiProviderRequest,
  AiProviderResponse,
  AiProviderStreamEvent,
  AiProviderToolCall,
} from '../../contracts/ai-governance/ai-gateway.port';
import { ProviderAdapterError } from './provider-adapter.error';

export const OPENROUTER_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type OpenRouterProviderAdapterOptions = {
  /** Supplied by the platform-ops composition root; the adapter reads no environment variables. */
  apiKey: string;
  /** Reviewed provider endpoint slug from the selected route, such as `fireworks`. */
  endpointPolicyId: string;
  fetch?: typeof fetch;
};

type OpenRouterProviderRequest = {
  model: string;
  max_tokens: number;
  stream: boolean;
  messages: Record<string, unknown>[];
  provider: {
    only: [string];
    allow_fallbacks: false;
    require_parameters: true;
    zdr: true;
    data_collection: 'deny';
  };
  tools?: Record<string, unknown>[];
  tool_choice?: 'auto' | 'required' | { type: 'function'; function: { name: string } };
  response_format?: {
    type: 'json_schema';
    json_schema: { name: string; strict: true; schema: Record<string, unknown> };
  };
  stream_options?: { include_usage: true };
};

type StreamedToolCall = { id?: string; name: string; arguments: string };
type OpenRouterStreamState = {
  textParts: string[];
  toolCalls: Map<number, StreamedToolCall>;
  finishReason?: string;
  responseModel?: string;
  usage?: unknown;
};
type StreamedToolCallDelta = {
  index: number;
  id?: string;
  name?: string;
  arguments?: string;
};

export class OpenRouterProviderAdapter implements AiProviderAdapter {
  readonly provider = 'openrouter' as const;
  readonly endpointPolicyId: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenRouterProviderAdapterOptions) {
    this.apiKey = validateApiKey(options.apiKey);
    this.endpointPolicyId = validateEndpointPolicyId(options.endpointPolicyId);
    this.fetchImpl = options.fetch ?? fetch;
  }

  async run(request: AiProviderRequest, signal?: AbortSignal): Promise<AiProviderResponse> {
    throwIfAborted(signal);
    const body = toOpenRouterRequest(request, this.endpointPolicyId, false);
    const response = await this.fetchResponse(body, signal, 'application/json');
    const payload = await readJsonResponse(response);
    return toProviderResponse(payload, request, this.endpointPolicyId);
  }

  async *stream(request: AiProviderRequest, signal?: AbortSignal): AsyncIterable<AiProviderStreamEvent> {
    throwIfAborted(signal);
    const body = toOpenRouterRequest(request, this.endpointPolicyId, true);
    const streamResponse = await this.fetchResponse(body, signal, 'text/event-stream');
    if (!streamResponse.body) {
      throw malformedProviderResponse('OpenRouter returned no streaming response body');
    }

    const state: OpenRouterStreamState = { textParts: [], toolCalls: new Map() };
    for await (const payload of readServerSentEvents(streamResponse.body, signal)) {
      for (const text of appendStreamPayload(state, payload)) yield { type: 'text_delta', text };
    }

    if (!state.finishReason) throw malformedProviderResponse('OpenRouter ended the stream without a finish reason');
    yield { type: 'final', response: buildStreamResponse(state, request, this.endpointPolicyId) };
  }

  private async fetchResponse(
    body: OpenRouterProviderRequest,
    signal: AbortSignal | undefined,
    accept: string,
  ): Promise<Response> {
    try {
      const response = await this.fetchImpl(OPENROUTER_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: accept,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        ...(signal ? { signal } : {}),
      });
      if (!response.ok) throw toOpenRouterHttpError(response);
      return response;
    } catch (error) {
      throw normalizeFetchFailure(error, signal);
    }
  }
}

function toOpenRouterRequest(
  request: AiProviderRequest,
  endpointPolicyId: string,
  stream: boolean,
): OpenRouterProviderRequest {
  assertValidProviderRequest(request);
  const toolNames = validateToolSpecifications(request.tools);
  assertValidToolChoice(request.toolChoice, toolNames);

  const body: OpenRouterProviderRequest = {
    model: request.model,
    max_tokens: request.maxOutputTokens,
    stream,
    messages: [
      { role: 'system', content: request.systemPrompt },
      ...request.messages.flatMap(toOpenRouterMessages),
    ],
    provider: {
      only: [endpointPolicyId],
      allow_fallbacks: false,
      require_parameters: true,
      zdr: true,
      data_collection: 'deny',
    },
  };

  if (request.tools.length > 0) {
    body.tools = request.tools.map(toOpenRouterTool);
    body.tool_choice = toOpenRouterToolChoice(request.toolChoice);
  }

  if (request.outputSchema !== undefined) {
    body.response_format = toOpenRouterOutputFormat(request.outputSchema);
  }
  if (stream) body.stream_options = { include_usage: true };
  return body;
}

function assertValidProviderRequest(request: AiProviderRequest): void {
  if (!request.model.trim() || !Number.isSafeInteger(request.maxOutputTokens) || request.maxOutputTokens <= 0) {
    throw malformedRequest('The provider request has an invalid model or output-token limit');
  }
}

function validateToolSpecifications(tools: AiProviderRequest['tools']): Set<string> {
  const names = new Set<string>();
  for (const tool of tools) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(tool.name) || names.has(tool.name) || !isObjectSchema(tool.inputSchema)) {
      throw invalidToolError('The provider request contains an invalid tool specification');
    }
    names.add(tool.name);
  }
  return names;
}

function assertValidToolChoice(choice: AiProviderRequest['toolChoice'], toolNames: ReadonlySet<string>): void {
  if (choice !== 'auto' && toolNames.size === 0) {
    throw invalidToolError('A forced tool choice requires at least one registered tool');
  }
  if (typeof choice === 'object' && !toolNames.has(choice.name)) {
    throw invalidToolError('The forced tool choice does not match a registered tool');
  }
}

function toOpenRouterTool(tool: AiProviderRequest['tools'][number]): Record<string, unknown> {
  return {
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
  };
}

function toOpenRouterToolChoice(choice: AiProviderRequest['toolChoice']): OpenRouterProviderRequest['tool_choice'] {
  if (choice === 'auto') return 'auto';
  if (choice === 'any') return 'required';
  return { type: 'function', function: { name: choice.name } };
}

function toOpenRouterOutputFormat(schema: Record<string, unknown>): NonNullable<OpenRouterProviderRequest['response_format']> {
  if (!isObjectSchema(schema)) {
    throw new ProviderAdapterError('invalid_output', 'The provider output schema must be an object', false);
  }
  return { type: 'json_schema', json_schema: { name: 'prism_ai_output', strict: true, schema } };
}

function appendStreamPayload(state: OpenRouterStreamState, payload: unknown): string[] {
  const chunk = asRecord(payload);
  if (!chunk) throw malformedProviderResponse('OpenRouter returned an invalid stream event');
  if (typeof chunk.model === 'string') state.responseModel = chunk.model;
  if (chunk.usage !== undefined && chunk.usage !== null) state.usage = chunk.usage;
  if (!Array.isArray(chunk.choices)) return [];
  const textDeltas: string[] = [];
  for (const choice of chunk.choices) textDeltas.push(...appendStreamChoice(state, choice));
  return textDeltas;
}

function appendStreamChoice(state: OpenRouterStreamState, rawChoice: unknown): string[] {
  const choice = asRecord(rawChoice);
  if (!choice) throw malformedProviderResponse('OpenRouter returned an invalid stream choice');
  if (typeof choice.finish_reason === 'string') state.finishReason = choice.finish_reason;
  const delta = asRecord(choice.delta);
  if (!delta) return [];
  const text = readStreamTextDelta(delta.content);
  if (text !== undefined) state.textParts.push(text);
  if (delta.tool_calls !== undefined && delta.tool_calls !== null) {
    if (!Array.isArray(delta.tool_calls)) throw malformedProviderResponse('OpenRouter returned invalid streamed tool calls');
    for (const rawToolCall of delta.tool_calls) appendStreamedToolCall(state.toolCalls, rawToolCall);
  }
  return text === undefined ? [] : [text];
}

function readStreamTextDelta(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw malformedProviderResponse('OpenRouter returned unsupported streamed content');
  return value.length > 0 ? value : undefined;
}

function buildStreamResponse(
  state: OpenRouterStreamState,
  request: AiProviderRequest,
  endpointPolicyId: string,
): AiProviderResponse {
  return {
    text: state.textParts.join(''),
    toolCalls: parseStreamedToolCalls(state.toolCalls, request),
    stopReason: normalizeStopReason(state.finishReason!),
    usage: readUsage(state.usage),
    ...(state.responseModel ? { responseModel: state.responseModel } : {}),
    endpointTag: endpointPolicyId,
  };
}

function toOpenRouterMessages(message: AiProviderMessage): Record<string, unknown>[] {
  if (message.role === 'user') return [{ role: 'user', content: message.content }];
  if (message.role === 'tool') {
    return message.toolResults.map((result) => ({
      role: 'tool',
      tool_call_id: result.toolCallId,
      content: result.content,
    }));
  }

  const calls = message.toolCalls ?? [];
  if (calls.length === 0) return [{ role: 'assistant', content: message.content }];
  const toolCalls = calls.map((call) => {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(call.name) || !isPlainObject(call.input)) {
      throw invalidToolError('Assistant history contains a malformed tool call');
    }
    let argumentsText: string | undefined;
    try {
      argumentsText = JSON.stringify(call.input);
    } catch {
      throw invalidToolError('Assistant history contains an unserializable tool call');
    }
    if (typeof argumentsText !== 'string') throw invalidToolError('Assistant history contains an unserializable tool call');
    return { id: call.id, type: 'function', function: { name: call.name, arguments: argumentsText } };
  });
  return [{ role: 'assistant', content: message.content || null, tool_calls: toolCalls }];
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    throw malformedProviderResponse('OpenRouter returned an unreadable response');
  }
}

function toProviderResponse(
  payload: unknown,
  request: AiProviderRequest,
  endpointPolicyId: string,
): AiProviderResponse {
  const { body, choice, message } = readCompletionChoice(payload);
  return {
    text: readCompletionText(message.content),
    toolCalls: readCompletionToolCalls(message.tool_calls, request),
    stopReason: readCompletionStopReason(choice.finish_reason),
    usage: readUsage(body.usage),
    ...(typeof body.model === 'string' ? { responseModel: body.model } : {}),
    endpointTag: endpointPolicyId,
  };
}

function readCompletionChoice(payload: unknown): {
  body: Record<string, unknown>;
  choice: Record<string, unknown>;
  message: Record<string, unknown>;
} {
  const body = asRecord(payload);
  const choices = body?.choices;
  if (!body || !Array.isArray(choices) || choices.length === 0) {
    throw malformedProviderResponse('OpenRouter returned no completion choice');
  }
  const choice = asRecord(choices[0]);
  const message = asRecord(choice?.message);
  if (!choice || !message) throw malformedProviderResponse('OpenRouter returned an invalid completion choice');
  return { body, choice, message };
}

function readCompletionText(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'string') {
    return typeof value === 'string' ? value : '';
  }
  throw malformedProviderResponse('OpenRouter returned unsupported completion content');
}

function readCompletionToolCalls(value: unknown, request: AiProviderRequest): AiProviderToolCall[] {
  if (value === undefined || value === null) return [];
  return parseToolCalls(value, request);
}

function readCompletionStopReason(value: unknown): AiProviderResponse['stopReason'] {
  if (typeof value !== 'string') {
    throw malformedProviderResponse('OpenRouter returned a completion without a finish reason');
  }
  return normalizeStopReason(value);
}

function parseToolCalls(value: unknown, request: AiProviderRequest): AiProviderToolCall[] {
  if (!Array.isArray(value)) throw invalidToolError('OpenRouter returned invalid tool calls');
  const registeredTools = new Set(request.tools.map((tool) => tool.name));
  return value.map((rawCall) => {
    const call = asRecord(rawCall);
    const fn = asRecord(call?.function);
    if (!call || !fn || typeof call.id !== 'string' || typeof fn.name !== 'string' ||
      !registeredTools.has(fn.name) || typeof fn.arguments !== 'string') {
      throw invalidToolError('OpenRouter returned a malformed or unregistered tool call');
    }
    let input: unknown;
    try {
      input = JSON.parse(fn.arguments) as unknown;
    } catch {
      throw invalidToolError('OpenRouter returned invalid tool arguments');
    }
    if (!isPlainObject(input)) throw invalidToolError('OpenRouter returned invalid tool arguments');
    return { id: call.id, name: fn.name, input };
  });
}

function appendStreamedToolCall(calls: Map<number, StreamedToolCall>, value: unknown): void {
  const delta = readStreamedToolCallDelta(value);
  const existing = calls.get(delta.index) ?? { name: '', arguments: '' };
  appendStreamedToolId(existing, delta.id);
  existing.name += delta.name ?? '';
  existing.arguments += delta.arguments ?? '';
  calls.set(delta.index, existing);
}

function readStreamedToolCallDelta(value: unknown): StreamedToolCallDelta {
  const item = asRecord(value);
  if (!item) {
    throw invalidToolError('OpenRouter returned an invalid streamed tool call');
  }
  if (!Number.isSafeInteger(item.index) || (item.index as number) < 0) {
    throw invalidToolError('OpenRouter returned an invalid streamed tool call');
  }
  const fn = readStreamedToolFunction(item.function);
  return {
    index: item.index as number,
    ...(readOptionalToolFragment(item.id, 'ID') !== undefined ? { id: item.id as string } : {}),
    ...(readOptionalToolFragment(fn?.name, 'name') !== undefined ? { name: fn!.name as string } : {}),
    ...(readOptionalToolFragment(fn?.arguments, 'arguments') !== undefined ? { arguments: fn!.arguments as string } : {}),
  };
}

function readStreamedToolFunction(value: unknown): Record<string, unknown> | undefined {
  const fn = asRecord(value);
  if (!fn && value !== undefined) throw invalidToolError('OpenRouter returned an invalid streamed tool call');
  return fn ?? undefined;
}

function readOptionalToolFragment(value: unknown, field: 'ID' | 'name' | 'arguments'): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    const message = field === 'ID'
      ? 'OpenRouter returned an invalid streamed tool call ID'
      : field === 'name'
        ? 'OpenRouter returned an invalid streamed tool name'
        : 'OpenRouter returned invalid streamed tool arguments';
    throw invalidToolError(message);
  }
  return value;
}

function appendStreamedToolId(existing: StreamedToolCall, id: string | undefined): void {
  if (id === undefined) return;
  if (existing.id !== undefined && existing.id !== id) {
    throw invalidToolError('OpenRouter returned an inconsistent streamed tool call ID');
  }
  existing.id = id;
}

function parseStreamedToolCalls(
  calls: Map<number, StreamedToolCall>,
  request: AiProviderRequest,
): AiProviderToolCall[] {
  const ordered = [...calls.entries()].sort(([left], [right]) => left - right);
  return parseToolCalls(ordered.map(([, call]) => ({
    id: call.id,
    type: 'function',
    function: { name: call.name, arguments: call.arguments },
  })), request);
}

async function* readServerSentEvents(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncIterable<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  const cancelOnAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener('abort', cancelOnAbort, { once: true });
  try {
    while (true) {
      throwIfAborted(signal);
      const next = await reader.read();
      throwIfAborted(signal);
      if (next.done) {
        buffer += decoder.decode();
        completed = true;
        const finalData = eventData(buffer);
        if (finalData === '[DONE]') return;
        if (finalData !== null) yield parseStreamEvent(finalData);
        return;
      }
      buffer += decoder.decode(next.value, { stream: true });
      const frames = takeCompleteEventFrames(normalizeLineEndings(buffer));
      buffer = frames.remaining;
      for (const data of frames.data) {
        if (data === '[DONE]') return;
        yield parseStreamEvent(data);
      }
    }
  } catch (error) {
    throw normalizeStreamFailure(error, signal);
  } finally {
    await releaseStreamReader(reader, signal, cancelOnAbort, completed);
  }
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function takeCompleteEventFrames(value: string): { data: string[]; remaining: string } {
  const data: string[] = [];
  let remaining = value;
  let boundary = remaining.indexOf('\n\n');
  while (boundary >= 0) {
    const frameData = eventData(remaining.slice(0, boundary));
    if (frameData !== null) data.push(frameData);
    remaining = remaining.slice(boundary + 2);
    boundary = remaining.indexOf('\n\n');
  }
  return { data, remaining };
}

function normalizeStreamFailure(error: unknown, signal?: AbortSignal): ProviderAdapterError {
  if (error instanceof ProviderAdapterError) return error;
  if (isAbortError(error, signal)) return abortedError();
  return malformedProviderResponse('OpenRouter stream could not be read');
}

async function releaseStreamReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal | undefined,
  cancelOnAbort: () => void,
  completed: boolean,
): Promise<void> {
  signal?.removeEventListener('abort', cancelOnAbort);
  if (!completed) await reader.cancel().catch(() => undefined);
  reader.releaseLock();
}

function eventData(frame: string): string | null {
  const lines = frame.split('\n').filter((line) => line.startsWith('data:'));
  if (lines.length === 0) return null;
  return lines.map((line) => line.slice(5).replace(/^ /, '')).join('\n').trim();
}

function parseStreamEvent(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw malformedProviderResponse('OpenRouter returned an unreadable stream event');
  }
}

function readUsage(value: unknown): AiProviderResponse['usage'] {
  const usage = asRecord(value);
  if (!usage || !isNonNegativeInteger(usage.prompt_tokens) || !isNonNegativeInteger(usage.completion_tokens)) {
    throw malformedProviderResponse('OpenRouter did not return valid token usage');
  }
  return { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens };
}

function normalizeStopReason(value: string): AiProviderResponse['stopReason'] {
  switch (value) {
    case 'tool_calls':
    case 'function_call':
      return 'tool_use';
    case 'length':
      return 'max_tokens';
    case 'stop':
      return 'end_turn';
    default:
      throw malformedProviderResponse('OpenRouter returned an unsupported finish reason');
  }
}

function readRequestId(headers: Headers): string | undefined {
  return headers.get('x-request-id') ?? headers.get('request-id') ?? undefined;
}

function toOpenRouterHttpError(response: Response): ProviderAdapterError {
  const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
  const requestId = readRequestId(response.headers);
  return new ProviderAdapterError(
    retryable ? 'provider_unavailable' : 'provider_rejected',
    retryable ? 'OpenRouter is temporarily unavailable' : 'OpenRouter rejected the request',
    retryable,
    { status: response.status, ...(requestId ? { requestId } : {}) },
  );
}

function normalizeFetchFailure(error: unknown, signal?: AbortSignal): ProviderAdapterError {
  if (error instanceof ProviderAdapterError) return error;
  if (isAbortError(error, signal)) return abortedError();
  return new ProviderAdapterError('provider_unavailable', 'OpenRouter could not be reached', true);
}

function validateApiKey(value: string): string {
  const key = value.trim();
  if (!key || /placeholder|replace[-_ ]?me|your[-_ ]?(openrouter[-_ ]?)?api[-_ ]?key|<[^>]+>/i.test(key)) {
    throw new Error('A configured OpenRouter API key is required');
  }
  return key;
}

function validateEndpointPolicyId(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)) {
    throw new Error('A valid reviewed OpenRouter endpoint policy is required');
  }
  return value;
}

function isObjectSchema(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value) && value.type === 'object';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isPlainObject(value) ? value : null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortedError();
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || (error instanceof Error && error.name === 'AbortError');
}

function abortedError(): ProviderAdapterError {
  return new ProviderAdapterError('aborted', 'The OpenRouter request was aborted', false);
}

function malformedRequest(message: string): ProviderAdapterError {
  return new ProviderAdapterError('provider_rejected', message, false);
}

function malformedProviderResponse(message: string): ProviderAdapterError {
  return new ProviderAdapterError('provider_rejected', message, false);
}

function invalidToolError(message: string): ProviderAdapterError {
  return new ProviderAdapterError('invalid_tool_call', message, false);
}
