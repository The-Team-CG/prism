import type { Prisma } from '@prisma/client';

/**
 * Withdraws every sign-in email change still open for an account, so its links stop working. A password change,
 * a password reset and a two-step reset call this in the same transaction: an email change asked for before the
 * person secured their account (possibly by whoever had their password) must not outlive that.
 */
export function cancelOpenEmailChanges(tx: Prisma.TransactionClient, userId: string, now = new Date()) {
  return tx.opsEmailChangeRequest.updateMany({ where: { userId, consumedAt: null, cancelledAt: null }, data: { cancelledAt: now } });
}
