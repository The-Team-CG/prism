import type { ZodType } from 'zod';
import type {
  AiDataClass,
  AiDeliveryMode,
  AiGatewayRunResult,
  AiGatewayStreamEvent,
  AiModelTier,
  AiProviderId,
  AiRouteProfileId,
  AiSyntheticProvenance,
  AiUseCaseContractMap,
  AiUseCaseId,
  AiUseCaseLimits,
} from '@prism/types';

export const AI_GATEWAY = Symbol('AI_GATEWAY');

export type AiToolHandler<TInput = unknown> = {
  name: string;
  description: string;
  inputSchema: ZodType<TInput>;
  execute(input: TInput, signal?: AbortSignal): Promise<string>;
};

export type AiGatewayCallOptions = {
  correlationId?: string;
  tools?: readonly AiToolHandler[];
  signal?: AbortSignal;
};

export interface AiGateway {
  run<K extends AiUseCaseId>(
    useCaseId: K,
    input: AiUseCaseContractMap[K]['input'],
    options?: AiGatewayCallOptions,
  ): Promise<AiGatewayRunResult<AiUseCaseContractMap[K]['output']>>;

  stream<K extends AiUseCaseId>(
    useCaseId: K,
    input: AiUseCaseContractMap[K]['input'],
    options?: AiGatewayCallOptions,
  ): AsyncIterable<AiGatewayStreamEvent<AiUseCaseContractMap[K]['output']>>;
}

export type AiUseCaseDefinition<K extends AiUseCaseId> = {
  id: K;
  promptVersion: string;
  systemPrompt: string;
  inputSchema: ZodType<AiUseCaseContractMap[K]['input']>;
  outputSchema: ZodType<AiUseCaseContractMap[K]['output']>;
  modelTier: AiModelTier;
  dataClasses: readonly AiDataClass[];
  requiresZdr: boolean;
  approval: 'pmcm-required';
  limits: AiUseCaseLimits;
  delivery: AiDeliveryMode;
  tools?: readonly AiToolHandler[];
};

export type AiUseCaseRegistry = {
  [K in AiUseCaseId]: AiUseCaseDefinition<K>;
};

export type AiProviderToolCall = {
  id: string;
  name: string;
  input: unknown;
};

export type AiProviderToolResult = {
  toolCallId: string;
  content: string;
  isError?: boolean;
};

export type AiProviderMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: AiProviderToolCall[] }
  | { role: 'tool'; toolResults: AiProviderToolResult[] };

export type AiProviderToolSpec = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type AiProviderToolChoice =
  | 'auto'
  | 'any'
  | { type: 'tool'; name: string };

export type AiProviderRequest = {
  model: string;
  systemPrompt: string;
  messages: AiProviderMessage[];
  tools: AiProviderToolSpec[];
  toolChoice: AiProviderToolChoice;
  maxOutputTokens: number;
};

export type AiProviderResponse = {
  text: string;
  toolCalls: AiProviderToolCall[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens';
  usage: { inputTokens: number; outputTokens: number };
  responseModel?: string;
  endpointTag?: string;
};

export type AiProviderStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'final'; response: AiProviderResponse };

export interface AiProviderAdapter {
  readonly provider: AiProviderId;
  run(request: AiProviderRequest, signal?: AbortSignal): Promise<AiProviderResponse>;
  stream(request: AiProviderRequest, signal?: AbortSignal): AsyncIterable<AiProviderStreamEvent>;
}

/** Implementations must verify the source record; callers cannot assert provenance. */
export interface AiSyntheticProvenanceVerifier {
  verify(input: unknown): Promise<AiSyntheticProvenance | null>;
}

export type AiResolvedRoute = {
  profileId: AiRouteProfileId;
  provider: AiProviderId;
  model: string;
  modelTier: AiModelTier;
  dataClasses: readonly AiDataClass[];
  requiresZdr: boolean;
};
