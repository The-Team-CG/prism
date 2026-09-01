import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, type EventSessionRequest } from '@prism/kernel/event-session';
import type { PrismEventOpsActorRole, PrismVerifiedEventActor } from '@prism/types';

export const DEV_RESET_KEY_HEADER = 'x-prism-dev-reset-key';
export const DEV_RESET_KEY_ENV = 'PRISM_DEV_RESET_KEY';

/**
 * Guards POST /sample/reset.
 *
 * Normally this delegates straight to EventSessionGuard, so the endpoint keeps
 * requiring a verified PmcmAdmin session exactly as it does today.
 *
 * It additionally allows a narrow local-development escape hatch, because the
 * session requirement is self-deadlocking: if a developer's sample account has
 * unusable 2FA state they cannot log in, and the only endpoint that would reset
 * that state demands a session. See scripts/reset-sample-2fa.mjs for the
 * no-HTTP alternative.
 *
 * The escape hatch requires ALL of:
 *   1. NODE_ENV !== 'production'
 *   2. PRISM_DEV_RESET_KEY set to a non-empty value - there is deliberately no
 *      default, so an unconfigured deployment cannot be bypassed at all
 *   3. A matching x-prism-dev-reset-key request header, compared timing-safely
 *
 * Every use is logged at warn level so it is visible in local output and would
 * be conspicuous anywhere else.
 */
@Injectable()
export class SampleResetGuard implements CanActivate {
  private readonly logger = new Logger(SampleResetGuard.name);

  constructor(private readonly eventSessionGuard: EventSessionGuard) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<EventSessionRequest>();

    if (this.isDevResetRequest(request)) {
      this.logger.warn(
        `Sample reset authorised via ${DEV_RESET_KEY_HEADER} development bypass - no session was verified. ` +
          'This path is unavailable when NODE_ENV=production or when ' +
          `${DEV_RESET_KEY_ENV} is unset.`,
      );
      request.prismActor = this.devResetActor();
      return true;
    }

    return this.eventSessionGuard.canActivate(context);
  }

  private isDevResetRequest(request: EventSessionRequest) {
    if (process.env.NODE_ENV === 'production') return false;

    const expected = process.env[DEV_RESET_KEY_ENV]?.trim();
    if (!expected) return false;

    const provided = request.headers[DEV_RESET_KEY_HEADER];
    if (typeof provided !== 'string' || !provided) return false;

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(provided, 'utf8');
    // timingSafeEqual throws on length mismatch, so compare lengths first. The
    // length of a rejected guess leaks, which is immaterial for a local-only key.
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  private devResetActor(): PrismVerifiedEventActor {
    const role = OpsUserRole.System as PrismEventOpsActorRole;
    return {
      id: 'system_dev_reset',
      actorId: 'system_dev_reset',
      role,
      actorRole: role,
      email: 'dev-reset@pmcm.test',
      actorEmail: 'dev-reset@pmcm.test',
      name: 'Local Dev Reset',
      actorName: 'Local Dev Reset',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
  }
}
