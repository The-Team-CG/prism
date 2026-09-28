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
  /** True when local provider settings enable only the synthetic route defaults. */
  localSyntheticProviderMode?: boolean;
};

const ALL_DATA_CLASSES = ['synthetic', 'public', 'internal', 'personal', 'sensitive'] as const;
type ExternalAiProvider = Exclude<AiProviderId, 'mock'>;
const LOCAL_SYNTHETIC_PROFILE_BY_PROVIDER: Readonly<Record<ExternalAiProvider, string>> = {
  anthropic: 'test-anthropic',
  openrouter: 'test-openrouter-glm53-zdr',
};
const LOCAL_SYNTHETIC_USE_CASES: readonly AiUseCaseId[] = [
  'pare.budget',
  'pare.risk',
  'pare.message-drafts',
  'comms.draft',
];

export const AI_ROUTE_PROFILES: Readonly<Record<string, AiRouteProfile>> = {
  mock: {
    id: 'mock',
    routesByTier: {
      fast: {
        provider: 'mock', model: 'mock-v1', endpointPolicyId: 'deterministic-mock', adapterRevision: 'mock-v1',
        zdrBasis: 'none', allowedDataClasses: [...ALL_DATA_CLASSES],
      },
      strong: {
        provider: 'mock', model: 'mock-v1', endpointPolicyId: 'deterministic-mock', adapterRevision: 'mock-v1',
        zdrBasis: 'none', allowedDataClasses: [...ALL_DATA_CLASSES],
      },
    },
  },
  'test-anthropic': {
    id: 'test-anthropic',
    routesByTier: {
      fast: {
        provider: 'anthropic', model: 'claude-sonnet-4-6', endpointPolicyId: 'anthropic-direct',
        adapterRevision: 'anthropic-conformance-v1', zdrBasis: 'none', allowedDataClasses: ['synthetic'],
      },
      strong: {
        provider: 'anthropic', model: 'claude-sonnet-4-6', endpointPolicyId: 'anthropic-direct',
        adapterRevision: 'anthropic-conformance-v1', zdrBasis: 'none', allowedDataClasses: ['synthetic'],
      },
    },
  },
  'test-openrouter-glm53-zdr': {
    id: 'test-openrouter-glm53-zdr',
    routesByTier: {
      fast: {
        provider: 'openrouter', model: 'z-ai/glm-5.3-flash',
        endpointPolicyId: 'fireworks', adapterRevision: 'openrouter-glm-5.3-flash-zdr-v1',
        zdrBasis: 'provider-enforced', allowedDataClasses: ['synthetic'],
      },
      strong: {
        provider: 'openrouter', model: 'z-ai/glm-5.3-flash',
        endpointPolicyId: 'fireworks', adapterRevision: 'openrouter-glm-5.3-flash-zdr-v1',
        zdrBasis: 'provider-enforced', allowedDataClasses: ['synthetic'],
      },
    },
  },
};

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

