import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AddressInfo } from 'node:net';
import { ForbiddenException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { AuthSessionService } from '@prism/kernel/event-session';
import { PUBLIC_RATE_LIMITS, PublicRateLimitModule } from '@prism/kernel/shared';
import { AuthOperationsService } from '../../application/auth/auth-operations.service';
import { PasswordResetService } from '../../application/auth/password-reset.service';
import { OpsAuthController } from './auth.controller';
const actor: Parameters<OpsAuthController['listApprovalRequests']>[0] = { id: 'u1', actorId: 'u1', role: 'pmcm-admin', actorRole: 'pmcm-admin', email: 'pmcm@test', actorEmail: 'pmcm@test', name: 'PMCM', actorName: 'PMCM', expiresAt: '2099-01-01' };

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsAuthController', () => {
  it('keeps the public auth route base stable under identity-ops ownership', () => {
    expect(controllerPath(OpsAuthController)).toBe('auth');
  });

  it.each(['login', 'requestPasswordReset', 'consumePasswordReset', 'setupTwoFactor', 'verifyTwoFactor', 'requestApproval'] as const)(
    'rate-limits the unauthenticated %s route',
    (handler) => {
      expect(Reflect.getMetadata('__guards__', OpsAuthController.prototype[handler])).toContain(ThrottlerGuard);
    },
  );

  it('serves auth operations through AuthOperationsService', async () => {
    const resolvedAdmin = {
      id: 'u1',
      role: 'pmcm-admin',
      name: 'Anthony Torres',
      email: 'anthony@pmcm.test',
      explicit: true,
      verified: true,
    } satisfies ResolvedEventOpsActor;
    const receipt = { message: 'If an account exists for this email, PMCM will review the request.' };
    const authOperationsService = {
      login: vi.fn(async () => ({ id: 'user_pmcm' })),
      requestApproval: vi.fn(async () => receipt),
      listApprovalRequests: vi.fn(async () => [{ id: 'approval_user' }]),
      listLoginHistory: vi.fn(async () => [{ id: 'login_1' }]),
      approveApprovalRequest: vi.fn(async () => ({ status: 'approved' })),
      declineApprovalRequest: vi.fn(async () => ({ status: 'declined' })),
      unlockUser: vi.fn(async () => ({ id: 'usr_client' })),
      resetUserTwoFactor: vi.fn(async () => ({ id: 'usr_pmcm' })),
      logout: vi.fn(async () => undefined),
      currentUser: vi.fn(async () => ({ id: 'u1' })),
    };
    const controller = new OpsAuthController(
      authOperationsService as unknown as ConstructorParameters<typeof OpsAuthController>[0],
      { resolveActor: vi.fn(() => resolvedAdmin), requireActorRole: vi.fn(async () => undefined) } as unknown as ConstructorParameters<typeof OpsAuthController>[1],
    );

    await expect(controller.login({ email: 'maxine@pmcm.test', password: 'secret' })).resolves.toEqual({ id: 'user_pmcm' });
    await expect(controller.requestApproval({ email: 'client@example.test', privacyConsentAccepted: true })).resolves.toEqual(receipt);
    await expect(controller.listApprovalRequests(actor)).resolves.toEqual([{ id: 'approval_user' }]);
    await expect(controller.listLoginHistory('user_pmcm', actor)).resolves.toEqual([{ id: 'login_1' }]);
    await expect(controller.approveApprovalRequest('approval_user', actor)).resolves.toEqual({ status: 'approved' });
    await expect(controller.declineApprovalRequest('approval_user', actor)).resolves.toEqual({ status: 'declined' });
    await expect(controller.unlockUser('usr_client', actor)).resolves.toEqual({ id: 'usr_client' });
    await expect(controller.resetUserTwoFactor('usr_pmcm', actor)).resolves.toEqual({ id: 'usr_pmcm' });
    await expect(controller.logout(actor)).resolves.toBeUndefined();
    await expect(controller.me(actor)).resolves.toEqual({ id: 'u1' });

    expect(authOperationsService.login).toHaveBeenCalledWith('maxine@pmcm.test', 'secret');
    expect(authOperationsService.requestApproval).toHaveBeenCalledWith({
      email: 'client@example.test',
      privacyConsentAccepted: true,
    });
    expect(authOperationsService.listLoginHistory).toHaveBeenCalledWith('user_pmcm');
    expect(authOperationsService.approveApprovalRequest).toHaveBeenCalledWith('approval_user', resolvedAdmin);
    expect(authOperationsService.declineApprovalRequest).toHaveBeenCalledWith('approval_user', resolvedAdmin);
    expect(authOperationsService.unlockUser).toHaveBeenCalledWith('usr_client', resolvedAdmin);
    expect(authOperationsService.resetUserTwoFactor).toHaveBeenCalledWith('usr_pmcm', resolvedAdmin);
    expect(authOperationsService.logout).toHaveBeenCalledWith(actor);
    expect(authOperationsService.currentUser).toHaveBeenCalledWith(actor);
  });

  it.each(['client', 'supplier', 'coordinator'] as const)(
    'refuses identity administration to a %s before the service runs',
    async (role) => {
      const authOperationsService = {
        listApprovalRequests: vi.fn(),
        listLoginHistory: vi.fn(),
        unlockUser: vi.fn(),
        resetUserTwoFactor: vi.fn(),
      };
      const controller = new OpsAuthController(
        authOperationsService as unknown as ConstructorParameters<typeof OpsAuthController>[0],
        new EventAccessPolicyService({ write: vi.fn(async () => undefined) } as never),
      );
      const outsider: Parameters<OpsAuthController['listApprovalRequests']>[0] = {
        id: `${role}_1`, actorId: `${role}_1`, role, actorRole: role, email: `${role}@example.test`, actorEmail: `${role}@example.test`,
        name: 'Outsider', actorName: 'Outsider', expiresAt: '2099-01-01',
      };

      await expect(controller.listApprovalRequests(outsider)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(controller.listLoginHistory('usr_client', outsider)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(controller.unlockUser('usr_client', outsider)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(controller.resetUserTwoFactor('usr_pmcm', outsider)).rejects.toBeInstanceOf(ForbiddenException);

      expect(authOperationsService.listApprovalRequests).not.toHaveBeenCalled();
      expect(authOperationsService.listLoginHistory).not.toHaveBeenCalled();
      expect(authOperationsService.unlockUser).not.toHaveBeenCalled();
      expect(authOperationsService.resetUserTwoFactor).not.toHaveBeenCalled();
    },
  );
});

const login = vi.fn(async () => ({ id: 'user_pmcm' }));
const requestApproval = vi.fn(async () => ({ message: 'If an account exists for this email, PMCM will review the request.' }));

@Module({
  imports: [PublicRateLimitModule],
  controllers: [OpsAuthController],
  providers: [
    { provide: AuthOperationsService, useValue: { login, requestApproval } },
    { provide: PasswordResetService, useValue: {} },
    { provide: EventAccessPolicyService, useValue: {} },
    { provide: AuthSessionService, useValue: {} },
    { provide: ConfigService, useValue: { get: () => undefined } },
    { provide: PrismaService, useValue: {} },
  ],
})
class AuthRateLimitHttpTestModule {}

describe('OpsAuthController public rate limits over HTTP', () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(AuthRateLimitHttpTestModule, { logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api`;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('answers 429 with Retry-After once a client exceeds the login limit, without reaching the auth service', async () => {
    const attempt = () =>
      fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'maxine@pmcm.test', password: 'guess' }),
      });

    const { limit } = PUBLIC_RATE_LIMITS.authentication;
    for (let index = 0; index < limit; index += 1) {
      expect((await attempt()).status).toBe(200);
    }

    const throttled = await attempt();
    expect(throttled.status).toBe(429);
    expect(Number(throttled.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(login).toHaveBeenCalledTimes(limit);
  }, 30_000);

  it('answers an approval request with 202 and the same receipt whatever the account state', async () => {
    const response = await fetch(`${baseUrl}/auth/approval-requests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.test', privacyConsentAccepted: true }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      message: 'If an account exists for this email, PMCM will review the request.',
    });
  }, 30_000);
});
