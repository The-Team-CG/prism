import { createHash, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../../../kernel/database';
import { AuthSessionService } from '../../../../kernel/event-session/services/auth-session.service';
import { AccountActivationService } from './account-activation.service';
import { AuthOperationsService } from './auth-operations.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const enabled = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));
if (databaseUrl && !enabled) throw new Error('P1 identity integration tests require 127.0.0.1:55437/prism_p0');

describe.skipIf(!enabled)('account activation PostgreSQL integrity', () => {
  const prefix = `p1_activation_${randomUUID()}`;
  const raceUserId = `${prefix}_race_user`;
  const staleUserId = `${prefix}_stale_user`;
  const raceToken = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  const staleToken = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  let prisma: PrismaService;
  let service: AccountActivationService;

  beforeAll(async () => {
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) process.env[variable] = databaseUrl;
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();
    for (const [userId, token] of [[raceUserId, raceToken], [staleUserId, staleToken]] as const) {
      await prisma.opsUser.create({ data: {
        id: userId, name: 'P1 Activation Fixture', email: `${userId}@example.test`, password: null, role: 'supplier', organization: 'P1', approvalStatus: 'invited',
      } });
      await prisma.opsAccountInvitation.create({ data: {
        id: `${userId}_invitation`, userId, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 60_000), source: 'admin', createdBy: 'usr_pmcm',
      } });
    }
    service = new AccountActivationService(prisma as never, { write: async () => undefined }, { markPortalInvitationOpenedByEmail: async () => undefined });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.opsAccountInvitation.deleteMany({ where: { userId: { in: [raceUserId, staleUserId] } } });
    await prisma.opsUser.deleteMany({ where: { id: { in: [raceUserId, staleUserId] } } });
    await prisma.$disconnect();
  });

  it('allows exactly one of two concurrent activations, and activates the account once', async () => {
    const results = await Promise.allSettled([
      service.activate(raceToken, 'first-password-123'),
      service.activate(raceToken, 'first-password-123'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: raceUserId }, select: { approvalStatus: true, sessionVersion: true, password: true } }))
      .resolves.toMatchObject({ approvalStatus: 'approved', sessionVersion: 1, password: expect.stringMatching(/^scrypt\$/) });
    await expect(prisma.opsAccountInvitation.findUniqueOrThrow({ where: { id: `${raceUserId}_invitation` }, select: { consumedAt: true } }))
      .resolves.toMatchObject({ consumedAt: expect.any(Date) });
  });

  it('lets the activated account sign in with the password it just set', async () => {
    const sessions = new AuthSessionService(new ConfigService({ PRISM_SESSION_SECRET: 'p1-activation-session-secret-long-enough', PRISM_SESSION_TTL_SECONDS: '28800' }));
    const authAudit = { write: async () => undefined, recordLoginHistory: async () => undefined, recordAuthenticationAudit: async () => undefined, handleFailedLogin: async () => undefined, handleForbiddenAccess: async () => undefined };
    const signIn = new AuthOperationsService(prisma as never, authAudit as never, { markPortalInvitationOpenedByEmail: async () => undefined } as never, sessions, {} as never);

    await expect(signIn.login(`${raceUserId}@example.test`, 'first-password-123')).resolves.toMatchObject({ accessToken: expect.any(String) });
  });

  it('keeps the token usable when the account is no longer waiting for activation', async () => {
    await prisma.opsUser.update({ where: { id: staleUserId }, data: { approvalStatus: 'declined' } });

    await expect(service.activate(staleToken, 'a sufficiently long password')).rejects.toThrow(/invalid or expired/i);

    await expect(prisma.opsUser.findUniqueOrThrow({ where: { id: staleUserId }, select: { password: true, approvalStatus: true } }))
      .resolves.toEqual({ password: null, approvalStatus: 'declined' });
    await expect(prisma.opsAccountInvitation.findUniqueOrThrow({ where: { id: `${staleUserId}_invitation` }, select: { consumedAt: true } }))
      .resolves.toEqual({ consumedAt: null });
  });
});
