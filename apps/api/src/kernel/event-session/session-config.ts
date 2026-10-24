import type { ConfigService } from '@nestjs/config';

/**
 * Session configuration. Every value is required; there is no built-in secret and no alternate
 * variable name. validateRuntimeEnv (kernel/shared) rejects a missing or invalid value at startup,
 * and these readers throw the same named error if one is ever read unset.
 */
export const PRISM_SESSION_SECRET_ENV = 'PRISM_SESSION_SECRET';
export const MIN_SESSION_SECRET_LENGTH = 32;
export const PRISM_SESSION_TTL_ENV = 'PRISM_SESSION_TTL_SECONDS';
/** Optional per-role override, e.g. PRISM_SESSION_TTL_SECONDS_PMCM_ADMIN. Unset means the general value applies. */
export const PRISM_SESSION_TTL_ROLE_ENV_PREFIX = 'PRISM_SESSION_TTL_SECONDS_';

export function readSessionSecret(config: Pick<ConfigService, 'get'>): string {
  const secret = config.get<string>(PRISM_SESSION_SECRET_ENV);
  if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(`${PRISM_SESSION_SECRET_ENV} must be configured with at least ${MIN_SESSION_SECRET_LENGTH} characters`);
  }
  return secret;
}

export function isSessionTtlText(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

export function parseSessionTtlSeconds(value: string | undefined, name: string): number {
  if (value === undefined || !isSessionTtlText(value)) {
    throw new Error(`${name} must be set to a positive whole number of seconds`);
  }
  return Number(value.trim());
}
