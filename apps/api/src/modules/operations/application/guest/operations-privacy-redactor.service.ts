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
    const checkIns = await transaction.opsGuestCheckIn.updateMany({
      where: guestWhere,
      data: { guestName: 'Redacted guest' },
    });
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
        ...(checkIns.count ? ['guest_check_in'] : []),
        ...(feedback.count ? ['guest_feedback'] : []),
      ],
      touchedRecords: checkIns.count + feedback.count,
    };
  }
}
