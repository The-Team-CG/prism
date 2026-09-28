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
  type AiRoutePolicyOutcome,
  type AiProviderId,
  type AiRoute,
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
  computeAiRouteRevision,
  resolveAiRoute,
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

type GatewayRunState = {
  requestId: string;
  correlationId?: string;
  useCaseId: AiUseCaseId;
  definition: AiUseCaseDefinition<AiUseCaseId>;
  route: AiRoute;
  routeRevision: string;
  routePolicyOutcome: AiRoutePolicyOutcome;
  startedAt: number;
  controller: AbortController;
  timeoutExpired: boolean;
  parsedInput?: unknown;
  sanitizedPayload: unknown;
  provenance: AiSyntheticProvenance | null;
  dataClasses: AiDataClass[];
  auditCreated: boolean;
  accumulatedInputTokens: number;
  accumulatedOutputTokens: number;
  responseModel?: string;
  endpointTag?: string;
  budgetDate?: Date;
  onAuditCreated?: () => void;
};

type PreparedToolCall = {
  call: AiProviderResponse['toolCalls'][number];
  handler: AiToolHandler;
  input: unknown;
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

function providerJsonText(text: string): string {
  const trimmed = text.trim();
  const fence = /^```json[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);
  return fence ? fence[1] : trimmed;
}

const EMAIL_TEST_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const EMAIL_REDACT_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_TEST_RE = /\+?(?=(?:[\d\s().-]*\d){10,})[\d\s().-]{10,}/;
const PHONE_REDACT_RE = /\+?(?=(?:[\d\s().-]*\d){10,})[\d\s().-]{10,}/g;
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
  return minimizeStringValue(key, value, synthetic, parentKey);
}

function minimizeStringValue(key: string, value: string, synthetic: boolean, parentKey: string): string {
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
    if (!this.adaptersByProvider.has('mock')) {
      throw new Error('The required deterministic AI mock adapter is not registered');
    }
    for (const useCaseId of this.runtime.liveUseCases) {
      const definition = AI_USE_CASE_REGISTRY[useCaseId];
      const route = resolveAiRoute(this.runtime.profile, useCaseId, definition.modelTier);
      const adapter = this.adaptersByProvider.get(route.provider);
      if (!adapter) throw new Error(`AI live use case ${useCaseId} has no registered ${route.provider} adapter`);
      if (adapter.endpointPolicyId !== route.endpointPolicyId) {
        throw new Error(`AI live use case ${useCaseId} endpoint policy does not match its ${route.provider} adapter`);
      }
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
    const definition = AI_USE_CASE_REGISTRY[useCaseId] as AiUseCaseDefinition<AiUseCaseId>;
    const controller = new AbortController();
    const state: GatewayRunState = {
      requestId: suppliedRequestId,
      correlationId: options?.correlationId && /^[A-Za-z0-9._:-]{1,128}$/.test(options.correlationId)
        ? options.correlationId
        : undefined,
      useCaseId,
      definition,
      route: resolveAiRoute(this.runtime.profile, useCaseId, definition.modelTier),
      routeRevision: computeAiRouteRevision(this.runtime.profile, useCaseId, definition.modelTier),
      routePolicyOutcome: 'denied',
      startedAt: performance.now(),
      controller,
      timeoutExpired: false,
      sanitizedPayload: {},
      provenance: null,
      dataClasses: useCaseDataClasses(definition, false),
      auditCreated: false,
      accumulatedInputTokens: 0,
      accumulatedOutputTokens: 0,
      onAuditCreated,
    };
    const timeout = setTimeout(() => {
      state.timeoutExpired = true;
      controller.abort();
    }, definition.limits.timeoutMs);
    const abortFromCaller = () => controller.abort();
    options?.signal?.addEventListener('abort', abortFromCaller, { once: true });
    if (options?.signal?.aborted) controller.abort();

    try {
      await this.prepareInput(state, input);
      this.enforceRoute(state);
      return await this.runSteps(state, options, useProviderStream) as AiGatewayRunResult<AiUseCaseContractMap[K]['output']>;
    } catch (error) {
      return await this.finishFailure(state, error, options?.signal);
    } finally {
      clearTimeout(timeout);
      options?.signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  private async createAudit(state: GatewayRunState): Promise<void> {
    const { requestId, correlationId, useCaseId, definition, route } = state;
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
        eventId: !state.provenance && typeof (state.parsedInput as { eventId?: unknown } | undefined)?.eventId === 'string'
          ? (state.parsedInput as { eventId: string }).eventId
          : null,
        featureName: useCaseId,
        modelVersion: route.model,
        dataCategories: toPrismaJson(state.dataClasses),
        sanitizedPayload: toPrismaJson(this.auditPayload(state)),
        zdrConfirmed: route.zdrBasis === 'provider-enforced',
        humanApprovalRequired: true,
        humanApproved: false,
        status: 'running',
        reservedTokens: 0,
      },
    });
    state.auditCreated = true;
    state.onAuditCreated?.();
  }

  private evidence(state: GatewayRunState, outcome: AiRunOutcome): AiAuditEvidence {
    const { requestId, correlationId, useCaseId, definition, route } = state;
    return aiAuditEvidenceSchema.parse({
      requestId,
      ...(correlationId ? { correlationId } : {}),
      useCaseId,
      promptVersion: definition.promptVersion,
      profileId: this.runtime.profileId,
      provider: route.provider,
      requestedModel: route.model,
      routeRevision: state.routeRevision,
      routePolicyOutcome: state.routePolicyOutcome,
      ...(state.responseModel ? { responseModel: state.responseModel } : {}),
      ...(state.endpointTag ? { endpointTag: state.endpointTag } : {}),
      zdrBasis: route.zdrBasis,
      dataClasses: state.dataClasses,
      ...((state.accumulatedInputTokens || state.accumulatedOutputTokens)
        ? { usage: { inputTokens: state.accumulatedInputTokens, outputTokens: state.accumulatedOutputTokens } }
        : {}),
      latencyMs: Math.max(0, Math.round(performance.now() - state.startedAt)),
      outcome,
      approvalState: 'pending' satisfies AiApprovalState,
      ...(state.provenance ? { syntheticProvenance: state.provenance } : {}),
    });
  }

  private async finishAudit(state: GatewayRunState, outcome: AiRunOutcome, failureCode?: AiFailureCode): Promise<void> {
    if (!state.auditCreated) await this.createAudit(state);
    await this.prisma.opsAiAuditLog.update({
      where: { id: `aia_${state.requestId}` },
      data: {
        status: outcome,
        outcome,
        dataCategories: toPrismaJson(state.dataClasses),
        sanitizedPayload: toPrismaJson(this.auditPayload(state)),
        syntheticProvenance: state.provenance ? toPrismaJson(state.provenance) : Prisma.DbNull,
        zdrBasis: state.route.zdrBasis,
        inputTokens: state.accumulatedInputTokens || null,
        outputTokens: state.accumulatedOutputTokens || null,
        latencyMs: Math.max(0, Math.round(performance.now() - state.startedAt)),
        ...(state.responseModel ? { responseModel: state.responseModel } : {}),
        ...(state.endpointTag ? { endpointTag: state.endpointTag } : {}),
        ...(state.budgetDate ? { budgetDate: state.budgetDate } : {}),
        reservedTokens: 0,
        approvalState: 'pending',
        ...(failureCode ? { failureCode } : {}),
      },
    });
  }

  private async prepareInput(state: GatewayRunState, input: unknown): Promise<void> {
    const inputResult = state.definition.inputSchema.safeParse(input);
    if (!inputResult.success) {
      await this.createAudit(state);
      fail('blocked', 'invalid_input', 'Input did not match the registered use-case contract');
    }
    state.parsedInput = inputResult.data;
    try {
      state.provenance = await this.syntheticVerifier.verify(state.parsedInput);
    } catch {
      state.provenance = null;
    }
    state.dataClasses = useCaseDataClasses(state.definition, Boolean(state.provenance));
    const minimized = minimizeValue('input', state.parsedInput, Boolean(state.provenance));
    const minimizedResult = state.definition.inputSchema.safeParse(minimized);
    if (!minimizedResult.success || !minimized || typeof minimized !== 'object') {
      await this.createAudit(state);
      fail('blocked', 'invalid_input', 'Input could not be safely minimized');
    }
    state.sanitizedPayload = minimizedResult.data;
    if (Buffer.byteLength(canonicalJson(state.sanitizedPayload)) > MAX_INPUT_BYTES) {
      state.sanitizedPayload = {};
      await this.createAudit(state);
      fail('blocked', 'invalid_input', 'Minimized input exceeded the gateway size limit');
    }
    await this.createAudit(state);
  }

  private auditPayload(state: GatewayRunState): Record<string, unknown> {
    const input = state.sanitizedPayload && typeof state.sanitizedPayload === 'object' && !Array.isArray(state.sanitizedPayload)
      ? state.sanitizedPayload as Record<string, unknown>
      : {};
    return {
      ...input,
      _aiGatewayRoute: {
        routeRevision: state.routeRevision,
        routePolicyOutcome: state.routePolicyOutcome,
        endpointPolicyId: state.route.endpointPolicyId,
      },
    };
  }

  private enforceRoute(state: GatewayRunState): void {
    const { route, provenance, dataClasses, definition, sanitizedPayload } = state;
    if (route.provider !== 'mock' && !this.runtime.liveUseCases.has(state.useCaseId)) {
      fail('blocked', 'use_case_disabled', 'This use case is not enabled for live provider calls');
    }
    if (route.provider === 'mock' && this.runtime.liveUseCases.has(state.useCaseId)) {
      fail('blocked', 'configuration_invalid', 'An enabled live use case cannot resolve to the mock provider');
    }
    if (this.runtime.isProduction && route.provider !== 'mock' &&
      route.allowedDataClasses.length === 1 && route.allowedDataClasses[0] === 'synthetic') {
      fail('blocked', 'configuration_invalid', 'Synthetic-only external routes are disabled in production');
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
    if (route.provider !== 'mock' && route.zdrBasis === 'none' &&
      (!provenance || dataClasses.length !== 1 || dataClasses[0] !== 'synthetic')) {
      fail('blocked', 'synthetic_provenance_required', 'A non-ZDR external route requires verified synthetic data');
    }
    if (containsPii(sanitizedPayload)) {
      fail('blocked', 'synthetic_provenance_required', 'Minimized input still contains a high-risk personal-data pattern');
    }
    state.routePolicyOutcome = route.provider === 'mock'
      ? 'mock_local'
      : route.zdrBasis === 'provider-enforced' ? 'zdr_approved' : 'synthetic_verified';
  }

  private async runSteps(
    state: GatewayRunState,
    options: AiGatewayCallOptions | undefined,
    useProviderStream: boolean,
  ): Promise<AiGatewayRunResult<unknown>> {
    const adapter = this.adaptersByProvider.get(state.route.provider);
    if (!adapter) fail('unavailable', 'provider_unavailable', 'The selected provider adapter is not registered', true);
    if (state.route.provider !== 'mock' && adapter.endpointPolicyId !== state.route.endpointPolicyId) {
      fail('blocked', 'configuration_invalid', 'The selected provider adapter does not match the reviewed endpoint policy');
    }
    const toolsByName = this.validateToolHandlers(options?.tools ?? state.definition.tools ?? []);
    let messages: AiProviderMessage[] = [{ role: 'user', content: canonicalJson(state.sanitizedPayload) }];
    let totalSteps = 0;
    while (totalSteps < state.definition.limits.maxSteps) {
      this.assertStepAvailable(state, options?.signal);
      const remainingOutput = state.definition.limits.maxOutputTokens - state.accumulatedOutputTokens;
      if (remainingOutput <= 0) fail('incomplete', 'step_limit', 'The run exhausted its output-token allowance');
      const request = this.buildProviderRequest(state, messages, toolsByName, remainingOutput);
      state.budgetDate = currentUtcDate();
      totalSteps += 1;
      const response = await this.callProviderWithRetry(
        adapter,
        request,
        state.controller.signal,
        useProviderStream,
        state.requestId,
        state.useCaseId,
        state.budgetDate,
        state.definition.limits.dailyTokenBudget,
      );
      state.accumulatedInputTokens += response.usage.inputTokens;
      state.accumulatedOutputTokens += response.usage.outputTokens;
      state.responseModel = response.responseModel;
      if (response.endpointTag && response.endpointTag !== state.route.endpointPolicyId) {
        fail('failed', 'configuration_invalid', 'The provider response endpoint did not match the reviewed route');
      }
      state.endpointTag = response.endpointTag ?? adapter.endpointPolicyId ?? state.route.endpointPolicyId;
      if (response.stopReason === 'max_tokens') {
        fail('incomplete', 'step_limit', 'The provider stopped at the output-token limit');
      }
      if (response.toolCalls.length > 0) {
        if (totalSteps >= state.definition.limits.maxSteps) {
          fail('incomplete', 'step_limit', 'The tool loop exhausted its configured step limit');
        }
        messages = await this.appendToolMessages(state, messages, response, toolsByName);
        continue;
      }
      const output = this.parseOutput(state.definition, response.text);
      const result = { outcome: 'completed' as const, output, evidence: this.evidence(state, 'completed') };
      await this.finishAudit(state, 'completed');
      return result;
    }
    return fail('incomplete', 'step_limit', 'The tool loop exhausted its configured step limit');
  }

  private assertStepAvailable(state: GatewayRunState, callerSignal?: AbortSignal): void {
    if (!state.controller.signal.aborted) return;
    if (callerSignal?.aborted) fail('aborted', 'aborted', 'The AI run was aborted');
    fail('unavailable', 'timeout', 'The AI run exceeded its configured timeout', true);
  }

  private buildProviderRequest(
    state: GatewayRunState,
    messages: AiProviderMessage[],
    toolsByName: ReadonlyMap<string, AiToolHandler>,
    remainingOutput: number,
  ): AiProviderRequest {
    return {
      model: state.route.model,
      systemPrompt: state.definition.systemPrompt,
      messages,
      tools: [...toolsByName.values()].map((handler) => ({
        name: handler.name,
        description: handler.description,
        inputSchema: handler.inputSchema.toJSONSchema() as Record<string, unknown>,
      })),
      toolChoice: 'auto',
      outputSchema: state.definition.outputSchema.toJSONSchema() as Record<string, unknown>,
      maxOutputTokens: remainingOutput,
    };
  }

  private async appendToolMessages(
    state: GatewayRunState,
    messages: AiProviderMessage[],
    response: AiProviderResponse,
    toolsByName: ReadonlyMap<string, AiToolHandler>,
  ): Promise<AiProviderMessage[]> {
    const preparedCalls = this.prepareToolCalls(response.toolCalls, toolsByName);
    const toolResults = await this.executeToolCalls(state, preparedCalls);
    return [
      ...messages,
      { role: 'assistant', content: response.text, toolCalls: response.toolCalls },
      { role: 'tool', toolResults },
    ];
  }

  private prepareToolCalls(
    calls: AiProviderResponse['toolCalls'],
    toolsByName: ReadonlyMap<string, AiToolHandler>,
  ): PreparedToolCall[] {
    const preparedCalls: PreparedToolCall[] = [];
    const toolCallIds = new Set<string>();
    for (const call of calls) {
      if (!this.isValidToolCall(call, toolCallIds)) {
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
    return preparedCalls;
  }

  private isValidToolCall(call: AiProviderResponse['toolCalls'][number], seen: ReadonlySet<string>): boolean {
    return Boolean(
      call &&
      typeof call.id === 'string' &&
      /^[A-Za-z0-9_.:-]{1,128}$/.test(call.id) &&
      !seen.has(call.id) &&
      typeof call.name === 'string' &&
      /^[a-z][a-z0-9_]{0,63}$/.test(call.name)
    );
  }

  private async executeToolCalls(
    state: GatewayRunState,
    calls: PreparedToolCall[],
  ): Promise<{ toolCallId: string; content: string; isError?: boolean }[]> {
    const results: { toolCallId: string; content: string; isError?: boolean }[] = [];
    for (const { call, handler, input } of calls) {
      const content = await handler.execute(input, state.controller.signal);
      if (typeof content !== 'string' || Buffer.byteLength(content) > MAX_TOOL_RESULT_BYTES || containsPii(content)) {
        fail('blocked', 'invalid_tool_call', 'Tool output exceeded safety checks');
      }
      results.push({ toolCallId: call.id, content: await this.verifyToolResult(state.route, content) });
    }
    return results;
  }

  private async verifyToolResult(route: AiRoute, content: string): Promise<string> {
    if (route.zdrBasis !== 'none' || route.provider === 'mock') return content;
    let parsedToolResult: unknown;
    try {
      parsedToolResult = JSON.parse(content);
    } catch {
      return fail('blocked', 'synthetic_provenance_required', 'The tool result was not a registered synthetic fixture');
    }
    const toolProvenance = await this.syntheticVerifier.verify(parsedToolResult);
    if (!toolProvenance) {
      fail('blocked', 'synthetic_provenance_required', 'The tool result was not a registered synthetic fixture');
    }
    return canonicalJson(parsedToolResult);
  }

  private parseOutput(definition: AiUseCaseDefinition<AiUseCaseId>, text: string): unknown {
    let rawOutput: unknown;
    try {
      rawOutput = JSON.parse(providerJsonText(text));
    } catch {
      return fail('failed', 'invalid_output', 'The AI provider returned output that was not valid JSON');
    }
    if (containsPii(rawOutput)) fail('failed', 'invalid_output', 'The AI provider returned a high-risk personal-data pattern');
    const outputResult = definition.outputSchema.safeParse(rawOutput);
    if (!outputResult.success) fail('failed', 'invalid_output', 'The AI provider output did not match the registered response contract');
    return outputResult.data;
  }

  private async finishFailure(
    state: GatewayRunState,
    error: unknown,
    callerSignal?: AbortSignal,
  ): Promise<AiGatewayRunFailure> {
    if (!state.auditCreated) {
      // If audit persistence itself failed, stop before any provider call.
      if (!(error instanceof AiGatewayFault)) throw error;
      await this.createAudit(state);
    }
    if (error instanceof AiGatewayFault && error.fault.providerUsage) {
      state.accumulatedInputTokens += error.fault.providerUsage.inputTokens;
      state.accumulatedOutputTokens += error.fault.providerUsage.outputTokens;
    }
    const fault = this.resolveFault(state, error, callerSignal);
    await this.finishAudit(state, fault.outcome, fault.code);
    return {
      outcome: fault.outcome,
      error: { code: fault.code, message: fault.message, retryable: fault.retryable },
      evidence: this.evidence(state, fault.outcome),
    };
  }

  private resolveFault(state: GatewayRunState, error: unknown, callerSignal?: AbortSignal): GatewayFault {
    if (error instanceof AiGatewayFault) return error.fault;
    if (callerSignal?.aborted) {
      return { outcome: 'aborted', code: 'aborted', message: 'The AI run was aborted', retryable: false };
    }
    if (state.timeoutExpired) {
      return { outcome: 'unavailable', code: 'timeout', message: 'The AI run exceeded its configured timeout', retryable: true };
    }
    return { outcome: 'failed', code: 'internal', message: 'The AI run failed unexpectedly', retryable: false };
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
        const response = await this.invokeProvider(adapter, request, signal, useStream);
        this.validateProviderResponse(response);
        this.assertUsageWithinReservation(response.usage, reservation, request.maxOutputTokens);
        await this.reconcileReservation(requestId, useCaseId, usageDate, reservation, response.usage);
        return response;
      } catch (error) {
        lastError = error;
        await this.consumeUnknownReservation(requestId, useCaseId, usageDate, reservation);
        this.assertRetryable(error, signal, attempt);
        await sleepWithSignal(200 * (attempt + 1), signal);
      }
    }
    throw lastError;
  }

  private async invokeProvider(
    adapter: AiProviderAdapter,
    request: AiProviderRequest,
    signal: AbortSignal,
    useStream: boolean,
  ): Promise<AiProviderResponse> {
    if (!useStream) return adapter.run(request, signal);
    let finalResponse: AiProviderResponse | undefined;
    for await (const event of adapter.stream(request, signal)) {
      if (event.type === 'final') {
        if (finalResponse) throw new Error('Provider stream emitted more than one final response');
        finalResponse = event.response;
      }
    }
    if (!finalResponse) throw new Error('Provider stream ended without a final response');
    return finalResponse;
  }

  private assertUsageWithinReservation(
    usage: AiProviderResponse['usage'],
    reservation: number,
    maxOutputTokens: number,
  ): void {
    if (usage.inputTokens + usage.outputTokens > reservation || usage.outputTokens > maxOutputTokens) {
      failForProviderUsage(usage);
    }
  }

  private assertRetryable(error: unknown, signal: AbortSignal, attempt: number): void {
    if (error instanceof AiGatewayFault) throw error;
    if (signal.aborted) throw error;
    const status = providerStatus(error);
    const retryable = providerRetryable(error) || status === 429 || (status !== undefined && status >= 500);
    if (!retryable) fail('failed', 'provider_rejected', 'The AI provider rejected the request');
    if (attempt === MAX_RETRY_ATTEMPTS - 1) {
      fail('unavailable', 'provider_unavailable', 'The AI provider is temporarily unavailable', true);
    }
  }

  private validateProviderResponse(response: AiProviderResponse): void {
    if (this.hasMalformedProviderPayload(response) || this.hasMalformedProviderUsage(response)) {
      fail('failed', 'provider_rejected', 'The AI provider returned a malformed response');
    }
    if (this.hasInvalidProviderMetadata(response)) {
      fail('failed', 'provider_rejected', 'The AI provider returned invalid response metadata');
    }
  }

  private hasMalformedProviderPayload(response: AiProviderResponse): boolean {
    return !response ||
      typeof response.text !== 'string' ||
      Buffer.byteLength(response.text) > 65_536 ||
      !Array.isArray(response.toolCalls) ||
      response.toolCalls.length > 64 ||
      !['end_turn', 'max_tokens', 'tool_use'].includes(response.stopReason);
  }

  private hasMalformedProviderUsage(response: AiProviderResponse): boolean {
    return !response.usage ||
      !Number.isSafeInteger(response.usage.inputTokens) ||
      !Number.isSafeInteger(response.usage.outputTokens) ||
      response.usage.inputTokens < 0 ||
      response.usage.outputTokens < 0;
  }

  private hasInvalidProviderMetadata(response: AiProviderResponse): boolean {
    return (response.responseModel !== undefined && !/^[A-Za-z0-9._:/-]{1,128}$/.test(response.responseModel)) ||
      (response.endpointTag !== undefined && !/^[A-Za-z0-9._:/-]{1,128}$/.test(response.endpointTag));
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
