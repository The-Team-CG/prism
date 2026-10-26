import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PRISM_PRIVACY_NOTICE_VERSION } from '@prism/types';
import { PrismaService } from '../../../../kernel/database';
import { AuthSessionService } from '../../../../kernel/event-session/services/auth-session.service';
import { EventSessionGuard } from '../../../../kernel/event-session/guards/event-session.guard';
import { AuthSecurityService } from './auth-security.service';
import { PasswordResetService } from './password-reset.service';

const routeContext = (authorization: string) => ({
  getHandler: () => function route() {},
  getClass: () => class Route {},
  switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
} as never);

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const enabled = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));
if (databaseUrl && !enabled) throw new Error('P1 identity integration tests require 127.0.0.1:55437/prism_p0');

describe.skipIf(!enabled)('native password recovery PostgreSQL integrity', () => {
  const prefix = `p1_identity_${randomUUID()}`;
  const userId = `${prefix}_user`;
  const rawToken = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  let prisma: PrismaService;
  let service: PasswordResetService;

  beforeAll(async () => {
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) process.env[variable] = databaseUrl;
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.opsUser.create({ data: {
      id: userId, name: 'P1 Recovery Fixture', email: `${prefix}@example.test`, password: await AuthSecurityService.hashPassword('old-password-123'), role: 'client', organization: 'P1', approvalStatus: 'approved', privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION, privacyNoticeAcknowledgedAt: new Date(),
    } });
    await prisma.opsPasswordResetToken.create({ data: {
      id: `${prefix}_token`, userId, tokenHash: createHash('sha256').update(rawToken).digest('hex'), expiresAt: new Date(Date.now() + 60_000),
    } });
    service = new PasswordResetService(prisma, { deliver: async () => undefined }, {
      client: 'https://client.example.test',
      supplier: 'https://supplier.example.test',
      event: 'https://event.example.test',
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.opsPasswordResetToken.deleteMany({ where: { userId } });
    await prisma.opsUser.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('allows exactly one concurrent consumer, increments epoch once, and rejects the old session', async () => {
    const oldSession = new AuthSessionService(new ConfigService({ PRISM_SESSION_SECRET: 'p1-test-session-secret-long-enough', PRISM_SESSION_TTL_SECONDS: '28800' })).issueSession({
      id: userId, name: 'P1 Recovery Fixture', email: `${prefix}@example.test`, role: 'client', organization: 'P1', approvalStatus: 'approved', sessionVersion: 0,
    });
    const results = await Promise.allSettled([
      service.consume(rawToken, 'new-password-123'),
      service.consume(rawToken, 'new-password-123'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } })).resolves.toMatchObject({ sessionVersion: 1 });
    await expect(prisma.opsPasswordResetToken.findUniqueOrThrow({ where: { id: `${prefix}_token` }, select: { consumedAt: true } })).resolves.toMatchObject({ consumedAt: expect.any(Date) });

    const guard = new EventSessionGuard(new AuthSessionService(new ConfigService({ PRISM_SESSION_SECRET: 'p1-test-session-secret-long-enough', PRISM_SESSION_TTL_SECONDS: '28800' })), prisma, new Reflector());
    await expect(guard.canActivate(routeContext(`Bearer ${oldSession.accessToken}`))).rejects.toThrow(/revoked/i);
    const renewed = await prisma.opsUser.findUniqueOrThrow({ where: { id: userId } });
    const newSession = new AuthSessionService(new ConfigService({ PRISM_SESSION_SECRET: 'p1-test-session-secret-long-enough', PRISM_SESSION_TTL_SECONDS: '28800' })).issueSession({
      id: renewed.id, name: renewed.name, email: renewed.email, role: 'client', organization: renewed.organization, approvalStatus: 'approved', sessionVersion: renewed.sessionVersion,
    });
    await expect(guard.canActivate(routeContext(`Bearer ${newSession.accessToken}`))).resolves.toBe(true);
  });

  it('keeps the account unchanged when token validation fails', async () => {
    const before = await prisma.opsUser.findUniqueOrThrow({ where: { id: userId }, select: { password: true, sessionVersion: true } });
    await expect(service.consume(`${rawToken}invalid`, 'another-password-123')).rejects.toThrow(/invalid or expired/i);
    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true, password: true } })).resolves.toEqual(before);
  });
});
