import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  aiAuditEvidenceSchema,
  type AiApprovalState,
  type AiAuditEvidence,
  type AiDataClass,
  type AiFailureCode,
  type AiGatewayRunFailure,
  type AiGatewayRunResult,
  type AiGatewayStreamEvent,
  type AiProviderId,
  type AiRunOutcome,
  type AiSyntheticProvenance,
  type AiUseCaseContractMap,
  type AiUseCaseId,
} from '@prism/types';
import { randomUUID } from 'node:crypto';
import type {
  AiGateway,
  AiGatewayCallOptions,
  AiProviderAdapter,
  AiProviderMessage,
  AiProviderRequest,
  AiProviderResponse,
  AiToolHandler,
  AiUseCaseDefinition,
} from '../../../contracts/ai-governance/ai-gateway.port';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import {
  AI_GATEWAY_RUNTIME_CONFIG,
  AI_PROVIDER_ADAPTERS,
  AI_SYNTHETIC_PROVENANCE_VERIFIER,
  type AiGatewayRuntimeConfig,
} from './ai-gateway.config';
import { AI_USE_CASE_REGISTRY } from './ai-use-cases';

const MAX_INPUT_BYTES = 32_768;
const MAX_TOOL_RESULT_BYTES = 16_384;
const MAX_RETRY_ATTEMPTS = 3;

type GatewayFault = {
  outcome: Exclude<AiRunOutcome, 'completed'>;
  code: AiFailureCode;
  message: string;
  retryable: boolean;
  providerUsage?: AiProviderResponse['usage'];
};

class AiGatewayFault extends Error {
  constructor(readonly fault: GatewayFault) {
    super(fault.message);
    this.name = 'AiGatewayFault';
  }
}

function fail(
  outcome: GatewayFault['outcome'],
  code: AiFailureCode,
  message: string,
  retryable = false,
): never {
  throw new AiGatewayFault({ outcome, code, message, retryable });
}

function failForProviderUsage(usage: AiProviderResponse['usage']): never {
  throw new AiGatewayFault({
    outcome: 'failed',
    code: 'provider_rejected',
    message: 'The provider exceeded the gateway token bounds',
    retryable: false,
    providerUsage: usage,
  });
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const EMAIL_TEST_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const EMAIL_REDACT_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_TEST_RE = /(?=(?:\D*\d){10,})\+?[\d\s().-]{10,}/;
const PHONE_REDACT_RE = /(?=(?:\D*\d){10,})\+?[\d\s().-]{10,}/g;
const SSN_TEST_RE = /\b\d{3}-\d{2}-\d{4}\b/;
const SSN_REDACT_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const PAYMENT_CARD_TEST_RE = /\b(?:\d[ -]*?){13,19}\b/;
const PAYMENT_CARD_REDACT_RE = /\b(?:\d[ -]*?){13,19}\b/g;
const SAFE_STRUCTURED_STRING_KEYS = new Set([
  'eventdate',
  'category',
  'tier',
  'level',
  'id',
  'eventid',
  'triggerid',
  'supplierid',
  'inquiryid',
]);

function containsPii(value: unknown): boolean {
  if (typeof value === 'string') return EMAIL_TEST_RE.test(value) || PHONE_TEST_RE.test(value) || SSN_TEST_RE.test(value) || PAYMENT_CARD_TEST_RE.test(value);
  if (Array.isArray(value)) return value.some(containsPii);
  if (value && typeof value === 'object') return Object.values(value).some(containsPii);
  return false;
}

function redactString(value: string): string {
  return value
    .replace(EMAIL_REDACT_RE, '[email redacted]')
    .replace(PHONE_REDACT_RE, '[phone redacted]')
    .replace(SSN_REDACT_RE, '[identifier redacted]')
    .replace(PAYMENT_CARD_REDACT_RE, '[payment data redacted]');
}

function minimizeValue(
  key: string,
  value: unknown,
  synthetic: boolean,
  parentKey = '',
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => minimizeValue(key, item, synthetic, parentKey));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        minimizeValue(childKey, childValue, synthetic, key),
      ]),
    );
  }
  if (typeof value !== 'string') return value;
  if (synthetic) return redactString(value);
  if (/^(?:client|supplier|guest|contact).*name$/i.test(key) || key.toLowerCase() === 'name') {
    const nameContext = `${parentKey}.${key}`.toLowerCase();
    if (nameContext.includes('supplier')) return 'Supplier X';
    if (nameContext.includes('guest')) return 'Guest';
    if (nameContext.includes('contact')) return 'Contact';
    return 'Client A';
  }
  if (/^(?:id|(?:event|inquiry|trigger|supplier|guest|client).*id)$/i.test(key)) {
    return '[identifier redacted]';
  }
  if (/^(?:email|phone|mobile|address|ipaddress|dateofbirth)$/i.test(key)) return '[redacted]';
  if (SAFE_STRUCTURED_STRING_KEYS.has(key.toLowerCase())) return redactString(value);
  return '[free text redacted]';
}

