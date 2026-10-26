export const TRUST_PROXY_ENV = 'PRISM_TRUST_PROXY';

export type TrustProxySetting = boolean | 'loopback' | number;

const ACCEPTED = 'false, true, loopback, or a hop count (a non-negative integer)';

/**
 * Express trust-proxy setting. Required: every deployment states whether the API sits behind a
 * reverse proxy, because a wrong guess either shares one rate-limit bucket or trusts spoofed client IPs.
 */
export function parseTrustProxySetting(raw: string | undefined): TrustProxySetting {
  const value = raw?.trim() ?? '';
  if (value === 'false') return false;
  if (value === 'true') return true;
  if (value === 'loopback') return 'loopback';
  if (/^(0|[1-9]\d*)$/.test(value)) return Number(value);
  const received = value === '' ? 'unset' : `"${value}"`;
  throw new Error(`${TRUST_PROXY_ENV} is required and must be ${ACCEPTED}; received ${received}.`);
}
