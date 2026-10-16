import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { OpsGuestCheckIn, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
export const GUEST_CHECK_IN_FAILURE_MESSAGE = 'Guest check-in could not be completed';

export type CanonicalGuestCheckInInput = {
  eventId: string;
  rosterEntryId: string | null;
  guestName: string | null;
  checkInMode: 'name_search' | 'headcount';
  walkIn: boolean;
  verificationStatus: 'flagged' | 'verified';
  privacyConsentAccepted: boolean;
  privacyNoticeVersion: string;
  privacyConsentCapturedAt: Date | null;
  marketingConsentAccepted: boolean;
};

export async function writeCanonicalGuestCheckIn(
  tx: Prisma.TransactionClient,
  input: CanonicalGuestCheckInInput,
  options: { duplicateSafeRosterWrite?: boolean } = {},
): Promise<OpsGuestCheckIn | null> {
  const data = {
    id: 'gci_' + randomUUID(),
    eventId: input.eventId,
    rosterEntryId: input.rosterEntryId,
    guestName: input.guestName,
    checkInMode: input.checkInMode,
    status: 'checked_in',
    walkIn: input.walkIn,
    verificationStatus: input.verificationStatus,
    privacyConsentAccepted: input.privacyConsentAccepted,
    privacyNoticeVersion: input.privacyNoticeVersion,
    privacyConsentCapturedAt: input.privacyConsentCapturedAt,
    marketingConsentAccepted: input.marketingConsentAccepted,
  };

  let checkIn: OpsGuestCheckIn;
  if (options.duplicateSafeRosterWrite && input.rosterEntryId) {
    const inserted = await tx.opsGuestCheckIn.createMany({ data: [data], skipDuplicates: true });
    if (inserted.count === 0) {
      const existing = await tx.opsGuestCheckIn.findFirst({
        where: { eventId: input.eventId, rosterEntryId: input.rosterEntryId },
      });
      if (existing?.status === 'checked_in') return null;
      throw new NotFoundException(GUEST_CHECK_IN_FAILURE_MESSAGE);
    }
    const created = await tx.opsGuestCheckIn.findFirst({
      where: { eventId: input.eventId, rosterEntryId: input.rosterEntryId, status: 'checked_in' },
    });
    if (!created) throw new ServiceUnavailableException('Guest check-in could not be confirmed');
    checkIn = created;
  } else {
    checkIn = await tx.opsGuestCheckIn.create({ data });
  }

  if (input.rosterEntryId) {
    await tx.opsGuestRosterEntry.update({
      where: { id: input.rosterEntryId },
      data: { checkedInAt: checkIn.checkedInAt },
    });
  }
  return checkIn;
}