function useCaseDataClasses(definition: AiUseCaseDefinition<AiUseCaseId>, synthetic: boolean): AiDataClass[] {
  if (synthetic) return ['synthetic'];
  const classes = definition.dataClasses.filter((dataClass) => dataClass !== 'synthetic');
  return classes.length > 0 ? [...new Set(classes)] : ['internal'];
}

function currentUtcDate(): Date {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function abortError() {
  return new DOMException('The operation was aborted', 'AbortError');
}

function sleepWithSignal(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function providerRetryable(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'retryable' in error && (error as { retryable?: unknown }).retryable === true);
}

function providerStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

@Injectable()
export class AiGatewayService implements AiGateway, OnModuleInit {
  private readonly adaptersByProvider: ReadonlyMap<AiProviderId, AiProviderAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_GATEWAY_RUNTIME_CONFIG)
    private readonly runtime: AiGatewayRuntimeConfig,
    @Inject(AI_PROVIDER_ADAPTERS)
    adapters: AiProviderAdapter[],
    @Inject(AI_SYNTHETIC_PROVENANCE_VERIFIER)
    private readonly syntheticVerifier: { verify(input: unknown): Promise<AiSyntheticProvenance | null> },
  ) {
    this.adaptersByProvider = new Map(adapters.map((adapter) => [adapter.provider, adapter]));
  }

  onModuleInit(): void {
    if (this.runtime.liveUseCases.size > 0 && !this.adaptersByProvider.has('anthropic')) {
      throw new Error('AI live use cases are enabled but the Anthropic adapter is not registered');
    }
    if (!this.adaptersByProvider.has('mock')) {
      throw new Error('The required deterministic AI mock adapter is not registered');
    }
  }

  async run<K extends AiUseCaseId>(
    useCaseId: K,
    input: AiUseCaseContractMap[K]['input'],
    options?: AiGatewayCallOptions,
  ): Promise<AiGatewayRunResult<AiUseCaseContractMap[K]['output']>> {
    const result = await this.perform(useCaseId, input, options, false);
    return result as AiGatewayRunResult<AiUseCaseContractMap[K]['output']>;
  }

  async *stream<K extends AiUseCaseId>(
    useCaseId: K,
    input: AiUseCaseContractMap[K]['input'],
    options?: AiGatewayCallOptions,
  ): AsyncIterable<AiGatewayStreamEvent<AiUseCaseContractMap[K]['output']>> {
    const requestId = randomUUID();
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort();
    options?.signal?.addEventListener('abort', abortFromCaller, { once: true });
    if (options?.signal?.aborted) controller.abort();
    const streamOptions = { ...options, signal: controller.signal };
    let markAudited!: () => void;
    let rejectBeforeAudit!: (error: unknown) => void;
    const auditStarted = new Promise<void>((resolve, reject) => {
      markAudited = resolve;
      rejectBeforeAudit = reject;
    });
    const run = this.perform(useCaseId, input, streamOptions, true, requestId, markAudited).then(
      (result) => ({ result }) as const,
      (error: unknown) => {
        rejectBeforeAudit(error);
        return { error } as const;
      },
    );
    let finished = false;
    try {
      await auditStarted;
      yield { type: 'meta', requestId, useCaseId };
      const settled = await run;
      finished = true;
      if ('error' in settled) throw settled.error;
      const result = settled.result;
      if (result.outcome === 'completed') {
        const text = JSON.stringify(result.output);
        for (let offset = 0, sequence = 0; offset < text.length; offset += 256, sequence += 1) {
          yield { type: 'delta', requestId, sequence, text: text.slice(offset, offset + 256) };
        }
        yield { type: 'complete', requestId, result };
      } else {
        yield { type: 'failure', requestId, result };
      }
    } finally {
      options?.signal?.removeEventListener('abort', abortFromCaller);
      if (!finished) {
        controller.abort();
        await run;
      }
    }
  }

  private async perform<K extends AiUseCaseId>(
    useCaseId: K,
    input: AiUseCaseContractMap[K]['input'],
    options: AiGatewayCallOptions | undefined,
    useProviderStream: boolean,
    suppliedRequestId = randomUUID(),
    onAuditCreated?: () => void,
  ): Promise<AiGatewayRunResult<AiUseCaseContractMap[K]['output']>> {
    const requestId = suppliedRequestId;
    const correlationId = options?.correlationId && /^[A-Za-z0-9._:-]{1,128}$/.test(options.correlationId)
      ? options.correlationId
      : undefined;
    const definition = AI_USE_CASE_REGISTRY[useCaseId] as AiUseCaseDefinition<AiUseCaseId>;
    const route = this.runtime.profile.routesByTier[definition.modelTier];
    const startedAt = performance.now();
    const controller = new AbortController();
    let timeoutExpired = false;
    const timeout = setTimeout(() => {
      timeoutExpired = true;
      controller.abort();
    }, definition.limits.timeoutMs);
    const abortFromCaller = () => controller.abort();
    options?.signal?.addEventListener('abort', abortFromCaller, { once: true });
    if (options?.signal?.aborted) controller.abort();

    let parsedInput: unknown;
    let sanitizedPayload: unknown = {};
    let provenance: AiSyntheticProvenance | null = null;
    let dataClasses = useCaseDataClasses(definition, false);
    let auditCreated = false;
    let accumulatedInputTokens = 0;
    let accumulatedOutputTokens = 0;
    let responseModel: string | undefined;
    let endpointTag: string | undefined;
    let budgetDate: Date | undefined;

    const createAudit = async () => {
      await this.prisma.opsAiAuditLog.create({
        data: {
          id: `aia_${requestId}`,
          requestId,
          correlationId: correlationId ?? null,
          useCaseId,
          promptVersion: definition.promptVersion,
          profileId: this.runtime.profileId,
          provider: route.provider,
          requestedModel: route.model,
          eventId: !provenance && typeof (parsedInput as { eventId?: unknown } | undefined)?.eventId === 'string'
            ? (parsedInput as { eventId: string }).eventId
            : null,
          featureName: useCaseId,
          modelVersion: route.model,
          dataCategories: toPrismaJson(dataClasses),
          sanitizedPayload: toPrismaJson(sanitizedPayload as Record<string, unknown>),
          zdrConfirmed: route.zdrBasis === 'provider-enforced',
          humanApprovalRequired: true,
          humanApproved: false,
          status: 'running',
          reservedTokens: 0,
        },
      });
      auditCreated = true;
      onAuditCreated?.();
    };

    const evidence = (outcome: AiRunOutcome): AiAuditEvidence => aiAuditEvidenceSchema.parse({
      requestId,
      ...(correlationId ? { correlationId } : {}),
      useCaseId,
      promptVersion: definition.promptVersion,
      profileId: this.runtime.profileId,
      provider: route.provider,
      requestedModel: route.model,
      ...(responseModel ? { responseModel } : {}),
      ...(endpointTag ? { endpointTag } : {}),
      zdrBasis: route.zdrBasis,
      dataClasses,
      ...((accumulatedInputTokens || accumulatedOutputTokens)
        ? { usage: { inputTokens: accumulatedInputTokens, outputTokens: accumulatedOutputTokens } }
        : {}),
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      outcome,
      approvalState: 'pending' satisfies AiApprovalState,
      ...(provenance ? { syntheticProvenance: provenance } : {}),
    });

    const finishAudit = async (outcome: AiRunOutcome, failureCode?: AiFailureCode) => {
      if (!auditCreated) await createAudit();
      await this.prisma.opsAiAuditLog.update({
        where: { id: `aia_${requestId}` },
        data: {
          status: outcome,
          outcome,
          dataCategories: toPrismaJson(dataClasses),
          sanitizedPayload: toPrismaJson(sanitizedPayload as Record<string, unknown>),
          syntheticProvenance: provenance ? toPrismaJson(provenance) : Prisma.DbNull,
          zdrBasis: route.zdrBasis,
          inputTokens: accumulatedInputTokens || null,
          outputTokens: accumulatedOutputTokens || null,
          latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
          ...(responseModel ? { responseModel } : {}),
          ...(endpointTag ? { endpointTag } : {}),
          ...(budgetDate ? { budgetDate } : {}),
          reservedTokens: 0,
          approvalState: 'pending',
          ...(failureCode ? { failureCode } : {}),
        },
      });
    };

    try {
      const inputResult = definition.inputSchema.safeParse(input);
      if (!inputResult.success) {
        await createAudit();
        fail('blocked', 'invalid_input', 'Input did not match the registered use-case contract');
      }

      parsedInput = inputResult.data;
      try {
        provenance = await this.syntheticVerifier.verify(parsedInput);
      } catch {
        provenance = null;
      }
      dataClasses = useCaseDataClasses(definition, Boolean(provenance));
      const minimized = minimizeValue('input', parsedInput, Boolean(provenance));
      const minimizedResult = definition.inputSchema.safeParse(minimized);
      if (!minimizedResult.success || !minimized || typeof minimized !== 'object') {
        await createAudit();
        fail('blocked', 'invalid_input', 'Input could not be safely minimized');
      }
      sanitizedPayload = minimizedResult.data;
      if (Buffer.byteLength(canonicalJson(sanitizedPayload)) > MAX_INPUT_BYTES) {
        sanitizedPayload = {};
        await createAudit();
        fail('blocked', 'invalid_input', 'Minimized input exceeded the gateway size limit');
      }
      await createAudit();

      if (this.runtime.profileId === 'test-anthropic') {
        if (!this.runtime.liveUseCases.has(useCaseId)) {
          fail('blocked', 'use_case_disabled', 'This use case is not enabled for live provider calls');
        }
        if (this.runtime.isProduction) {
          fail('blocked', 'configuration_invalid', 'The Anthropic test profile is disabled in production');
        }
        if (!provenance || dataClasses.length !== 1 || dataClasses[0] !== 'synthetic') {
          fail('blocked', 'synthetic_provenance_required', 'The Anthropic test route requires an exact server-registered synthetic fixture');
        }
      }

      const allowedClasses = new Set(route.allowedDataClasses);
      if (dataClasses.some((dataClass) => !allowedClasses.has(dataClass))) {
        fail(
          'blocked',
          route.zdrBasis === 'none' ? 'synthetic_provenance_required' : 'zdr_required',
          'The selected route does not allow this data classification',
        );
      }
      if (definition.requiresZdr && route.zdrBasis !== 'provider-enforced' && !provenance) {
        fail('blocked', 'zdr_required', 'Real-data use cases require a provider-enforced ZDR route');
      }
      if (containsPii(sanitizedPayload)) {
        fail('blocked', 'synthetic_provenance_required', 'Minimized input still contains a high-risk personal-data pattern');
      }

      const adapter = this.adaptersByProvider.get(route.provider);
      if (!adapter) fail('unavailable', 'provider_unavailable', 'The selected provider adapter is not registered', true);

      const toolHandlers = options?.tools ?? definition.tools ?? [];
      const toolsByName = this.validateToolHandlers(toolHandlers);
      let messages: AiProviderMessage[] = [{ role: 'user', content: canonicalJson(sanitizedPayload) }];
      let totalSteps = 0;

      while (totalSteps < definition.limits.maxSteps) {
        if (controller.signal.aborted) {
          if (options?.signal?.aborted) fail('aborted', 'aborted', 'The AI run was aborted');
          fail('unavailable', 'timeout', 'The AI run exceeded its configured timeout', true);
        }
        const remainingOutput = definition.limits.maxOutputTokens - accumulatedOutputTokens;
        if (remainingOutput <= 0) fail('incomplete', 'step_limit', 'The run exhausted its output-token allowance');

        const request: AiProviderRequest = {
          model: route.model,
          systemPrompt: definition.systemPrompt,
          messages,
          tools: [...toolsByName.values()].map((handler) => ({
            name: handler.name,
            description: handler.description,
            inputSchema: handler.inputSchema.toJSONSchema() as Record<string, unknown>,
          })),
          toolChoice: 'auto',
          maxOutputTokens: remainingOutput,
        };
        budgetDate = currentUtcDate();
        totalSteps += 1;
        const response = await this.callProviderWithRetry(
          adapter,
          request,
          controller.signal,
          useProviderStream,
          requestId,
          useCaseId,
          budgetDate,
          definition.limits.dailyTokenBudget,
        );
        accumulatedInputTokens += response.usage.inputTokens;
        accumulatedOutputTokens += response.usage.outputTokens;
        responseModel = response.responseModel;
        endpointTag = response.endpointTag;

        if (response.stopReason === 'max_tokens') {
          fail('incomplete', 'step_limit', 'The provider stopped at the output-token limit');
        }

        if (response.toolCalls.length > 0) {
          if (totalSteps >= definition.limits.maxSteps) {
            fail('incomplete', 'step_limit', 'The tool loop exhausted its configured step limit');
          }
          const preparedCalls: {
            call: AiProviderResponse['toolCalls'][number];
            handler: AiToolHandler;
            input: unknown;
          }[] = [];
          const toolCallIds = new Set<string>();
          for (const call of response.toolCalls) {
            if (
              !call ||
              typeof call.id !== 'string' ||
              !/^[A-Za-z0-9_.:-]{1,128}$/.test(call.id) ||
              toolCallIds.has(call.id) ||
              typeof call.name !== 'string' ||
              !/^[a-z][a-z0-9_]{0,63}$/.test(call.name)
            ) {
              fail('failed', 'invalid_tool_call', 'The provider returned an invalid or duplicate tool call');
            }
            toolCallIds.add(call.id);
            const handler = toolsByName.get(call.name);
            if (!handler) fail('failed', 'invalid_tool_call', 'The provider requested an unregistered tool');
            const toolInput = handler.inputSchema.safeParse(call.input);
            if (!toolInput.success) fail('failed', 'invalid_tool_call', 'The provider returned invalid tool input');
            if (containsPii(toolInput.data)) {
              fail('blocked', 'invalid_tool_call', 'The provider returned tool input with a high-risk personal-data pattern');
            }
            preparedCalls.push({ call, handler, input: toolInput.data });
          }

          const toolResults: { toolCallId: string; content: string; isError?: boolean }[] = [];
          for (const { call, handler, input: toolInput } of preparedCalls) {
            const content = await handler.execute(toolInput, controller.signal);
            if (
              typeof content !== 'string' ||
              Buffer.byteLength(content) > MAX_TOOL_RESULT_BYTES ||
              containsPii(content)
            ) {
              fail('blocked', 'invalid_tool_call', 'Tool output exceeded safety checks');
            }
            let providerContent = content;
            if (route.zdrBasis === 'none' && route.provider !== 'mock') {
              let parsedToolResult: unknown;
              try {
                parsedToolResult = JSON.parse(content);
              } catch {
                fail('blocked', 'synthetic_provenance_required', 'The tool result was not a registered synthetic fixture');
              }
              const toolProvenance = await this.syntheticVerifier.verify(parsedToolResult);
              if (!toolProvenance) {
                fail('blocked', 'synthetic_provenance_required', 'The tool result was not a registered synthetic fixture');
              }
              providerContent = canonicalJson(parsedToolResult);
            }
            toolResults.push({ toolCallId: call.id, content: providerContent });
          }
          messages = [
            ...messages,
            { role: 'assistant', content: response.text, toolCalls: response.toolCalls },
            { role: 'tool', toolResults },
          ];
          continue;
        }

        let rawOutput: unknown;
        try {
          rawOutput = JSON.parse(response.text);
        } catch {
          fail('failed', 'invalid_output', 'The AI provider returned output that was not valid JSON');
        }
        if (containsPii(rawOutput)) fail('failed', 'invalid_output', 'The AI provider returned a high-risk personal-data pattern');
        const outputResult = definition.outputSchema.safeParse(rawOutput);
        if (!outputResult.success) fail('failed', 'invalid_output', 'The AI provider output did not match the registered response contract');

        const result = {
          outcome: 'completed' as const,
          output: outputResult.data,
          evidence: evidence('completed'),
        };
        await finishAudit('completed');
        return result;
      }

      fail('incomplete', 'step_limit', 'The tool loop exhausted its configured step limit');
    } catch (error) {
      if (!auditCreated) {
        // If audit persistence itself failed, stop before any provider call.
        if (!(error instanceof AiGatewayFault)) throw error;
        await createAudit();
      }
      if (error instanceof AiGatewayFault && error.fault.providerUsage) {
        accumulatedInputTokens += error.fault.providerUsage.inputTokens;
        accumulatedOutputTokens += error.fault.providerUsage.outputTokens;
      }
      const fault = error instanceof AiGatewayFault
        ? error.fault
        : options?.signal?.aborted
          ? { outcome: 'aborted' as const, code: 'aborted' as const, message: 'The AI run was aborted', retryable: false }
          : timeoutExpired
            ? { outcome: 'unavailable' as const, code: 'timeout' as const, message: 'The AI run exceeded its configured timeout', retryable: true }
            : { outcome: 'failed' as const, code: 'internal' as const, message: 'The AI run failed unexpectedly', retryable: false };
      await finishAudit(fault.outcome, fault.code);
      const failure: AiGatewayRunFailure = {
        outcome: fault.outcome,
        error: { code: fault.code, message: fault.message, retryable: fault.retryable },
        evidence: evidence(fault.outcome),
      };
      return failure;
    } finally {
      clearTimeout(timeout);
      options?.signal?.removeEventListener('abort', abortFromCaller);
    }
    return fail('failed', 'internal', 'The AI gateway ended without a result');
  }

  private validateToolHandlers(handlers: readonly AiToolHandler[]): Map<string, AiToolHandler> {
    const byName = new Map<string, AiToolHandler>();
    for (const handler of handlers) {
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(handler.name) || byName.has(handler.name)) {
        fail('blocked', 'invalid_tool_call', 'Registered tool names must be unique and valid');
      }
      byName.set(handler.name, handler);
    }
    return byName;
  }

  private estimateReservation(request: AiProviderRequest): number {
    const serialized = canonicalJson({
      systemPrompt: request.systemPrompt,
      messages: request.messages,
      tools: request.tools,
    });
    return Buffer.byteLength(serialized) + request.maxOutputTokens;
  }

  private async callProviderWithRetry(
    adapter: AiProviderAdapter,
    request: AiProviderRequest,
    signal: AbortSignal,
    useStream: boolean,
    requestId: string,
    useCaseId: AiUseCaseId,
    usageDate: Date,
    dailyBudget: number,
  ): Promise<AiProviderResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
      const reservation = Math.max(1, this.estimateReservation(request));
      const reserved = await this.reserveBudget(requestId, useCaseId, usageDate, reservation, dailyBudget);
      if (!reserved) fail('unavailable', 'provider_unavailable', 'The daily token budget is exhausted');
      if (signal.aborted) {
        await this.releaseReservation(requestId, useCaseId, usageDate, reservation);
        throw abortError();
      }
      try {
        let response: AiProviderResponse;
        if (!useStream) {
          response = await adapter.run(request, signal);
        } else {
          let finalResponse: AiProviderResponse | undefined;
          for await (const event of adapter.stream(request, signal)) {
            if (event.type === 'final') {
              if (finalResponse) throw new Error('Provider stream emitted more than one final response');
              finalResponse = event.response;
            }
          }
          if (!finalResponse) throw new Error('Provider stream ended without a final response');
          response = finalResponse;
        }
        this.validateProviderResponse(response);
        const { inputTokens, outputTokens } = response.usage;
        const actual = inputTokens + outputTokens;
        if (
          !Number.isSafeInteger(inputTokens) ||
          !Number.isSafeInteger(outputTokens) ||
          inputTokens < 0 ||
          outputTokens < 0
        ) {
          throw new Error('The provider returned usage outside the reserved token bound');
        }
        if (actual > reservation || outputTokens > request.maxOutputTokens) {
          failForProviderUsage(response.usage);
        }
        await this.reconcileReservation(requestId, useCaseId, usageDate, reservation, response.usage);
        return response;
      } catch (error) {
        lastError = error;
        await this.consumeUnknownReservation(requestId, useCaseId, usageDate, reservation);
        if (error instanceof AiGatewayFault) throw error;
        if (signal.aborted) throw error;
        const status = providerStatus(error);
        const retryable = providerRetryable(error) || status === 429 || (status !== undefined && status >= 500);
        if (!retryable) fail('failed', 'provider_rejected', 'The AI provider rejected the request');
        if (attempt === MAX_RETRY_ATTEMPTS - 1) {
          fail('unavailable', 'provider_unavailable', 'The AI provider is temporarily unavailable', true);
        }
        await sleepWithSignal(200 * (attempt + 1), signal);
      }
    }
    throw lastError;
  }

  private validateProviderResponse(response: AiProviderResponse): void {
    if (
      !response ||
      typeof response.text !== 'string' ||
      Buffer.byteLength(response.text) > 65_536 ||
      !Array.isArray(response.toolCalls) ||
      response.toolCalls.length > 64 ||
      !response.usage ||
      !Number.isSafeInteger(response.usage.inputTokens) ||
      !Number.isSafeInteger(response.usage.outputTokens) ||
      response.usage.inputTokens < 0 ||
      response.usage.outputTokens < 0 ||
      !['end_turn', 'max_tokens', 'tool_use'].includes(response.stopReason)
    ) {
      fail('failed', 'provider_rejected', 'The AI provider returned a malformed response');
    }
    if (
      (response.responseModel !== undefined && !/^[A-Za-z0-9._:/-]{1,128}$/.test(response.responseModel)) ||
      (response.endpointTag !== undefined && !/^[A-Za-z0-9._:/-]{1,128}$/.test(response.endpointTag))
    ) {
      fail('failed', 'provider_rejected', 'The AI provider returned invalid response metadata');
    }
  }

  private async reserveBudget(
    requestId: string,
    useCaseId: AiUseCaseId,
    usageDate: Date,
    amount: number,
    dailyBudget: number,
  ): Promise<boolean> {
    if (amount > dailyBudget) return false;
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO "trust_ops"."ai_daily_token_usage" AS daily_usage
          ("id", "use_case_id", "usage_date", "reserved_tokens", "consumed_tokens", "updated_at")
        VALUES (${`aib_${randomUUID()}`}, ${useCaseId}, ${usageDate}::date, ${amount}, 0, NOW())
        ON CONFLICT ("use_case_id", "usage_date") DO UPDATE
        SET "reserved_tokens" = daily_usage."reserved_tokens" + EXCLUDED."reserved_tokens",
            "updated_at" = NOW()
        WHERE daily_usage."reserved_tokens"
              + daily_usage."consumed_tokens"
              + EXCLUDED."reserved_tokens" <= ${dailyBudget}
        RETURNING "id"
      `);
      if (rows.length === 0) return false;
      await tx.opsAiAuditLog.update({
        where: { id: `aia_${requestId}` },
        data: { reservedTokens: { increment: amount }, budgetDate: usageDate },
      });
      return true;
    });
  }

  private async reconcileReservation(
    requestId: string,
    useCaseId: AiUseCaseId,
    usageDate: Date,
    reserved: number,
    usage: { inputTokens: number; outputTokens: number },
  ): Promise<void> {
    const actual = usage.inputTokens + usage.outputTokens;
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "trust_ops"."ai_daily_token_usage"
        SET "reserved_tokens" = "reserved_tokens" - ${reserved},
            "consumed_tokens" = "consumed_tokens" + ${actual},
            "updated_at" = NOW()
        WHERE "use_case_id" = ${useCaseId} AND "usage_date" = ${usageDate}::date
      `);
      await tx.opsAiAuditLog.update({
        where: { id: `aia_${requestId}` },
        data: {
          reservedTokens: { decrement: reserved },
          inputTokens: { increment: usage.inputTokens },
          outputTokens: { increment: usage.outputTokens },
        },
      });
    });
  }

  private async consumeUnknownReservation(
    requestId: string,
    useCaseId: AiUseCaseId,
    usageDate: Date,
    reserved: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "trust_ops"."ai_daily_token_usage"
        SET "reserved_tokens" = "reserved_tokens" - ${reserved},
            "consumed_tokens" = "consumed_tokens" + ${reserved},
            "updated_at" = NOW()
        WHERE "use_case_id" = ${useCaseId} AND "usage_date" = ${usageDate}::date
      `);
      await tx.opsAiAuditLog.update({
        where: { id: `aia_${requestId}` },
        data: { reservedTokens: { decrement: reserved } },
      });
    });
  }

  private async releaseReservation(
    requestId: string,
    useCaseId: AiUseCaseId,
    usageDate: Date,
    reserved: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "trust_ops"."ai_daily_token_usage"
        SET "reserved_tokens" = "reserved_tokens" - ${reserved},
            "updated_at" = NOW()
        WHERE "use_case_id" = ${useCaseId} AND "usage_date" = ${usageDate}::date
      `);
      await tx.opsAiAuditLog.update({
        where: { id: `aia_${requestId}` },
        data: { reservedTokens: { decrement: reserved } },
      });
    });
  }
}
