import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PRISM_PRIVACY_NOTICE_REQUIRED_CODE, privacyNoticeRequired, type PrismVerifiedEventActor } from '@prism/types';
import { PrismaService } from '../../database';
import { AuthSessionService } from '../services/auth-session.service';
import { ALLOW_PENDING_PRIVACY_NOTICE_METADATA } from '../decorators/allow-pending-privacy-notice.decorator';

export type EventSessionRequest = Request & {
  prismActor?: PrismVerifiedEventActor;
};

@Injectable()
export class EventSessionGuard implements CanActivate {
  constructor(
    private readonly authSessionService: AuthSessionService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<EventSessionRequest>();
    const token = this.extractToken(request);
    const actor = this.authSessionService.verifyAccessToken(token);
    const user = await this.prisma.opsUser.findUnique({
      where: { id: actor.id },
      select: {
        sessionVersion: true,
        approvalStatus: true,
        lockedUntil: true,
        permanentLockout: true,
        role: true,
        email: true,
        privacyNoticeVersion: true,
      },
    });
    const locked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());
    const identityChanged = user && (
      user.role !== actor.actorRole ||
      user.email.trim().toLowerCase() !== actor.actorEmail.trim().toLowerCase()
    );
    if (
      !user ||
      user.sessionVersion !== (actor.sessionVersion ?? 0) ||
      user.approvalStatus !== 'approved' ||
      user.permanentLockout ||
      locked ||
      identityChanged
    ) {
      throw new UnauthorizedException('Session has been revoked or account access is no longer eligible');
    }
    if (privacyNoticeRequired(user.privacyNoticeVersion) && !this.allowsPendingPrivacyNotice(context)) {
      throw new ForbiddenException({
        code: PRISM_PRIVACY_NOTICE_REQUIRED_CODE,
        message: 'Review the privacy notice to continue.',
      });
    }
    request.prismActor = actor;
    return true;
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
