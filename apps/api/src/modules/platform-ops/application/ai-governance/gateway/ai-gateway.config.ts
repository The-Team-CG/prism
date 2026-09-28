import {
  aiRouteProfileSchema,
  aiUseCaseIdSchema,
  type AiModelTier,
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
};

const ALL_DATA_CLASSES = ['synthetic', 'public', 'internal', 'personal', 'sensitive'] as const;

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
};

function parseLiveUseCases(rawLiveUseCases: string): Set<AiUseCaseId> {
  const liveUseCases = new Set<AiUseCaseId>();
  for (const item of rawLiveUseCases.split(',').map((value) => value.trim()).filter(Boolean)) {
    const parsed = aiUseCaseIdSchema.safeParse(item);
    if (!parsed.success) throw new Error(`Unsupported AI live use case: ${item}`);
    liveUseCases.add(parsed.data);
  }
  return liveUseCases;
}

export function resolveAiRoute(
  profile: AiRouteProfile,
  useCaseId: AiUseCaseId,
  modelTier: AiModelTier,
): AiRoute {
  return profile.routesByUseCase?.[useCaseId] ?? profile.routesByTier[modelTier];
}

/** A stable digest of the exact code-reviewed route selected for one use case. */
export function computeAiRouteRevision(
  profile: AiRouteProfile,
  useCaseId: AiUseCaseId,
  modelTier: AiModelTier,
): string {
  const route = resolveAiRoute(profile, useCaseId, modelTier);
  return digestJson({ format: 'prism-ai-route-v1', profileId: profile.id, useCaseId, modelTier, route });
}

function profileRoutes(profile: AiRouteProfile): AiRoute[] {
  return [
    ...Object.values(profile.routesByTier),
    ...Object.values(profile.routesByUseCase ?? {}),
  ];
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
      throw new Error(`AI_LIVE_USE_CASES includes ${useCaseId}, but its selected route uses the mock provider`);
    }
  }
}

export function resolveAiGatewayRuntimeConfig(
  config: Pick<ConfigService, 'get'>,
  profiles: Readonly<Record<string, AiRouteProfile>> = AI_ROUTE_PROFILES,
): AiGatewayRuntimeConfig {
  const selectedProfile = config.get<string>('AI_ROUTE_PROFILE')?.trim() || 'mock';
  const rawLiveUseCases = config.get<string>('AI_LIVE_USE_CASES')?.trim() || '';
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const liveUseCases = parseLiveUseCases(rawLiveUseCases);
  const configuredProfile = profiles[selectedProfile];
  if (!configuredProfile) throw new Error(`Unsupported AI_ROUTE_PROFILE: ${selectedProfile}`);
  const profile = aiRouteProfileSchema.parse(configuredProfile);
  if (profile.id !== selectedProfile) {
    throw new Error(`AI route profile registry key does not match profile ID: ${selectedProfile}`);
  }
  assertProfileCompatible(profile, liveUseCases, isProduction);
  return { profile, profileId: profile.id, liveUseCases, isProduction };
}
