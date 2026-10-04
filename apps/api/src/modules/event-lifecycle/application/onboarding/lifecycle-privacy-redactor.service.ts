import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { LifecycleClientRedaction, LifecyclePrivacyRedactor } from '../../contracts/privacy-redaction.port';

@Injectable()
export class LifecyclePrivacyRedactorService implements LifecyclePrivacyRedactor {
  async redactClient(
    input: { email: string; redactedEmail: string; eventId?: string | null },
    transaction: Prisma.TransactionClient,
  ): Promise<LifecycleClientRedaction> {
    const identities = await transaction.opsInquiry.findMany({
      where: input.eventId
        ? {
            OR: [
              { email: { equals: input.email, mode: 'insensitive' } },
              { normalizedEmail: input.email },
            ],
            events: { some: { id: input.eventId } },
          }
        : {
            OR: [
              { email: { equals: input.email, mode: 'insensitive' } },
              { normalizedEmail: input.email },
            ],
          },
      select: { id: true },
    });
    const inquiryIds = identities.map((inquiry) => inquiry.id);
    const eventReferences = await transaction.opsEvent.findMany({
      where: { inquiryId: { in: inquiryIds } },
      select: { id: true },
    });
    const eventIds = eventReferences.map((event) => event.id);
    const inquiries = await transaction.opsInquiry.updateMany({
      where: { id: { in: inquiryIds } },
      data: {
        clientName: 'Redacted data subject',
        companyName: '',
        email: input.redactedEmail,
        normalizedEmail: input.redactedEmail,
        referralDetails: '',
        message: '[redacted by privacy request]',
        loggedByName: null,
        previousDeclineReason: null,
        declineReason: null,
      },
    });
    const linkedEvents = await transaction.opsEvent.updateMany({
      where: { id: { in: eventIds } },
      data: { clientName: 'Redacted data subject' },
    });
    const surfaces = [
      ...(inquiries.count ? ['inquiry'] : []),
      ...(linkedEvents.count ? ['event_client_copy'] : []),
    ];
    return {
      inquiryIds,
      eventIds,
      surfaces,
      touchedRecords: inquiries.count + linkedEvents.count,
    };
  }
}
