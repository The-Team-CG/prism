import { applyDecorators, Module, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

/**
 * Per-client-address limits for unauthenticated mutation routes.
 *
 * Route-scoped on purpose rather than a global guard: signed-in portal reads
 * reach the API from the portals' shared server egress, so a per-address
 * global default would throttle every user together. Guest access and event
 * games keep their own purpose-built limiters. Buckets are in-memory per API
 * instance, so each test app starts with fresh counters.
 */
// Named `default` so throttled responses carry the standard Retry-After header.
const PUBLIC_THROTTLER = 'default';
const MINUTE_MS = 60_000;

export const PUBLIC_RATE_LIMITS = {
  /** Login, 2FA setup/verify and password-reset consumption. */
  authentication: { limit: 20, ttl: MINUTE_MS },
  /** Requests that send email or queue admin review: password-reset request, account approval. */
  accountRequest: { limit: 5, ttl: MINUTE_MS },
  /** Public inquiry and supplier application forms. */
  publicSubmission: { limit: 10, ttl: MINUTE_MS },
  /** Supplier quote-request token links (read, submit, revise). */
  quoteRequestToken: { limit: 60, ttl: MINUTE_MS },
} as const;

export type PublicRateLimitPolicy = keyof typeof PUBLIC_RATE_LIMITS;

@Module({
  imports: [ThrottlerModule.forRoot([{ name: PUBLIC_THROTTLER, ...PUBLIC_RATE_LIMITS.publicSubmission }])],
  exports: [ThrottlerModule],
})
export class PublicRateLimitModule {}

/** Limits a public route per client address; over the limit the API answers 429 with Retry-After. */
export function PublicRateLimit(policy: PublicRateLimitPolicy) {
  return applyDecorators(UseGuards(ThrottlerGuard), Throttle({ [PUBLIC_THROTTLER]: PUBLIC_RATE_LIMITS[policy] }));
}
