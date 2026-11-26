import { describe, expect, it, vi } from 'vitest';
import { clearTwoFactorRecovery, consumeBackupCode, isBackupCodeAttempt, issueBackupCodes, issueTrustedDevice, isTrustedDevice } from './two-factor-recovery';

function memoryDb() {
  const codes: Array<{ userId: string; codeHash: string; usedAt: Date | null }> = [];
  const devices: Array<{ userId: string; tokenHash: string; sessionVersion: number; expiresAt: Date; revokedAt: Date | null }> = [];
  return {
    codes,
    devices,
    opsTwoFactorBackupCode: {
      deleteMany: vi.fn(async ({ where }: { where: { userId: string } }) => { for (let i = codes.length - 1; i >= 0; i -= 1) if (codes[i]!.userId === where.userId) codes.splice(i, 1); return { count: 0 }; }),
      createMany: vi.fn(async ({ data }: { data: Array<{ userId: string; codeHash: string }> }) => { codes.push(...data.map((row) => ({ ...row, usedAt: null }))); return { count: data.length }; }),
      updateMany: vi.fn(async ({ where, data }: { where: { userId: string; codeHash: string }; data: { usedAt: Date } }) => {
        const hit = codes.find((row) => row.userId === where.userId && row.codeHash === where.codeHash && !row.usedAt);
        if (hit) hit.usedAt = data.usedAt;
        return { count: hit ? 1 : 0 };
      }),
    },
    opsTrustedDevice: {
      create: vi.fn(async ({ data }: { data: (typeof devices)[number] }) => { devices.push({ ...data, revokedAt: null }); return data; }),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => devices.find((row) => row.tokenHash === where.tokenHash) ?? null),
      updateMany: vi.fn(async ({ where, data }: { where: { userId: string }; data: { revokedAt: Date } }) => { devices.filter((row) => row.userId === where.userId).forEach((row) => { row.revokedAt = data.revokedAt; }); return { count: 1 }; }),
    },
  };
}

const user = { id: 'usr_pmcm', sessionVersion: 3 };

describe('two-factor recovery (sign-in redesign)', () => {
  it('issues ten one-time backup codes, stores only hashes, and accepts each once, typed loosely', async () => {
    const db = memoryDb();
    const codes = await issueBackupCodes(db as never, user.id);
    expect(codes).toHaveLength(10);
    expect(JSON.stringify(db.codes)).not.toContain(codes[0]!);
    expect(isBackupCodeAttempt(codes[0]!)).toBe(true);
    expect(isBackupCodeAttempt('123456')).toBe(false);

    await expect(consumeBackupCode(db as never, user.id, codes[0]!.toUpperCase().replace('-', ' '))).resolves.toBe(true);
    await expect(consumeBackupCode(db as never, user.id, codes[0]!)).resolves.toBe(false);
    // Bound to the account: another person cannot use it.
    await expect(consumeBackupCode(db as never, 'usr_other', codes[1]!)).resolves.toBe(false);

    // A new set replaces the old one.
    await issueBackupCodes(db as never, user.id);
    await expect(consumeBackupCode(db as never, user.id, codes[1]!)).resolves.toBe(false);
  });

  it('trusts a browser for 30 days, until a password change or turning the authenticator off', async () => {
    const db = memoryDb();
    const now = new Date('2026-12-01T00:00:00.000Z');
    const token = await issueTrustedDevice(db as never, user, 'Chrome on Windows', now);

    await expect(isTrustedDevice(db as never, user, token, new Date('2026-12-30T00:00:00.000Z'))).resolves.toBe(true);
    await expect(isTrustedDevice(db as never, user, token, new Date('2027-01-01T00:00:00.000Z'))).resolves.toBe(false);
    await expect(isTrustedDevice(db as never, { ...user, sessionVersion: 4 }, token, now)).resolves.toBe(false);
    await expect(isTrustedDevice(db as never, { ...user, id: 'usr_other' }, token, now)).resolves.toBe(false);
    await expect(isTrustedDevice(db as never, user, undefined, now)).resolves.toBe(false);

    await clearTwoFactorRecovery(db as never, user.id, now);
    await expect(isTrustedDevice(db as never, user, token, now)).resolves.toBe(false);
  });
});
