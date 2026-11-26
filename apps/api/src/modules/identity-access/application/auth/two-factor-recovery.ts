import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { OpsUser, Prisma } from '@prisma/client';
import { TRUSTED_DEVICE_DAYS, TWO_FACTOR_BACKUP_CODE_COUNT } from '@prism/types';

/**
 * Sign-in redesign, step 4: what keeps authenticator sign-in usable without weakening it. Backup codes cover a lost
 * phone; a trusted browser skips the code for 30 days. Only hashes are stored, and both are bound to one account.
 */

type Db = Prisma.TransactionClient | { opsTwoFactorBackupCode: Prisma.TransactionClient['opsTwoFactorBackupCode']; opsTrustedDevice: Prisma.TransactionClient['opsTrustedDevice'] };

const BACKUP_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function hashFor(userId: string, value: string) {
  return createHash('sha256').update(`${userId}\n${value}`, 'utf8').digest('hex');
}

/** Backup codes are compared without case or the dash, so "K7P2 9XQM" typed from paper still works. */
export function normalizeBackupCode(code: string) {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isBackupCodeAttempt(code: string) {
  return !/^\d{6}$/.test(code.trim());
}

function newBackupCode() {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (byte) => BACKUP_ALPHABET[byte % BACKUP_ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Replaces the account's backup codes with a fresh set and returns them once, for the person to save. */
export async function issueBackupCodes(db: Db, userId: string, now = new Date()): Promise<string[]> {
  const codes = Array.from({ length: TWO_FACTOR_BACKUP_CODE_COUNT }, newBackupCode);
  await db.opsTwoFactorBackupCode.deleteMany({ where: { userId } });
  await db.opsTwoFactorBackupCode.createMany({
    data: codes.map((code) => ({ id: `tfb_${randomUUID()}`, userId, codeHash: hashFor(userId, normalizeBackupCode(code)), createdAt: now })),
  });
  return codes;
}

/** Uses up one backup code; false when it is wrong or was already used. */
export async function consumeBackupCode(db: Db, userId: string, code: string, now = new Date()): Promise<boolean> {
  const used = await db.opsTwoFactorBackupCode.updateMany({
    where: { userId, codeHash: hashFor(userId, normalizeBackupCode(code)), usedAt: null },
    data: { usedAt: now },
  });
  return used.count === 1;
}

/** Remembers this browser for TRUSTED_DEVICE_DAYS and returns the token the portal keeps. */
export async function issueTrustedDevice(db: Db, user: Pick<OpsUser, 'id' | 'sessionVersion'>, device: string, now = new Date()): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.opsTrustedDevice.create({ data: {
    id: `tdv_${randomUUID()}`, userId: user.id, tokenHash: hashFor(user.id, token), device, sessionVersion: user.sessionVersion,
    expiresAt: new Date(now.getTime() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000), createdAt: now,
  } });
  return token;
}

/**
 * Whether this browser may skip the authenticator step: the token must belong to the account, be unexpired and
 * unrevoked, and come from the current session version, so a password change or "sign out everywhere" ends it.
 */
export async function isTrustedDevice(db: Db, user: Pick<OpsUser, 'id' | 'sessionVersion'>, token: string | undefined, now = new Date()): Promise<boolean> {
  if (!token) return false;
  const found = await db.opsTrustedDevice.findUnique({ where: { tokenHash: hashFor(user.id, token) } });
  return Boolean(found && found.userId === user.id && !found.revokedAt && found.expiresAt > now && found.sessionVersion === user.sessionVersion);
}

/** Turning the authenticator off ends its backup codes and every trusted browser. */
export async function clearTwoFactorRecovery(db: Db, userId: string, now = new Date()) {
  await db.opsTwoFactorBackupCode.deleteMany({ where: { userId } });
  await db.opsTrustedDevice.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
}
