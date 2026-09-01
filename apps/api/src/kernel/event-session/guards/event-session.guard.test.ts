import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { EventSessionGuard } from './event-session.guard';
import type { AuthSessionService } from '../services/auth-session.service';

function createContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('EventSessionGuard', () => {
  it('rejects a request with no session token', () => {
    const authSessionService = { verifyAccessToken: vi.fn() } as unknown as AuthSessionService;
    const guard = new EventSessionGuard(authSessionService);
    const context = createContext({ headers: {} });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(authSessionService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rejects a spoofed actorRole query parameter with no session token (PA-138)', () => {
    const authSessionService = { verifyAccessToken: vi.fn() } as unknown as AuthSessionService;
    const guard = new EventSessionGuard(authSessionService);
    const context = createContext({ headers: {}, query: { actorRole: 'pmcm-admin' } });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(authSessionService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('accepts a bearer token and attaches the verified actor to the request', () => {
    const verifiedActor = {
      id: 'user_pmcm',
      actorId: 'user_pmcm',
      role: 'pmcm-admin',
      actorRole: 'pmcm-admin',
      email: 'mys@pmcm.test',
      actorEmail: 'mys@pmcm.test',
      name: 'Ms. Mys',
      actorName: 'Ms. Mys',
      expiresAt: '2026-07-15T00:00:00.000Z',
    };
    const authSessionService = {
      verifyAccessToken: vi.fn(() => verifiedActor),
    } as unknown as AuthSessionService;
    const guard = new EventSessionGuard(authSessionService);
    const request: Record<string, unknown> = { headers: { authorization: 'Bearer valid-token' } };
    const context = createContext(request);

    expect(guard.canActivate(context)).toBe(true);
    expect(authSessionService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect(request.prismActor).toEqual(verifiedActor);
  });

  it('accepts the x-prism-session header as an alternative to Authorization', () => {
    const authSessionService = {
      verifyAccessToken: vi.fn(() => ({ actorRole: 'client' })),
    } as unknown as AuthSessionService;
    const guard = new EventSessionGuard(authSessionService);
    const context = createContext({ headers: { 'x-prism-session': 'session-token' } });

    expect(guard.canActivate(context)).toBe(true);
    expect(authSessionService.verifyAccessToken).toHaveBeenCalledWith('session-token');
  });
});
