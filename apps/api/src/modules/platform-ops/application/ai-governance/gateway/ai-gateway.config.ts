import {
  aiProviderIdSchema,
  aiRouteProfileSchema,
  aiUseCaseIdSchema,
  type AiModelTier,
  type AiProviderId,
  type AiRoute,
  type AiRouteProfile,
  type AiRouteProfileId,
  type AiUseCaseId,
} from '@prism/types';
import { digestJson } from '../json-digest';
import { ConfigService } from '@nestjs/config';
import { AI_USE_CASE_REGISTRY } from './ai-use-cases';

export const AI_GATEWAY_RUNTIME_CONFIG = Symbol('AI_GATEWAY_RUNTIME_CONFIG');
export const AI_PROVIDER_ADAPTERS = Symbol('AI_PROVIDER_ADAPTERS');
export const AI_SYNTHETIC_PROVENANCE_VERIFIER = Symbol('AI_SYNTHETIC_PROVENANCE_VERIFIER');

export type AiGatewayRuntimeConfig = {
  profile: AiRouteProfile;
  profileId: AiRouteProfileId;
  liveUseCases: ReadonlySet<AiUseCaseId>;
  isProduction: boolean;
  /** Operator override that lets a production-mode deployment (for example UAT) use a non-ZDR route. */
  allowTestDataInProduction?: boolean;
  /** False when no provider is configured: every use case is blocked until one is. */
  configured: boolean;
};

const ZDR_DATA_CLASSES = ['synthetic', 'public', 'internal', 'personal'] as const;
type ExternalAiProvider = AiProviderId;

const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-5-5';
const OPENROUTER_DEFAULT_MODEL = 'z-ai/glm-5.3-flash';

function anthropicRoute(zdrConfirmed: boolean): AiRoute {
  return {
    provider: 'anthropic',
    model: ANTHROPIC_DEFAULT_MODEL,
    endpointPolicyId: 'anthropic-direct',
    adapterRevision: zdrConfirmed ? 'anthropic-messages-zdr-v1' : 'anthropic-messages-test-data-v1',
    zdrBasis: zdrConfirmed ? 'provider-enforced' : 'test-data-only',
    allowedDataClasses: [...ZDR_DATA_CLASSES],
  };
}

const OPENROUTER_ROUTE: AiRoute = {
  provider: 'openrouter',
  model: OPENROUTER_DEFAULT_MODEL,
  endpointPolicyId: 'fireworks',
  adapterRevision: 'openrouter-chat-completions-zdr-v1',
  zdrBasis: 'provider-enforced',
  allowedDataClasses: [...ZDR_DATA_CLASSES],
};

/** Fixtures-only lockdown. Never selected automatically; choose it with AI_ROUTE_PROFILE to refuse real data. */
const ANTHROPIC_FIXTURES_ONLY_ROUTE: AiRoute = {
  ...anthropicRoute(false),
  adapterRevision: 'anthropic-messages-v1',
  zdrBasis: 'none',
  allowedDataClasses: ['synthetic'],
};

function profileOf(id: string, route: AiRoute): AiRouteProfile {
  return { id, routesByTier: { fast: route, strong: route } };
}

/**
 * Selectable route profiles. Anthropic direct is ZDR only when the operator confirms a
 * zero-data-retention agreement with AI_ZDR_CONFIRMED; otherwise it is a test-data route that
 * production refuses. OpenRouter requests ZDR on every call and fails closed when the endpoint
 * cannot honor it. anthropic-synthetic is an explicit fixtures-only lockdown.
 */
export const AI_ROUTE_PROFILES: Readonly<Record<string, AiRouteProfile>> = {
  'anthropic-zdr': profileOf('anthropic-zdr', anthropicRoute(true)),
  'anthropic-test-data': profileOf('anthropic-test-data', anthropicRoute(false)),
  'anthropic-synthetic': profileOf('anthropic-synthetic', ANTHROPIC_FIXTURES_ONLY_ROUTE),
  'openrouter-zdr': profileOf('openrouter-zdr', OPENROUTER_ROUTE),
};

/** Placeholder when no provider is configured. It has no live use cases, so every call is blocked. */
const UNCONFIGURED_PROFILE: AiRouteProfile = profileOf('unconfigured', anthropicRoute(false));

function parseLiveUseCases(rawLiveUseCases: string): Set<AiUseCaseId> {
  const liveUseCases = new Set<AiUseCaseId>();
  for (const item of rawLiveUseCases.split(',').map((value) => value.trim()).filter(Boolean)) {
    const parsed = aiUseCaseIdSchema.safeParse(item);
    if (!parsed.success) throw new Error('Unsupported AI live use case: ' + item);
    liveUseCases.add(parsed.data);
  }
  return liveUseCases;
}

