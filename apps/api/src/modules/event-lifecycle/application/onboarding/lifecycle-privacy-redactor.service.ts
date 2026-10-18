import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismPrivacyExportSection } from '@prism/types';
import type { LifecycleClientRedaction, LifecyclePrivacyRedactor } from '../../contracts/privacy-redaction.port';

@Injectable()
export class LifecyclePrivacyRedactorService implements LifecyclePrivacyRedactor {
  async redactClient(
    input: { email: string; redactedEmail: string; eventId?: string | null },
    transaction: Prisma.TransactionClient,
  ): Promise<LifecycleClientRedaction> {
    const inquiryIds = await this.matchingInquiryIds(input.email, input.eventId, transaction);
    const eventIds = await this.linkedEventIds(inquiryIds, input.eventId, transaction);
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

  /**
   * Returns the subject's own inquiries and linked events. PMCM-internal notes (decline reasons, logging staff)
   * are deliberately omitted from the export.
   */
  async exportClient(
    input: { email: string; eventId?: string | null },
    transaction: Prisma.TransactionClient,
  ): Promise<{ eventIds: string[]; sections: PrismPrivacyExportSection[] }> {
    const inquiries = await transaction.opsInquiry.findMany({
      where: this.inquiryMatchWhere(input.email, input.eventId),
      select: {
        id: true, clientName: true, companyName: true, email: true, eventName: true, eventType: true, eventDate: true,
        clientType: true, source: true, referralDetails: true, message: true, status: true,
        privacyConsentAccepted: true, privacyNoticeVersion: true, marketingConsentAccepted: true, createdAt: true,
      },
    });
    const eventIds = await this.linkedEventIds(inquiries.map((inquiry) => inquiry.id), input.eventId, transaction);
    const events = eventIds.length
      ? await transaction.opsEvent.findMany({
          where: { id: { in: eventIds } },
          select: { id: true, clientName: true, eventName: true, eventDate: true, status: true, clientPortalStatus: true, archived: true, createdAt: true },
        })
      : [];
    const sections: PrismPrivacyExportSection[] = [
      {
        owner: 'event-lifecycle',
        surface: 'inquiry',
        records: inquiries.map((inquiry) => ({
          id: inquiry.id,
          clientName: inquiry.clientName,
          companyName: inquiry.companyName,
          email: inquiry.email,
          eventName: inquiry.eventName,
          eventType: inquiry.eventType,
          eventDate: inquiry.eventDate.toISOString(),
          clientType: inquiry.clientType,
          source: inquiry.source,
          referralDetails: inquiry.referralDetails,
          message: inquiry.message,
          status: inquiry.status,
          privacyConsentAccepted: inquiry.privacyConsentAccepted,
          privacyNoticeVersion: inquiry.privacyNoticeVersion,
          marketingConsentAccepted: inquiry.marketingConsentAccepted,
          createdAt: inquiry.createdAt.toISOString(),
        })),
      },
      {
        owner: 'event-lifecycle',
        surface: 'event',
        records: events.map((event) => ({
          id: event.id,
          clientName: event.clientName,
          eventName: event.eventName,
          eventDate: event.eventDate.toISOString(),
          status: event.status,
          clientPortalStatus: event.clientPortalStatus,
          archived: event.archived,
          createdAt: event.createdAt.toISOString(),
        })),
      },
    ];
    return { eventIds, sections: sections.filter((section) => section.records.length > 0) };
  }

  private inquiryMatchWhere(email: string, eventId?: string | null): Prisma.OpsInquiryWhereInput {
    const identity: Prisma.OpsInquiryWhereInput = {
      OR: [
        { email: { equals: email, mode: 'insensitive' } },
        { normalizedEmail: email },
      ],
    };
    return eventId ? { ...identity, events: { some: { id: eventId } } } : identity;
  }

  private async matchingInquiryIds(email: string, eventId: string | null | undefined, transaction: Prisma.TransactionClient) {
    const identities = await transaction.opsInquiry.findMany({
      where: this.inquiryMatchWhere(email, eventId),
      select: { id: true },
    });
    return identities.map((inquiry) => inquiry.id);
  }

  private async linkedEventIds(inquiryIds: string[], eventId: string | null | undefined, transaction: Prisma.TransactionClient) {
    const eventReferences = await transaction.opsEvent.findMany({
      where: {
        inquiryId: { in: inquiryIds },
        ...(eventId ? { id: eventId } : {}),
      },
      select: { id: true },
    });
    return eventReferences.map((event) => event.id);
  }
}
