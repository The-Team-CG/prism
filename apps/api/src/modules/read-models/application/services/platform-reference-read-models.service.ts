import { Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { OPERATIONS_EVENT_REFERENCE_READER, type OperationsEventReferenceReader } from '@prism/contexts/event-lifecycle/operations-reference';
import type {
  PareEventSource,
  PareSupplierCandidateSource,
  PlatformPrivacyConsentFact,
  PlatformPrivacyInventory,
  PlatformPrivacyEventInventory,
  PlatformReferenceReadModel,
  PlatformStorageEventScope,
} from '../../contracts/ports/platform-reference-read-model.port';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

@Injectable()
export class PlatformReferenceReadModelsService implements PlatformReferenceReadModel {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly operationsEventReferences?: OperationsEventReferenceReader,
  ) {}

  async findStorageEventScope(eventId: string, transaction?: PrismTransactionContext): Promise<PlatformStorageEventScope | null> {
    if (transaction) {
      if (!this.operationsEventReferences) throw new ServiceUnavailableException('Lifecycle event reference capability is unavailable');
      if (!await this.operationsEventReferences.findOperationsEvent(eventId, transaction)) return null;
    }
    const event = await (transaction?.prisma ?? this.prisma).opsEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        archived: true,
        clientName: true,
        clientPortalStatus: true,
        inquiry: { select: { email: true } },
      },
    });
    if (!event) return null;
    const supplierRequests = await (transaction?.prisma ?? this.prisma).opsSupplierQuoteRequest.findMany({
      where: { eventId },
      select: { supplierId: true, supplier: { select: { email: true } } },
    });
    const supplierContacts = supplierRequests.flatMap(({ supplierId, supplier }) =>
      supplierId ? [{ supplierId, email: supplier?.email ?? null }] : []);
    return {
      id: event.id,
      archived: event.archived,
      clientName: event.clientName,
      clientPortalStatus: event.clientPortalStatus,
      clientEmail: event.inquiry?.email ?? null,
      supplierIds: supplierContacts.map(({ supplierId }) => supplierId),
      supplierContacts,
    };
  }

  findEventReference(eventId: string): Promise<{ id: string } | null> {
    return this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { id: true } });
  }

  async findPrivacyInventory(input: { eventId?: string } = {}): Promise<PlatformPrivacyInventory> {
    // QUERY_AUDIT_ALLOW_UNBOUNDED: the system-wide privacy inventory includes every event when no filter is supplied.
    const events = await this.prisma.opsEvent.findMany({
      where: input.eventId ? { id: input.eventId } : {},
      select: { id: true, eventName: true, clientName: true, inquiryId: true, eventDate: true },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
    });
    const eventIds = events.map(({ id }) => id);
    const inquiryIds = Array.from(new Set(events.map(({ inquiryId }) => inquiryId)));

    const [inquiries, guestCheckIns, guestFeedback, guestRosterEntries, guestFeedbackMedia, approvalRequests] = await Promise.all([
      inquiryIds.length
        ? this.prisma.opsInquiry.findMany({
            where: { id: { in: inquiryIds } },
            select: { id: true, privacyConsentAccepted: true, privacyNoticeVersion: true, marketingConsentAccepted: true },
          })
        : Promise.resolve([]),
      this.prisma.opsGuestCheckIn.findMany({
        where: { eventId: { in: eventIds } },
        select: { eventId: true, privacyConsentAccepted: true, privacyNoticeVersion: true, marketingConsentAccepted: true },
      }),
      this.prisma.opsGuestFeedback.findMany({
        where: { eventId: { in: eventIds } },
        select: { eventId: true, privacyConsentAccepted: true, privacyNoticeVersion: true, marketingConsentAccepted: true },
      }),
      this.prisma.opsGuestRosterEntry.findMany({
        where: { eventId: { in: eventIds } },
        select: { eventId: true },
      }),
      this.prisma.opsGuestFeedbackMedia.findMany({
        where: { feedback: { eventId: { in: eventIds } } },
        select: {
          feedback: { select: { eventId: true, privacyConsentAccepted: true, privacyNoticeVersion: true, marketingConsentAccepted: true } },
        },
      }),
      // QUERY_AUDIT_ALLOW_UNBOUNDED: report global consent totals using consent fields only.
      this.prisma.opsApprovalRequest.findMany({
        select: { privacyConsentAccepted: true, privacyNoticeVersion: true, marketingConsentAccepted: true },
      }),
    ]);

    const consentFact = (record: PlatformPrivacyConsentFact): PlatformPrivacyConsentFact => ({
      privacyConsentAccepted: record.privacyConsentAccepted,
      privacyNoticeVersion: record.privacyNoticeVersion,
      marketingConsentAccepted: record.marketingConsentAccepted,
    });
    const eventInventory: PlatformPrivacyEventInventory[] = events.map((event) => {
      const inquiry = inquiries.find(({ id }) => id === event.inquiryId);
      return {
        ...event,
        inquiry: inquiry ? consentFact(inquiry) : null,
        guestCheckIns: guestCheckIns.filter(({ eventId }) => eventId === event.id).map(consentFact),
        guestFeedback: guestFeedback.filter(({ eventId }) => eventId === event.id).map(consentFact),
        guestRosterEntryCount: guestRosterEntries.filter(({ eventId }) => eventId === event.id).length,
        guestFeedbackMedia: guestFeedbackMedia.filter(({ feedback }) => feedback.eventId === event.id).map(({ feedback }) => consentFact(feedback)),
      };
    });

    return {
      events: eventInventory,
      approvalRequests: approvalRequests.map(consentFact),
    };
  }

  async findPareEventSource(requestId: string): Promise<PareEventSource | null> {
    const request = await this.prisma.opsSupplierQuoteRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        eventId: true,
        assignmentStatus: true,
        supplierId: true,
        supplierName: true,
        category: true,
        supplier: { select: { tier: true } },
      },
    });
    if (!request) return null;
    const event = await this.prisma.opsEvent.findUnique({
      where: { id: request.eventId },
      select: { id: true, eventDate: true, eventName: true, clientName: true },
    });
    if (!event || request.eventId !== event.id) return null;

    const [selectedQuotes, briefings] = await Promise.all([
      this.prisma.opsSupplierQuote.findMany({
        where: { eventId: request.eventId, status: 'selected' },
        select: { requestId: true, amount: true },
      }),
      this.prisma.opsBriefing.findMany({
        where: { eventId: request.eventId },
        orderBy: { submittedAt: 'desc' },
        take: 1,
        select: { serviceRequirements: true },
      }),
    ]);

    return {
      request: {
        id: request.id,
        eventId: request.eventId,
        assignmentStatus: request.assignmentStatus,
        supplierId: request.supplierId,
        supplierName: request.supplierName,
        category: request.category,
        supplierTier: request.supplier?.tier ?? null,
      },
      event,
      selectedQuotes: selectedQuotes.map((quote) => ({
        requestId: quote.requestId,
        amount: quote.amount === null ? null : Number(quote.amount),
      })),
      latestBriefingRequirements: briefings[0]?.serviceRequirements ?? null,
    };
  }

  async findPareSupplierCandidates(input: {
    category: string;
    withdrawnSupplierId: string;
    withdrawnSupplierName: string;
    eventId: string;
  }): Promise<PareSupplierCandidateSource[]> {
    const category = await this.prisma.opsSupplierCategory.findFirst({
      where: { name: input.category },
      select: { id: true },
    });
    if (!category) return [];

    const suppliers = await this.prisma.opsSupplier.findMany({
      where: {
        categoryId: category.id,
        id: { not: input.withdrawnSupplierId },
        NOT: { name: input.withdrawnSupplierName },
      },
      select: {
        id: true,
        name: true,
        tier: true,
        serviceInclusions: true,
        performanceNotes: true,
        reviews: { select: { rating: true } },
        quoteRequests: { where: { eventId: input.eventId }, select: { assignmentStatus: true } },
        quotes: { where: { eventId: input.eventId }, orderBy: { createdAt: 'desc' }, take: 1, select: { amount: true } },
      },
    });

    return suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      tier: supplier.tier,
      serviceInclusions: supplier.serviceInclusions ?? '',
      performanceNotes: supplier.performanceNotes ?? '',
      reviewRatings: supplier.reviews.map(({ rating }) => rating),
      confirmedOnEvent: supplier.quoteRequests.some(({ assignmentStatus }) => assignmentStatus === 'confirmed'),
      eventQuoteAmount: supplier.quotes[0] ? Number(supplier.quotes[0].amount) : null,
    }));
  }

  async findApprovedTrustRecipientEmail(): Promise<string | null> {
    const recipient = await this.prisma.opsUser.findFirst({
      where: { role: 'pmcm-admin', approvalStatus: 'approved' },
      orderBy: { createdAt: 'asc' },
      select: { email: true },
    });
    const email = recipient?.email?.trim().toLowerCase();
    return email && email.includes('@') ? email : null;
  }
}