function readConfiguredProvider(config: Pick<ConfigService, 'get'>): AiProviderId | undefined {
  const rawProvider = config.get<string>('AI_PROVIDER')?.trim();
  if (!rawProvider) return undefined;
  const parsed = aiProviderIdSchema.safeParse(rawProvider.toLowerCase());
  if (!parsed.success) throw new Error('Unsupported AI_PROVIDER: ' + rawProvider);
  return parsed.data;
}

function readConfiguredModel(config: Pick<ConfigService, 'get'>, key: string): string | undefined {
  return config.get<string>(key)?.trim() || undefined;
}

function providerFromKeys(config: Pick<ConfigService, 'get'>): ExternalAiProvider | undefined {
  const configuredProviders: ExternalAiProvider[] = [];
  if (config.get<string>('ANTHROPIC_API_KEY')?.trim()) configuredProviders.push('anthropic');
  if (config.get<string>('OPENROUTER_API_KEY')?.trim()) configuredProviders.push('openrouter');
  if (configuredProviders.length > 1) {
    throw new Error('Multiple supported AI provider keys are configured; set AI_PROVIDER explicitly');
  }
  return configuredProviders[0];
}

function profileProvider(profile: AiRouteProfile): AiProviderId | undefined {
  const providers = new Set(profileRoutes(profile).map((route) => route.provider));
  return providers.size === 1 ? [...providers][0] : undefined;
}

function profileRoutes(profile: AiRouteProfile): AiRoute[] {
  return [
    ...Object.values(profile.routesByTier),
    ...Object.values(profile.routesByUseCase ?? {}),
  ];
}

type AiModelOverrides = {
  all?: string;
  fast?: string;
  strong?: string;
};

function applyConfiguredModels(profile: AiRouteProfile, overrides: AiModelOverrides): AiRouteProfile {
  if (!overrides.all && !overrides.fast && !overrides.strong) return profile;

  const providers = new Set(profileRoutes(profile).map((route) => route.provider));
  if (providers.size !== 1) {
    throw new Error('AI_MODEL settings require one selected external AI provider profile');
  }
  const provider = [...providers][0];
  const adapterRevision = provider === 'openrouter'
    ? 'openrouter-chat-completions-v1'
    : 'anthropic-messages-v1';
  const modelForTier = (tier: AiModelTier) => overrides[tier] ?? overrides.all;
  const withConfiguredModel = (route: AiRoute, tier: AiModelTier): AiRoute => {
    const model = modelForTier(tier);
    return model ? { ...route, model, adapterRevision } : route;
  };

  const routesByUseCase: Partial<Record<AiUseCaseId, AiRoute>> = {};
  for (const rawUseCaseId of Object.keys(profile.routesByUseCase ?? {})) {
    const parsedUseCaseId = aiUseCaseIdSchema.parse(rawUseCaseId);
    const route = profile.routesByUseCase?.[parsedUseCaseId];
    if (!route) continue;
    routesByUseCase[parsedUseCaseId] = withConfiguredModel(
      route,
      AI_USE_CASE_REGISTRY[parsedUseCaseId].modelTier,
    );
  }

  return aiRouteProfileSchema.parse({
    ...profile,
    routesByTier: {
      fast: withConfiguredModel(profile.routesByTier.fast, 'fast'),
      strong: withConfiguredModel(profile.routesByTier.strong, 'strong'),
    },
    ...(profile.routesByUseCase ? { routesByUseCase } : {}),
  });
}

function assertProfileCompatible(
  profile: AiRouteProfile,
  liveUseCases: ReadonlySet<AiUseCaseId>,
  isProduction: boolean,
  allowTestDataInProduction: boolean,
): void {
  if (isProduction && !allowTestDataInProduction && liveUseCases.size > 0 &&
    profileRoutes(profile).some((route) => route.zdrBasis !== 'provider-enforced')) {
    throw new Error(
      'Production AI routes must be ZDR: set AI_ZDR_CONFIRMED=true, select OpenRouter, or set AI_ALLOW_TEST_DATA_IN_PRODUCTION=true for a UAT deployment that holds only test data',
    );
  }

  for (const useCaseId of liveUseCases) {
    resolveAiRoute(profile, useCaseId, AI_USE_CASE_REGISTRY[useCaseId].modelTier);
  }
}

type AiRuntimeEnvironment = {
  explicitProfileId?: string;
  isProduction: boolean;
  zdrConfirmed: boolean;
  allowTestDataInProduction: boolean;
};

