import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { GuestAccessLimiter } from '../../application/guest/guest-access-limiter';

type GuestRequest = { ip?: string; method: string; params?: Record<string, string | undefined> };
type GuestResponse = { setHeader?: (name: string, value: string) => void };

// Generous on purpose: a venue entrance shares one address, so a busy check-in window must stay well under these.
const LOOKUP_POLICY = { name: 'lookup', max: 240, windowMs: 60_000 } as const;
const WRITE_POLICY = { name: 'write', max: 120, windowMs: 60_000 } as const;

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

/**
 * Bounds abuse of the unauthenticated guest endpoints (access-code lookup, check-in, feedback, consent withdrawal).
 * Lookups are limited per client address; writes per client address and access code. Over the limit the request is
 * refused with 429 and a Retry-After header, and the denial is logged with a hashed address only.
 */
@Injectable()
export class GuestAccessRateLimitGuard implements CanActivate {
  private readonly limiter = new GuestAccessLimiter();
  private readonly logger = new Logger(GuestAccessRateLimitGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<GuestRequest>();
    const policy = request.method === 'GET' ? LOOKUP_POLICY : WRITE_POLICY;
    const address = request.ip || 'unknown';
    const key = [policy.name, address, policy.name === 'write' ? request.params?.accessCode ?? '' : ''].join('|');

    const decision = this.limiter.consume(key, policy.max, policy.windowMs);
    if (decision.allowed) return true;

    http.getResponse<GuestResponse>().setHeader?.('Retry-After', String(decision.retryAfterSeconds));
    this.logger.warn(`Guest ${policy.name} limit reached for client ${shortHash(address)}`);
    throw new HttpException(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Too many guest requests. Try again shortly.' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
