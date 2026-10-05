import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { OperationsPrivacyRedactor, OperationsRedactionResult } from '../../contracts/privacy-redaction.port';

@Injectable()
export class OperationsPrivacyRedactorService implements OperationsPrivacyRedactor {
  async redactGuest(
    input: { eventId: string; name: string },
    transaction: Prisma.TransactionClient,
  ): Promise<OperationsRedactionResult> {
    if (!input.eventId) throw new BadRequestException('Guest deletion requires an event scope');
    const guestWhere = {
      eventId: input.eventId,
      guestName: { equals: input.name.trim(), mode: 'insensitive' as const },
    };
    const rosterEntries = await transaction.opsGuestRosterEntry.findMany({
      where: {
        eventId: input.eventId,
        guestName: { equals: input.name.trim(), mode: 'insensitive' },
      },
      select: { id: true },
    });
    for (const entry of rosterEntries) {
      await transaction.opsGuestRosterEntry.update({
        where: { id: entry.id },
        data: {
          sourceKey: `privacy-redacted:${entry.id}`,
          guestName: 'Redacted guest',
          normalizedName: 'redacted guest',
          email: '',
          phone: '',
        },
      });
    }
    const checkIns = await transaction.opsGuestCheckIn.updateMany({
      where: guestWhere,
      data: { guestName: 'Redacted guest' },
    });
    const feedbackRows = await transaction.opsGuestFeedback.findMany({
      where: guestWhere,
      select: { id: true },
    });
    const feedbackIds = feedbackRows.map(({ id }) => id);
    const media = feedbackIds.length
      ? await transaction.opsGuestFeedbackMedia.updateMany({
          where: { feedbackId: { in: feedbackIds } },
          data: { originalFileName: '[redacted by privacy request]' },
        })
      : { count: 0 };
    const feedback = await transaction.opsGuestFeedback.updateMany({
      where: guestWhere,
      data: {
        guestName: 'Redacted guest',
        comment: '[redacted by privacy request]',
        photoFileName: null,
        videoFileName: null,
      },
    });
    return {
      surfaces: [
        ...(rosterEntries.length ? ['guest_roster_entry'] : []),
        ...(checkIns.count ? ['guest_check_in'] : []),
        ...(feedback.count ? ['guest_feedback'] : []),
        ...(media.count ? ['guest_feedback_media_metadata'] : []),
      ],
      touchedRecords: rosterEntries.length + checkIns.count + feedback.count + media.count,
    };
  }
}