function isTruthyFlag(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function readRuntimeEnvironment(config: Pick<ConfigService, 'get'>): AiRuntimeEnvironment {
  const explicitProfileId = config.get<string>('AI_ROUTE_PROFILE')?.trim() || undefined;
  return {
    explicitProfileId,
    isProduction: config.get<string>('NODE_ENV')?.trim() === 'production',
    zdrConfirmed: isTruthyFlag(config.get<string>('AI_ZDR_CONFIRMED')),
    allowTestDataInProduction: isTruthyFlag(config.get<string>('AI_ALLOW_TEST_DATA_IN_PRODUCTION')),
  };
}

function resolveRequestedProvider(
  config: Pick<ConfigService, 'get'>,
  environment: AiRuntimeEnvironment,
): AiProviderId | undefined {
  return readConfiguredProvider(config) ?? (environment.explicitProfileId ? undefined : providerFromKeys(config));
}

function selectProfileId(
  environment: AiRuntimeEnvironment,
  requestedProvider: AiProviderId | undefined,
): string | undefined {
  if (environment.explicitProfileId) return environment.explicitProfileId;
  if (requestedProvider === 'openrouter') return 'openrouter-zdr';
  if (requestedProvider === 'anthropic') return environment.zdrConfirmed ? 'anthropic-zdr' : 'anthropic-test-data';
  return undefined;
}

function loadSelectedProfile(
  profiles: Readonly<Record<string, AiRouteProfile>>,
  selectedProfileId: string,
  requestedProvider: AiProviderId | undefined,
): AiRouteProfile {
  const configuredProfile = profiles[selectedProfileId];
  if (!configuredProfile) throw new Error('Unsupported AI_ROUTE_PROFILE: ' + selectedProfileId);
  const parsedProfile = aiRouteProfileSchema.parse(configuredProfile);
  if (parsedProfile.id !== selectedProfileId) {
    throw new Error('AI route profile registry key does not match profile ID: ' + selectedProfileId);
  }
  if (requestedProvider && profileProvider(parsedProfile) !== requestedProvider) {
    throw new Error('AI_PROVIDER=' + requestedProvider + ' conflicts with AI_ROUTE_PROFILE=' + selectedProfileId);
  }
  return parsedProfile;
}

/** With a provider configured every use case is live. AI_LIVE_USE_CASES narrows that list. */
function resolveLiveUseCases(config: Pick<ConfigService, 'get'>): Set<AiUseCaseId> {
  const rawLiveUseCases = config.get<string>('AI_LIVE_USE_CASES')?.trim() || '';
  if (rawLiveUseCases) return parseLiveUseCases(rawLiveUseCases);
  return new Set<AiUseCaseId>(aiUseCaseIdSchema.options);
}

export function resolveAiGatewayRuntimeConfig(
  config: Pick<ConfigService, 'get'>,
  profiles: Readonly<Record<string, AiRouteProfile>> = AI_ROUTE_PROFILES,
): AiGatewayRuntimeConfig {
  const environment = readRuntimeEnvironment(config);
  const requestedProvider = resolveRequestedProvider(config, environment);
  const selectedProfileId = selectProfileId(environment, requestedProvider);
  if (!selectedProfileId) {
    return {
      profile: UNCONFIGURED_PROFILE,
      profileId: UNCONFIGURED_PROFILE.id,
      liveUseCases: new Set<AiUseCaseId>(),
      isProduction: environment.isProduction,
      configured: false,
    };
  }
  const profile = applyConfiguredModels(loadSelectedProfile(profiles, selectedProfileId, requestedProvider), {
    all: readConfiguredModel(config, 'AI_MODEL'),
    fast: readConfiguredModel(config, 'AI_MODEL_FAST'),
    strong: readConfiguredModel(config, 'AI_MODEL_STRONG'),
  });
  const liveUseCases = resolveLiveUseCases(config);
  assertProfileCompatible(profile, liveUseCases, environment.isProduction, environment.allowTestDataInProduction);
  return {
    profile,
    profileId: profile.id,
    liveUseCases,
    isProduction: environment.isProduction,
    allowTestDataInProduction: environment.allowTestDataInProduction,
    configured: true,
  };
}

export function resolveAiRoute(
  profile: AiRouteProfile,
  useCaseId: AiUseCaseId,
  modelTier: AiModelTier,
): AiRoute {
  return profile.routesByUseCase?.[useCaseId] ?? profile.routesByTier[modelTier];
}

/** A stable digest of the exact selected provider/model route for one use case. */
export function computeAiRouteRevision(
  profile: AiRouteProfile,
  useCaseId: AiUseCaseId,
  modelTier: AiModelTier,
): string {
  const route = resolveAiRoute(profile, useCaseId, modelTier);
  return digestJson({ format: 'prism-ai-route-v1', profileId: profile.id, useCaseId, modelTier, route });
}