function providerFromLocalKeys(config: Pick<ConfigService, 'get'>): ExternalAiProvider | undefined {
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
  if (providers.size !== 1 || providers.has('mock')) {
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
): void {
  if (isProduction && profileRoutes(profile).some((route) =>
    route.provider !== 'mock' && route.allowedDataClasses.length === 1 && route.allowedDataClasses[0] === 'synthetic')) {
    throw new Error('A synthetic-only external AI route cannot be selected in production');
  }

  for (const useCaseId of liveUseCases) {
    const definition = AI_USE_CASE_REGISTRY[useCaseId];
    const route = resolveAiRoute(profile, useCaseId, definition.modelTier);
    if (route.provider === 'mock') {
      throw new Error('AI_LIVE_USE_CASES includes ' + useCaseId + ', but its selected route uses the mock provider');
    }
  }
}

type AiRuntimeEnvironment = {
  configuredProfileId: string;
  explicitProfileId?: string;
  isDevelopment: boolean;
  isProduction: boolean;
};

function readRuntimeEnvironment(config: Pick<ConfigService, 'get'>): AiRuntimeEnvironment {
  const configuredProfileId = config.get<string>('AI_ROUTE_PROFILE')?.trim() || '';
  const explicitProfileId = configuredProfileId && configuredProfileId !== 'mock'
    ? configuredProfileId
    : undefined;
  const environment = config.get<string>('NODE_ENV')?.trim() || '';
  return {
    configuredProfileId,
    explicitProfileId,
    isDevelopment: environment === 'development',
    isProduction: environment === 'production',
  };
}

function resolveRequestedProvider(
  config: Pick<ConfigService, 'get'>,
  environment: AiRuntimeEnvironment,
): AiProviderId | undefined {
  const configuredProvider = readConfiguredProvider(config);
  if (configuredProvider) return configuredProvider;
  if (environment.isDevelopment && !environment.explicitProfileId) return providerFromLocalKeys(config);
  return undefined;
}

function selectProfileId(
  environment: AiRuntimeEnvironment,
  requestedProvider: AiProviderId | undefined,
): string {
  if (environment.explicitProfileId) return environment.explicitProfileId;
  if (requestedProvider && requestedProvider !== 'mock') {
    return LOCAL_SYNTHETIC_PROFILE_BY_PROVIDER[requestedProvider];
  }
  return environment.configuredProfileId || 'mock';
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
  const selectedProvider = profileProvider(parsedProfile);
  if (requestedProvider && selectedProvider !== requestedProvider) {
    throw new Error('AI_PROVIDER=' + requestedProvider + ' conflicts with AI_ROUTE_PROFILE=' + selectedProfileId);
  }
  return parsedProfile;
}

function resolveLiveUseCases(
  config: Pick<ConfigService, 'get'>,
  localSyntheticProviderMode: boolean,
): Set<AiUseCaseId> {
  const rawLiveUseCases = config.get<string>('AI_LIVE_USE_CASES')?.trim() || '';
  if (rawLiveUseCases) return parseLiveUseCases(rawLiveUseCases);
  if (localSyntheticProviderMode) return new Set<AiUseCaseId>(LOCAL_SYNTHETIC_USE_CASES);
  return new Set<AiUseCaseId>();
}

export function resolveAiGatewayRuntimeConfig(
  config: Pick<ConfigService, 'get'>,
  profiles: Readonly<Record<string, AiRouteProfile>> = AI_ROUTE_PROFILES,
): AiGatewayRuntimeConfig {
  const environment = readRuntimeEnvironment(config);
  const requestedProvider = resolveRequestedProvider(config, environment);
  const selectedProfileId = selectProfileId(environment, requestedProvider);
  const parsedProfile = loadSelectedProfile(profiles, selectedProfileId, requestedProvider);
  const selectedProfileProvider = profileProvider(parsedProfile);
  const usesRuntimeProviderSelection = !environment.explicitProfileId &&
    selectedProfileProvider !== undefined && selectedProfileProvider !== 'mock';
  const runtimeProfile = usesRuntimeProviderSelection
    ? { ...parsedProfile, id: 'local-' + selectedProfileProvider + '-synthetic' }
    : parsedProfile;
  const profile = applyConfiguredModels(runtimeProfile, {
    all: readConfiguredModel(config, 'AI_MODEL'),
    fast: readConfiguredModel(config, 'AI_MODEL_FAST'),
    strong: readConfiguredModel(config, 'AI_MODEL_STRONG'),
  });

  const localSyntheticProviderMode = environment.isDevelopment && usesRuntimeProviderSelection;
  const liveUseCases = resolveLiveUseCases(config, localSyntheticProviderMode);
  assertProfileCompatible(profile, liveUseCases, environment.isProduction);
  return {
    profile,
    profileId: profile.id,
    liveUseCases,
    isProduction: environment.isProduction,
    ...(localSyntheticProviderMode ? { localSyntheticProviderMode: true } : {}),
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
