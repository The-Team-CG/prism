import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
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
      const sourceKey = await this.availableRedactedSourceKey(transaction, input.eventId, entry.id);
      await transaction.opsGuestRosterEntry.update({
        where: { id: entry.id },
        data: {
          sourceKey,
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

  private async availableRedactedSourceKey(
    transaction: Prisma.TransactionClient,
    eventId: string,
    entryId: string,
  ): Promise<string> {
    const base = `privacy-redacted:${entryId}`;
    const maxCandidates = 16;
    for (let suffix = 0; suffix < maxCandidates; suffix += 1) {
      const candidate = suffix === 0 ? base : `${base}:${suffix}`;
      const existing = await transaction.opsGuestRosterEntry.findFirst({
        where: { eventId, sourceKey: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
    }
    throw new ConflictException('Unable to allocate a unique redacted guest roster key');
  }
}
