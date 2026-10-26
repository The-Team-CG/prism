import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PRISM_PRIVACY_NOTICE_VERSION } from '@prism/types';
import { EventSessionGuard } from './event-session.guard';
import { AllowPendingPrivacyNotice } from '../decorators/allow-pending-privacy-notice.decorator';
import type { AuthSessionService } from '../services/auth-session.service';

class ProfileController {
  protectedRoute() {}

  @AllowPendingPrivacyNotice()
  acknowledgePrivacyNotice() {}
}

function createContext(request: Record<string, unknown>, handler: () => void = ProfileController.prototype.protectedRoute): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => ProfileController,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

const verifiedPmcmActor = {
  id: 'user_pmcm',
  actorId: 'user_pmcm',
  role: 'pmcm-admin',
  actorRole: 'pmcm-admin',
  email: 'mys@pmcm.test',
  actorEmail: 'mys@pmcm.test',
  name: 'Ms. Mys',
  actorName: 'Ms. Mys',
  sessionVersion: 0,
  expiresAt: '2099-01-01T00:00:00.000Z',
};

function prismaFor(version = 0, overrides: Record<string, unknown> = {}) {
  return {
    opsUser: {
      findUnique: vi.fn().mockResolvedValue({
        sessionVersion: version,
        approvalStatus: 'approved',
        lockedUntil: null,
        permanentLockout: false,
        role: 'pmcm-admin',
        email: 'mys@pmcm.test',
        privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
        ...overrides,
      }),
    },
  } as never;
}

describe('EventSessionGuard', () => {
  it('rejects a request with no session token', async () => {
    const authSessionService = { verifyAccessToken: vi.fn() } as unknown as AuthSessionService;
    const guard = new EventSessionGuard(authSessionService, prismaFor(), new Reflector());
    const context = createContext({ headers: {} });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(authSessionService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rejects a spoofed actorRole query parameter with no session token (PA-138)', async () => {
    const authSessionService = { verifyAccessToken: vi.fn() } as unknown as AuthSessionService;
    const guard = new EventSessionGuard(authSessionService, prismaFor(), new Reflector());
    const context = createContext({ headers: {}, query: { actorRole: 'pmcm-admin' } });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(authSessionService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('accepts a bearer token and attaches the verified actor to the request', async () => {
    const verifiedActor = verifiedPmcmActor;
    const authSessionService = {
      verifyAccessToken: vi.fn(() => verifiedActor),
    } as unknown as AuthSessionService;
    const guard = new EventSessionGuard(authSessionService, prismaFor(), new Reflector());
    const request: Record<string, unknown> = { headers: { authorization: 'Bearer valid-token' } };
    const context = createContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authSessionService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect(request.prismActor).toEqual(verifiedActor);
  });

  it('accepts the x-prism-session header as an alternative to Authorization', async () => {
    const authSessionService = {
      verifyAccessToken: vi.fn(() => ({
        ...verifiedPmcmActor,
        id: 'user_client',
        actorId: 'user_client',
        role: 'client',
        actorRole: 'client',
        email: 'client@example.test',
        actorEmail: 'client@example.test',
      })),
    } as unknown as AuthSessionService;
    const guard = new EventSessionGuard(authSessionService, prismaFor(0, { role: 'client', email: 'client@example.test' }), new Reflector());
    const context = createContext({ headers: { 'x-prism-session': 'session-token' } });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authSessionService.verifyAccessToken).toHaveBeenCalledWith('session-token');
  });

  it('rejects a signed session whose durable user epoch has changed', async () => {
    const authSessionService = {
      verifyAccessToken: vi.fn(() => verifiedPmcmActor),
    } as unknown as AuthSessionService;
    const prisma = prismaFor(1);
    const guard = new EventSessionGuard(authSessionService, prisma as never, new Reflector());
    await expect(guard.canActivate(createContext({ headers: { authorization: 'Bearer old-token' } }))).rejects.toThrow('revoked');
  });

  it.each([
    ['declined account', { approvalStatus: 'declined' }],
    ['pending account', { approvalStatus: 'pending' }],
    ['temporary lockout', { lockedUntil: new Date(Date.now() + 60_000) }],
    ['permanent lockout', { permanentLockout: true }],
    ['changed role', { role: 'client' }],
    ['changed email', { email: 'changed@example.test' }],
  ])('rejects a signed session for a currently ineligible %s', async (_label, userOverrides) => {
    const authSessionService = {
      verifyAccessToken: vi.fn(() => verifiedPmcmActor),
    } as unknown as AuthSessionService;
    const guard = new EventSessionGuard(authSessionService, prismaFor(0, userOverrides) as never, new Reflector());

    await expect(guard.canActivate(createContext({ headers: { authorization: 'Bearer old-token' } }))).rejects.toThrow(
      /revoked|eligible/i,
    );
  });

  it('blocks a signed session until its privacy notice is acknowledged, except on an allowed route', async () => {
    const authSessionService = {
      verifyAccessToken: vi.fn(() => verifiedPmcmActor),
    } as unknown as AuthSessionService;
    const guard = new EventSessionGuard(authSessionService, prismaFor(0, { privacyNoticeVersion: '2020-01-01' }) as never, new Reflector());
    const request = { headers: { authorization: 'Bearer valid-token' } };

    const blocked = await guard.canActivate(createContext(request)).then(() => null, (error: unknown) => error);
    expect(blocked).toBeInstanceOf(ForbiddenException);
    expect((blocked as ForbiddenException).getResponse()).toEqual({
      code: 'privacy_notice_required',
      message: 'Review the privacy notice to continue.',
    });
    expect(request).not.toHaveProperty('prismActor');

    await expect(guard.canActivate(createContext(request, ProfileController.prototype.acknowledgePrivacyNotice))).resolves.toBe(true);
    expect(request).toHaveProperty('prismActor', verifiedPmcmActor);
  });

  it('does not allow a guard without a durable user lookup', async () => {
    const authSessionService = { verifyAccessToken: vi.fn(() => ({ id: 'user_1', sessionVersion: 0 })) } as unknown as AuthSessionService;
    const prisma = { opsUser: { findUnique: vi.fn().mockResolvedValue(null) } } as never;
    const guard = new EventSessionGuard(authSessionService, prisma, new Reflector());
    await expect(guard.canActivate(createContext({ headers: { authorization: 'Bearer old-token' } }))).rejects.toThrow('revoked');
  });
});
