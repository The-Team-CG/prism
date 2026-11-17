import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { PRISM_PRIVACY_NOTICE_REQUIRED_CODE, privacyNoticeRequired, type PrismVerifiedEventActor } from '@prism/types';
import { PrismaService } from '../../database';
import { AuthSessionService } from '../services/auth-session.service';
import { ALLOW_PENDING_PRIVACY_NOTICE_METADATA } from '../decorators/allow-pending-privacy-notice.decorator';

export type EventSessionRequest = Request & {
  prismActor?: PrismVerifiedEventActor;
};

const SESSION_USER_SELECT = {
  sessionVersion: true,
  approvalStatus: true,
  lockedUntil: true,
  permanentLockout: true,
  role: true,
  email: true,
  privacyNoticeVersion: true,
} as const satisfies Prisma.OpsUserSelect;

type SessionUser = Prisma.OpsUserGetPayload<{ select: typeof SESSION_USER_SELECT }>;

const BROWSER_SESSION_SELECT = { userId: true, revokedAt: true, lastSeenAt: true } as const satisfies Prisma.OpsUserSessionSelect;
type BrowserSession = Prisma.OpsUserSessionGetPayload<{ select: typeof BROWSER_SESSION_SELECT }>;

/** How stale "last active" may get before a request refreshes it, so most requests do not write. */
const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000;

/** A token naming a browser session must name a live one: that is how one device is signed out on its own. */
function assertBrowserSessionLive(session: BrowserSession | null, actor: PrismVerifiedEventActor) {
  if (!actor.sessionId) return;
  if (!session || session.userId !== actor.id || session.revokedAt) {
    throw new UnauthorizedException('This device has been signed out');
  }
}

function isLockedOut(user: SessionUser) {
  return user.permanentLockout || Boolean(user.lockedUntil && user.lockedUntil > new Date());
}

function identityMatches(user: SessionUser, actor: PrismVerifiedEventActor) {
  return user.role === actor.actorRole && user.email.trim().toLowerCase() === actor.actorEmail.trim().toLowerCase();
}

function assertSessionCurrent(user: SessionUser | null, actor: PrismVerifiedEventActor): asserts user is SessionUser {
  if (
    !user ||
    user.sessionVersion !== (actor.sessionVersion ?? 0) ||
    user.approvalStatus !== 'approved' ||
    isLockedOut(user) ||
    !identityMatches(user, actor)
  ) {
    throw new UnauthorizedException('Session has been revoked or account access is no longer eligible');
  }
}

@Injectable()
export class EventSessionGuard implements CanActivate {
  constructor(
    private readonly authSessionService: AuthSessionService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<EventSessionRequest>();
    const actor = this.authSessionService.verifyAccessToken(this.extractToken(request));
    const [user, session] = await Promise.all([
      this.prisma.opsUser.findUnique({ where: { id: actor.id }, select: SESSION_USER_SELECT }),
      actor.sessionId
        ? this.prisma.opsUserSession.findUnique({ where: { id: actor.sessionId }, select: BROWSER_SESSION_SELECT })
        : Promise.resolve(null),
    ]);
    assertSessionCurrent(user, actor);
    assertBrowserSessionLive(session, actor);
    if (session) this.refreshLastSeen(actor.sessionId!, session.lastSeenAt);
    if (privacyNoticeRequired(user.privacyNoticeVersion) && !this.allowsPendingPrivacyNotice(context)) {
      throw new ForbiddenException({
        code: PRISM_PRIVACY_NOTICE_REQUIRED_CODE,
        message: 'Review the privacy notice to continue.',
      });
    }
    request.prismActor = actor;
    return true;
  }

  /** Best effort: a failed refresh only makes "last active" older, so it never fails the request. */
  private refreshLastSeen(sessionId: string, lastSeenAt: Date) {
    const now = new Date();
    if (now.getTime() - lastSeenAt.getTime() < LAST_SEEN_REFRESH_MS) return;
    void this.prisma.opsUserSession
      .updateMany({ where: { id: sessionId, lastSeenAt: { lt: new Date(now.getTime() - LAST_SEEN_REFRESH_MS) } }, data: { lastSeenAt: now } })
      .catch(() => undefined);
  }

  private allowsPendingPrivacyNotice(context: ExecutionContext) {
    return this.reflector.getAllAndOverride<boolean | undefined>(ALLOW_PENDING_PRIVACY_NOTICE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]) === true;
  }

  private extractToken(request: Request) {
    const authorization = request.headers.authorization;
    if (typeof authorization === 'string') {
      const [scheme, token] = authorization.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && token) return token;
    }

    const headerToken = request.headers['x-prism-session'];
    if (typeof headerToken === 'string' && headerToken) return headerToken;

    throw new UnauthorizedException('Missing session token');
  }
}
