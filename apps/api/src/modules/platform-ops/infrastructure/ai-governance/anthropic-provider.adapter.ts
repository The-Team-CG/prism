import Anthropic, { type APIError } from '@anthropic-ai/sdk';
import type {
  AiProviderAdapter,
  AiProviderMessage,
  AiProviderRequest,
  AiProviderResponse,
  AiProviderStreamEvent,
  AiProviderToolChoice,
  AiProviderToolSpec,
} from '../../contracts/ai-governance/ai-gateway.port';
import { ProviderAdapterError } from './provider-adapter.error';

export const ANTHROPIC_DIRECT_ENDPOINT_TAG = 'anthropic-direct';

export type AnthropicProviderClientOptions = {
  /** Supplied by the platform-ops configuration owner; the adapter reads no environment variables. */
  apiKey: string;
  baseURL?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

export function createAnthropicProviderClient(
  options: AnthropicProviderClientOptions,
): Anthropic {
  if (!options.apiKey.trim()) {
    throw new Error('An Anthropic API key is required to create the provider client');
  }

  return new Anthropic({
    apiKey: options.apiKey,
    ...(options.baseURL ? { baseURL: options.baseURL } : {}),
    ...(options.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {}),
    ...(options.fetch ? { fetch: options.fetch } : {}),
    // Gateway core owns route retries. The SDK must make exactly one attempt.
    maxRetries: 0,
  });
}

export class AnthropicProviderAdapter implements AiProviderAdapter {
  readonly provider = 'anthropic' as const;

  constructor(
    private readonly client: Anthropic,
    private readonly endpointTag = ANTHROPIC_DIRECT_ENDPOINT_TAG,
  ) {
    if (client.maxRetries !== 0) {
      throw new Error('Anthropic SDK retries must be disabled; retry policy belongs to the AI gateway');
    }
  }

  async run(
    request: AiProviderRequest,
    signal?: AbortSignal,
  ): Promise<AiProviderResponse> {
    if (signal?.aborted) {
      throw abortedError();
    }

    try {
      const response = await this.client.messages.create(
        toAnthropicRequest(request),
        signal ? { signal } : undefined,
      );
      return toProviderResponse(response, request, this.endpointTag);
    } catch (error) {
      throw normalizeProviderError(error, signal);
    }
  }

  async *stream(
    request: AiProviderRequest,
    signal?: AbortSignal,
  ): AsyncIterable<AiProviderStreamEvent> {
    if (signal?.aborted) {
      throw abortedError();
    }

    try {
      const stream = this.client.messages.stream(
        { ...toAnthropicRequest(request), stream: true },
        signal ? { signal } : undefined,
      );

      for await (const event of stream) {
        if (event.type !== 'content_block_delta' || event.delta.type !== 'text_delta') {
          continue;
        }

        if (event.delta.text.length > 0) {
          yield { type: 'text_delta', text: event.delta.text };
        }
      }

      const finalMessage = await stream.finalMessage();
      yield {
        type: 'final',
        response: toProviderResponse(finalMessage, request, this.endpointTag),
      };
    } catch (error) {
      throw normalizeProviderError(error, signal);
    }
  }
}

function toAnthropicRequest(
  request: AiProviderRequest,
): Anthropic.Messages.MessageCreateParamsNonStreaming {
  const toolNames = new Set<string>();
  for (const tool of request.tools) {
    if (toolNames.has(tool.name) || !isAnthropicInputSchema(tool.inputSchema)) {
      throw invalidToolCallError('The provider request contains an invalid tool specification');
    }
    toolNames.add(tool.name);
  }

  if (request.toolChoice !== 'auto') {
    if (request.tools.length === 0) {
      throw invalidToolCallError('A forced tool choice requires at least one registered tool');
    }
    if (typeof request.toolChoice === 'object' && !toolNames.has(request.toolChoice.name)) {
      throw invalidToolCallError('The forced tool choice does not match a registered tool');
    }
  }

  const tools = request.tools.map(toAnthropicTool);
  return {
    model: request.model,
    max_tokens: request.maxOutputTokens,
    system: request.systemPrompt,
    messages: request.messages.map((message) => toAnthropicMessage(message, toolNames)),
    ...(tools.length > 0
      ? { tools, tool_choice: toAnthropicToolChoice(request.toolChoice) }
      : {}),
  };
}

function toAnthropicTool(tool: AiProviderToolSpec): Anthropic.Messages.Tool {
  if (!isAnthropicInputSchema(tool.inputSchema)) {
    throw invalidToolCallError('The provider request contains an invalid tool schema');
  }

  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  };
}

