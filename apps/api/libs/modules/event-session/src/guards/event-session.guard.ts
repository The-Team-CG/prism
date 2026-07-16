import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { PrismVerifiedEventActor } from '@prism/types';
import { AuthSessionService } from '../services/auth-session.service';

export type EventSessionRequest = Request & {
  prismActor?: PrismVerifiedEventActor;
};

@Injectable()
export class EventSessionGuard implements CanActivate {
  constructor(private readonly authSessionService: AuthSessionService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<EventSessionRequest>();
    const token = this.extractToken(request);
    request.prismActor = this.authSessionService.verifyAccessToken(token);
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
