import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { PrismVerifiedEventActor } from '@prism/types';
import { PrismaService } from '../../database';
import { AuthSessionService } from '../services/auth-session.service';

export type EventSessionRequest = Request & {
  prismActor?: PrismVerifiedEventActor;
};

@Injectable()
export class EventSessionGuard implements CanActivate {
  constructor(private readonly authSessionService: AuthSessionService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<EventSessionRequest>();
    const token = this.extractToken(request);
    const actor = this.authSessionService.verifyAccessToken(token);
    const user = await this.prisma.opsUser.findUnique({ where: { id: actor.id }, select: { sessionVersion: true } });
    if (!user || user.sessionVersion !== (actor.sessionVersion ?? 0)) throw new UnauthorizedException('Session has been revoked');
    request.prismActor = actor;
    return true;
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
