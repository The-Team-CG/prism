import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { AuthSecurityService } from './auth-security.service';
import { AuthOperationsService } from './auth-operations.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const enabled = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));
if (databaseUrl && !enabled) throw new Error('Identity lockout integration tests require 127.0.0.1:55437/prism_p0');

describe.skipIf(!enabled)('Identity failed-login PostgreSQL integrity', () => {
  const prefix = `p1_lockout_${randomUUID()}`;
  const userId = `${prefix}_user`;
  const email = `${prefix}@example.test`;
  let prisma: PrismaService;
  let service: AuthOperationsService;
  const authAudit = {
    recordLoginHistory: vi.fn(async () => undefined),
    recordAuthenticationAudit: vi.fn(async () => undefined),
    handleFailedLogin: vi.fn(async () => undefined),
    handleForbiddenAccess: vi.fn(async () => undefined),
    write: vi.fn(async () => undefined),
  };

  beforeAll(async () => {
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) process.env[variable] = databaseUrl;
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.opsUser.create({ data: {
      id: userId,
      name: 'P1 Lockout Fixture',
      email,
      password: AuthSecurityService.hashPassword('correct-password-123'),
      role: 'client',
      organization: 'P1',
      approvalStatus: 'approved',
      failedLoginCount: 3,
    } });
    service = new AuthOperationsService(prisma, authAudit as never, {} as never, {} as never, {} as never);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.opsUser.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('serializes simultaneous invalid passwords and records the fifth failure as a temporary lockout', async () => {
    const attempts = await Promise.allSettled([
      service.login(email, 'wrong-password'),
      service.login(email, 'wrong-password'),
    ]);
    expect(attempts.filter(({ status }) => status === 'rejected')).toHaveLength(2);

    const user = await prisma.opsUser.findUniqueOrThrow({ where: { id: userId } });
    expect(user).toMatchObject({ failedLoginCount: 0, lockoutCount: 1, permanentLockout: false });
    expect(user.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    expect(authAudit.handleFailedLogin).toHaveBeenCalledTimes(2);
    expect(authAudit.handleFailedLogin).toHaveBeenCalledWith(expect.objectContaining({ failedAttempt: 5, locked: true }));
  });
});