function toAnthropicToolChoice(
  choice: AiProviderToolChoice,
): Anthropic.Messages.ToolChoice {
  if (choice === 'auto') return { type: 'auto' };
  if (choice === 'any') return { type: 'any' };
  return { type: 'tool', name: choice.name };
}

function toAnthropicMessage(
  message: AiProviderMessage,
  toolNames: ReadonlySet<string>,
): Anthropic.Messages.MessageParam {
  if (message.role === 'user') {
    return { role: 'user', content: message.content };
  }

  if (message.role === 'tool') {
    return {
      role: 'user',
      content: message.toolResults.map((result) => ({
        type: 'tool_result',
        tool_use_id: result.toolCallId,
        content: result.content,
        ...(result.isError === undefined ? {} : { is_error: result.isError }),
      })),
    };
  }

  const toolCalls = message.toolCalls ?? [];
  if (toolCalls.length === 0) {
    return { role: 'assistant', content: message.content };
  }

  const content: Anthropic.Messages.ContentBlockParam[] = [];
  if (message.content.length > 0) {
    content.push({ type: 'text', text: message.content });
  }

  for (const toolCall of toolCalls) {
    if (!toolNames.has(toolCall.name) || !isPlainObject(toolCall.input)) {
      throw invalidToolCallError('Assistant history contains a malformed or unregistered tool call');
    }
    content.push({
      type: 'tool_use',
      id: toolCall.id,
      name: toolCall.name,
      input: toolCall.input,
    });
  }

  return { role: 'assistant', content };
}

function toProviderResponse(
  response: Anthropic.Messages.Message,
  request: AiProviderRequest,
  endpointTag: string,
): AiProviderResponse {
  const text = response.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  const registeredToolNames = new Set(request.tools.map((tool) => tool.name));
  const toolCalls = response.content
    .filter((block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use')
    .map((block) => {
      if (!registeredToolNames.has(block.name) || !isPlainObject(block.input)) {
        throw invalidToolCallError('Anthropic returned a malformed or unregistered tool call');
      }
      return { id: block.id, name: block.name, input: block.input };
    });

  return {
    text,
    toolCalls,
    stopReason: normalizeStopReason(response.stop_reason),
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    responseModel: response.model,
    endpointTag,
  };
}

function normalizeStopReason(
  stopReason: Anthropic.Messages.StopReason | null,
): AiProviderResponse['stopReason'] {
  switch (stopReason) {
    case 'tool_use':
      return 'tool_use';
    case 'max_tokens':
    case 'pause_turn':
      return 'max_tokens';
    case 'end_turn':
    case 'stop_sequence':
    case 'refusal':
      return 'end_turn';
    default:
      throw new ProviderAdapterError(
        'provider_rejected',
        'Anthropic returned a response without a supported stop reason',
        false,
      );
  }
}

function normalizeProviderError(error: unknown, signal?: AbortSignal): ProviderAdapterError {
  if (isAbortedProviderError(error, signal)) {
    return abortedError();
  }

  if (error instanceof Anthropic.APIConnectionError) {
    return new ProviderAdapterError(
      'provider_unavailable',
      'Anthropic could not be reached',
      true,
      error.requestID ? { requestId: error.requestID } : {},
    );
  }

  if (error instanceof Anthropic.APIError) {
    return normalizeApiError(error);
  }

  if (error instanceof ProviderAdapterError) {
    return error;
  }

  return new ProviderAdapterError(
    'internal',
    'The Anthropic adapter could not complete the request',
    false,
  );
}

function isAbortedProviderError(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true ||
    error instanceof Anthropic.APIUserAbortError ||
    (error instanceof Error && error.name === 'AbortError');
}

function normalizeApiError(error: APIError): ProviderAdapterError {
  const status = error.status;
  const retryable = status === 408 || status === 429 || (status !== undefined && status >= 500);
  return new ProviderAdapterError(
    retryable ? 'provider_unavailable' : 'provider_rejected',
    retryable ? 'Anthropic is temporarily unavailable' : 'Anthropic rejected the request',
    retryable,
    {
      ...(status === undefined ? {} : { status }),
      ...(error.requestID ? { requestId: error.requestID } : {}),
    },
  );
}

function abortedError(): ProviderAdapterError {
  return new ProviderAdapterError('aborted', 'The Anthropic request was aborted', false);
}

function invalidToolCallError(message: string): ProviderAdapterError {
  return new ProviderAdapterError('invalid_tool_call', message, false);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isAnthropicInputSchema(
  value: unknown,
): value is Anthropic.Messages.Tool['input_schema'] {
  return isPlainObject(value) && value.type === 'object';
}
