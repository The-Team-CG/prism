import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AddressInfo } from 'node:net';
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
    const authOperationsService = {
      login: vi.fn(async () => ({ id: 'user_pmcm' })),
      requestApproval: vi.fn(async () => ({ id: 'approval_user' })),
      listApprovalRequests: vi.fn(async () => [{ id: 'approval_user' }]),
      listLoginHistory: vi.fn(async () => [{ id: 'login_1' }]),
      approveApprovalRequest: vi.fn(async () => ({ status: 'approved' })),
      declineApprovalRequest: vi.fn(async () => ({ status: 'declined' })),
    };
    const controller = new OpsAuthController(
      authOperationsService as unknown as ConstructorParameters<typeof OpsAuthController>[0],
      { resolveActor: vi.fn(() => resolvedAdmin), requireActorRole: vi.fn(async () => undefined) } as unknown as ConstructorParameters<typeof OpsAuthController>[1],
    );

    await expect(controller.login({ email: 'maxine@pmcm.test', password: 'secret' })).resolves.toEqual({ id: 'user_pmcm' });
    await expect(controller.requestApproval({ email: 'client@example.test', privacyConsentAccepted: true })).resolves.toEqual({ id: 'approval_user' });
    await expect(controller.listApprovalRequests(actor)).resolves.toEqual([{ id: 'approval_user' }]);
    await expect(controller.listLoginHistory('user_pmcm', actor)).resolves.toEqual([{ id: 'login_1' }]);
    await expect(controller.approveApprovalRequest('approval_user', actor)).resolves.toEqual({ status: 'approved' });
    await expect(controller.declineApprovalRequest('approval_user', actor)).resolves.toEqual({ status: 'declined' });

    expect(authOperationsService.login).toHaveBeenCalledWith('maxine@pmcm.test', 'secret');
    expect(authOperationsService.requestApproval).toHaveBeenCalledWith({
      email: 'client@example.test',
      privacyConsentAccepted: true,
    });
    expect(authOperationsService.listLoginHistory).toHaveBeenCalledWith('user_pmcm');
    expect(authOperationsService.approveApprovalRequest).toHaveBeenCalledWith('approval_user', resolvedAdmin);
    expect(authOperationsService.declineApprovalRequest).toHaveBeenCalledWith('approval_user', resolvedAdmin);
  });
});

const login = vi.fn(async () => ({ id: 'user_pmcm' }));

@Module({
  imports: [PublicRateLimitModule],
  controllers: [OpsAuthController],
  providers: [
    { provide: AuthOperationsService, useValue: { login } },
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
});
