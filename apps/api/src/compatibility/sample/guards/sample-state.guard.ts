import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, type EventSessionRequest } from '@prism/kernel/event-session';
import type { PrismEventOpsActorRole, PrismVerifiedEventActor } from '@prism/types';

export const ANONYMOUS_SAMPLE_STATE_ENV = 'PRISM_ALLOW_ANONYMOUS_SAMPLE_STATE';

/**
 * Guards GET /sample/state.
 *
 * This route used to be deliberately unauthenticated, on the reasoning that it
 * is disabled in production. That reasoning only protects production. Staging
 * is shared, internet-reachable and not NODE_ENV=production, so the aggregate
 * was readable by anyone. It returns the full user directory and every supplier
 * quote request including its accessToken, and that token is the entire
 * authorization for GET/POST/PATCH /quote-requests/:token - so an anonymous
 * read yielded working credentials for submitting and revising supplier quotes.
 *
 * The posture is now default-deny: a verified event session is required here.
 * The controller separately applies the PmcmAdmin/System role policy after the
 * session has been verified. PMCM already sees these tokens through the
 * authenticated commercial surfaces that issue them, so nothing legitimate is
 * lost.
 *
 * The local-development escape hatch requires ALL of:
 *   1. NODE_ENV !== 'production'
 *   2. PRISM_ALLOW_ANONYMOUS_SAMPLE_STATE=1 - deliberately no default, so an
 *      unconfigured deployment cannot be opened by accident
 * Every anonymous read is logged at warn level so it is conspicuous anywhere
 * other than a developer's own machine.
 */
@Injectable()
export class SampleStateGuard implements CanActivate {
  private readonly logger = new Logger(SampleStateGuard.name);

  constructor(private readonly eventSessionGuard: EventSessionGuard) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<EventSessionRequest>();

    if (this.isAnonymousReadAllowed()) {
      this.logger.warn(
        `Sample state read served anonymously via ${ANONYMOUS_SAMPLE_STATE_ENV} - no session was verified. ` +
          'This path is unavailable when NODE_ENV=production or when ' +
          `${ANONYMOUS_SAMPLE_STATE_ENV} is unset.`,
      );
      request.prismActor = this.anonymousReadActor();
      return true;
    }

    return this.eventSessionGuard.canActivate(context);
  }

  private isAnonymousReadAllowed() {
    if (process.env.NODE_ENV === 'production') return false;
    return process.env[ANONYMOUS_SAMPLE_STATE_ENV]?.trim() === '1';
  }

  private anonymousReadActor(): PrismVerifiedEventActor {
    const role = OpsUserRole.System as PrismEventOpsActorRole;
    return {
      id: 'system_local_sample_state',
      actorId: 'system_local_sample_state',
      role,
      actorRole: role,
      email: 'local-sample-state@pmcm.test',
      actorEmail: 'local-sample-state@pmcm.test',
      name: 'Local Sample State Read',
      actorName: 'Local Sample State Read',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
  }
}
