import {
  aiRouteProfileIdSchema,
  aiRouteProfileSchema,
  aiUseCaseIdSchema,
  type AiRouteProfile,
  type AiUseCaseId,
} from '@prism/types';
import { ConfigService } from '@nestjs/config';

export const AI_GATEWAY_RUNTIME_CONFIG = Symbol('AI_GATEWAY_RUNTIME_CONFIG');
export const AI_PROVIDER_ADAPTERS = Symbol('AI_PROVIDER_ADAPTERS');
export const AI_SYNTHETIC_PROVENANCE_VERIFIER = Symbol('AI_SYNTHETIC_PROVENANCE_VERIFIER');

export type AiGatewayRuntimeConfig = {
  profile: AiRouteProfile;
  profileId: 'mock' | 'test-anthropic';
  liveUseCases: ReadonlySet<AiUseCaseId>;
  isProduction: boolean;
};

const ALL_DATA_CLASSES = ['synthetic', 'public', 'internal', 'personal', 'sensitive'] as const;

export const AI_ROUTE_PROFILES: Record<'mock' | 'test-anthropic', AiRouteProfile> = {
  mock: {
    id: 'mock',
    routesByTier: {
      fast: { provider: 'mock', model: 'mock-v1', zdrBasis: 'none', allowedDataClasses: [...ALL_DATA_CLASSES] },
      strong: { provider: 'mock', model: 'mock-v1', zdrBasis: 'none', allowedDataClasses: [...ALL_DATA_CLASSES] },
    },
  },
  'test-anthropic': {
    id: 'test-anthropic',
    routesByTier: {
      fast: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        zdrBasis: 'none',
        allowedDataClasses: ['synthetic'],
      },
      strong: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        zdrBasis: 'none',
        allowedDataClasses: ['synthetic'],
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

function resolveProfileId(
  rawProfile: string,
  liveUseCases: ReadonlySet<AiUseCaseId>,
  isProduction: boolean,
): AiGatewayRuntimeConfig['profileId'] {
  const parsedProfile = aiRouteProfileIdSchema.safeParse(rawProfile);
  if (!parsedProfile.success && liveUseCases.size > 0) {
    throw new Error(`Unsupported AI_ROUTE_PROFILE: ${rawProfile}`);
  }
  const profileId = parsedProfile.success ? parsedProfile.data : 'mock';
  if (profileId === 'test-anthropic' && isProduction && liveUseCases.size === 0) {
    return 'mock';
  }
  return profileId;
}

function assertProfileCompatible(
  profileId: AiGatewayRuntimeConfig['profileId'],
  liveUseCases: ReadonlySet<AiUseCaseId>,
  isProduction: boolean,
): void {
  if (profileId === 'test-anthropic') {
    if (isProduction) throw new Error('AI_ROUTE_PROFILE=test-anthropic is disabled in production');
  } else if (liveUseCases.size > 0) {
    throw new Error('AI_LIVE_USE_CASES requires AI_ROUTE_PROFILE=test-anthropic');
  }
}

export function resolveAiGatewayRuntimeConfig(config: Pick<ConfigService, 'get'>): AiGatewayRuntimeConfig {
  const rawProfile = config.get<string>('AI_ROUTE_PROFILE')?.trim() || 'mock';
  const rawLiveUseCases = config.get<string>('AI_LIVE_USE_CASES')?.trim() || '';
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const liveUseCases = parseLiveUseCases(rawLiveUseCases);
  const profileId = resolveProfileId(rawProfile, liveUseCases, isProduction);
  assertProfileCompatible(profileId, liveUseCases, isProduction);
  const profile = aiRouteProfileSchema.parse(AI_ROUTE_PROFILES[profileId]);
  return { profile, profileId, liveUseCases, isProduction };
}
