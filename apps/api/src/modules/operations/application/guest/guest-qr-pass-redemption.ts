import { NotFoundException } from '@nestjs/common';
import type { OpsGuestRosterEntry, Prisma } from '@prisma/client';
import { GUEST_CHECK_IN_FAILURE_MESSAGE } from './guest-check-in-writer';

export const GUEST_QR_REDEMPTION_ERROR = GUEST_CHECK_IN_FAILURE_MESSAGE;

const REVIEW_SOURCES = new Set(['coordinator-walk-in', 'guest-review', 'guest-review-headcount']);

export function isGuestQrPassToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export async function findGuestQrPassRosterEntry(
  tx: Prisma.TransactionClient,
  eventId: string,
  tokenHash: string,
): Promise<OpsGuestRosterEntry> {
  const pass = await tx.opsGuestQrPass.findFirst({
    where: { eventId, tokenHash, status: 'active' },
  });
  if (!pass) throw new NotFoundException(GUEST_QR_REDEMPTION_ERROR);

  const roster = await tx.opsGuestRosterEntry.findFirst({
    where: {
      id: pass.rosterEntryId,
      eventId,
      withdrawnAt: null,
      eligibility: 'eligible',
      verificationStatus: { not: 'rejected' },
    },
  });
  const source = typeof roster?.source === 'string' ? roster.source.trim().toLowerCase() : '';
  if (!roster
    || !roster.importBatchId?.trim()
    || !source
    || REVIEW_SOURCES.has(source)
    || roster.withdrawnAt !== null
    || roster.eligibility !== 'eligible'
    || roster.verificationStatus === 'rejected') {
    throw new NotFoundException(GUEST_QR_REDEMPTION_ERROR);
  }
  return roster;
}
