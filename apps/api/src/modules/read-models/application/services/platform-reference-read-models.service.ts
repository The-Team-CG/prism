import { Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { OPERATIONS_EVENT_REFERENCE_READER, type OperationsEventReferenceReader } from '@prism/contexts/event-lifecycle/operations-reference';
import type {
  AiInquiryTriageSource,
  AiProposalEventSource,
  ClientMessageTriggerFacts,
  AiAdvisoryFacts,
  EventDayCopilotFacts,
  OperationsAssistantFacts,
  PareEventSource,
  PareSupplierCandidateSource,
  PlatformPrivacyConsentFact,
  PlatformPrivacyInventory,
  PlatformPrivacyEventInventory,
  PlatformReferenceReadModel,
  PlatformStorageEventScope,
} from '../../contracts/ports/platform-reference-read-model.port';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { readEventAccessScope } from '../../event-scope';

const MAX_STORED_OBJECT_BINDINGS = 1000;

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
    // Same scope facts as every other event-level gate: current coordinator assignments and quote-request status.
    const event = await readEventAccessScope(transaction?.prisma ?? this.prisma, eventId);
    if (!event) return null;
    return {
      id: event.id,
      archived: event.archived,
      clientName: event.clientName,
      clientPortalStatus: event.clientPortalStatus,
      clientEmail: event.inquiry?.email ?? null,
      coordinatorAssignments: event.coordinatorAssignments,
      supplierQuoteRequests: event.supplierQuoteRequests,
    };
  }

  async findFileRequirementVisibility(eventId: string): Promise<Record<string, string[]>> {
    const rows = await this.prisma.opsFileRequirement.findMany({
      where: { eventId },
      select: { key: true, visibleToRoles: true },
      take: 200,
    });
    return Object.fromEntries(rows.map((row) => [row.key, row.visibleToRoles]));
  }

  async supplierMayUploadRequirement(eventId: string, key: string, supplierId: string): Promise<boolean> {
    const row = await this.prisma.opsFileRequirement.findUnique({
      where: { eventId_key: { eventId, key } },
      select: { isCustom: true, ownerRole: true, visibleToRoles: true, targetSupplierIds: true },
    });
    return Boolean(row?.isCustom && row.ownerRole === 'supplier' && row.visibleToRoles.includes('supplier') &&
      (row.targetSupplierIds.length === 0 || row.targetSupplierIds.includes(supplierId)));
  }

  /** Bounded by the requested object ids, so a cap can never hide a binding that narrows a file. */
  async findStoredObjectRequirementBindings(eventId: string, objectIds: readonly string[]): Promise<Array<{ objectId: string; documentType: string }>> {
    if (objectIds.length === 0) return [];
    const rows = await this.prisma.opsDocument.findMany({
      where: { eventId, storageKey: { in: [...objectIds] } },
      select: { storageKey: true, type: true },
      take: MAX_STORED_OBJECT_BINDINGS,
    });
    // A full page could hide a binding that narrows a file, so the lookup fails closed instead of truncating.
    if (rows.length >= MAX_STORED_OBJECT_BINDINGS) throw new ServiceUnavailableException('File requirement bindings exceed the file access bound');
    return rows.flatMap((row) => (row.storageKey ? [{ objectId: row.storageKey, documentType: row.type }] : []));
  }

  async findInquiryTriageSource(inquiryId: string): Promise<AiInquiryTriageSource | null> {
    const inquiry = await this.prisma.opsInquiry.findUnique({
      where: { id: inquiryId },
      select: {
        id: true, status: true, eventType: true, clientType: true, eventDate: true, companyName: true, source: true,
        referralDetails: true, message: true, normalizedEmail: true, organizationKey: true, previousDeclinedInquiryId: true,
      },
    });
    if (!inquiry) return null;
    const sameApplicant = [
      ...(inquiry.normalizedEmail ? [{ normalizedEmail: inquiry.normalizedEmail }] : []),
      ...(inquiry.organizationKey ? [{ organizationKey: inquiry.organizationKey }] : []),
    ];
    const duplicateInquiryCount = sameApplicant.length
      ? await this.prisma.opsInquiry.count({ where: { id: { not: inquiry.id }, OR: sameApplicant } })
      : 0;
    return {
      id: inquiry.id,
      status: inquiry.status,
      eventType: inquiry.eventType,
      clientType: inquiry.clientType,
      eventDate: inquiry.eventDate,
      hasOrganization: Boolean(inquiry.companyName.trim()),
      source: inquiry.source,
      referralDetails: inquiry.referralDetails,
      message: inquiry.message,
      duplicateInquiryCount,
      previouslyDeclined: Boolean(inquiry.previousDeclinedInquiryId),
    };
  }

  async findProposalDraftEventSource(eventId: string): Promise<AiProposalEventSource | null> {
    const event = await this.prisma.opsEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true, eventName: true, eventDate: true, archived: true, clientPortalStatus: true,
        inquiry: { select: { eventType: true } },
      },
    });
    if (!event) return null;
    return {
      id: event.id,
      eventName: event.eventName,
      eventType: event.inquiry?.eventType ?? 'Event',
      eventDate: event.eventDate,
      archived: event.archived,
      clientPortalStatus: event.clientPortalStatus,
    };
  }

  async findAiAdvisoryFacts(eventId: string): Promise<AiAdvisoryFacts | null> {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { eventDate: true, status: true, inquiry: { select: { eventType: true } } } });
    if (!event) return null;
    const latestRun = await this.prisma.opsComplianceRun.findFirst({ where: { eventId, status: 'completed' }, orderBy: { createdAt: 'desc' }, select: { id: true } });
    const [briefing, openChecks, insight, checkedInGuests, closeout] = await Promise.all([
      this.prisma.opsBriefing.findFirst({ where: { eventId }, orderBy: { submittedAt: 'desc' }, select: { guestCount: true, venueType: true, moodAndStyling: true, budgetRange: true, stylingBudget: true } }),
      latestRun
        ? this.prisma.opsComplianceCheck.findMany({ where: { runId: latestRun.id, status: 'open', evaluationStatus: 'not_satisfied' }, select: { title: true, severity: true, evidence: true, remediation: true }, orderBy: [{ severity: 'asc' }, { title: 'asc' }], take: 30 })
        : Promise.resolve([]),
      this.prisma.opsEventInsight.findUnique({ where: { eventId }, select: { dimensions: true, risks: true, supplierNotes: true, financialSummary: true } }),
      this.prisma.opsGuestCheckIn.count({ where: { eventId, status: 'checked_in' } }),
      this.prisma.opsClientCloseoutResponse.findUnique({ where: { eventId }, select: { rating: true } }),
    ]);
    return {
      event: { eventType: event.inquiry?.eventType ?? 'Event', eventDate: event.eventDate, status: event.status },
      briefing, openChecks, insight, checkedInGuests, clientRating: closeout?.rating ?? null,
    };
  }

  async findEventDayCopilotFacts(eventId: string, now: Date): Promise<EventDayCopilotFacts | null> {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { inquiry: { select: { eventType: true } } } });
    if (!event) return null;
    const hourAgo = new Date(now.getTime() - 3_600_000);
    const [operators, suppliers, openTasks, attendance, checkedIn, checkedInLastHour, briefing, openIssues] = await Promise.all([
      this.prisma.opsEventOperatorDesignation.findMany({ where: { eventId, revokedAt: null }, select: { coordinatorId: true }, take: 20 }),
      this.prisma.opsSupplierQuoteRequest.findMany({ where: { eventId, status: 'selected', assignmentStatus: 'confirmed' }, select: { category: true, eventDayStatus: true, schedule: { select: { ingressAt: true } } }, orderBy: { category: 'asc' }, take: 40 }),
      this.prisma.opsEventDayTask.findMany({ where: { eventId, status: { notIn: ['done', 'cancelled'] } }, select: { title: true, priority: true, assignedRole: true, dueAt: true }, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], take: 60 }),
      this.prisma.opsCoordinatorAssignment.findMany({ where: { eventId, status: { notIn: ['withdrawn', 'declined', 'replaced'] } }, select: { attendanceStatus: true }, take: 200 }),
      this.prisma.opsGuestCheckIn.count({ where: { eventId, status: 'checked_in' } }),
      this.prisma.opsGuestCheckIn.count({ where: { eventId, status: 'checked_in', checkedInAt: { gte: hourAgo } } }),
      this.prisma.opsBriefing.findFirst({ where: { eventId }, orderBy: { submittedAt: 'desc' }, select: { guestCount: true } }),
      this.prisma.opsUrgentIssue.findMany({ where: { eventId, status: { notIn: ['resolved', 'closed', 'cancelled'] } }, select: { title: true, severity: true, createdAt: true, slaDueAt: true }, orderBy: { createdAt: 'asc' }, take: 30 }),
    ]);
    return {
      eventType: event.inquiry?.eventType ?? 'Event',
      operatorCoordinatorIds: operators.map((operator) => operator.coordinatorId),
      suppliers: suppliers.map((supplier) => ({ category: supplier.category, eventDayStatus: supplier.eventDayStatus, ingressAt: supplier.schedule?.ingressAt ?? null })),
      openTasks, attendance, checkedIn, checkedInLastHour, expectedGuests: briefing?.guestCount || null, openIssues,
    };
  }

  async findOperationsAssistantFacts(eventId: string, now: Date): Promise<OperationsAssistantFacts | null> {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { eventDate: true, status: true, proposalClientStatus: true, floorPlanStatus: true, inquiry: { select: { eventType: true } } } });
    if (!event) return null;
    const latestRun = await this.prisma.opsComplianceRun.findFirst({ where: { eventId, status: 'completed' }, orderBy: { createdAt: 'desc' }, select: { id: true } });
    const [briefing, suppliersRequested, suppliersConfirmed, openTasks, overdueTasks, openIssues, openComplianceItems, balance, checkedInGuests] = await Promise.all([
      this.prisma.opsBriefing.findFirst({ where: { eventId }, orderBy: { submittedAt: 'desc' }, select: { guestCount: true } }),
      this.prisma.opsSupplierQuoteRequest.count({ where: { eventId } }),
      this.prisma.opsSupplierQuoteRequest.count({ where: { eventId, status: 'selected', assignmentStatus: 'confirmed' } }),
      this.prisma.opsEventDayTask.count({ where: { eventId, status: { notIn: ['done', 'cancelled'] } } }),
      this.prisma.opsEventDayTask.count({ where: { eventId, status: { notIn: ['done', 'cancelled'] }, dueAt: { lt: now } } }),
      this.prisma.opsUrgentIssue.count({ where: { eventId, status: { notIn: ['resolved', 'closed', 'cancelled'] } } }),
      latestRun ? this.prisma.opsComplianceCheck.count({ where: { runId: latestRun.id, status: 'open', evaluationStatus: 'not_satisfied' } }) : Promise.resolve(0),
      this.prisma.opsPaymentMilestone.aggregate({ where: { eventId, supersededAt: null, status: { not: 'paid' } }, _sum: { remainingBalance: true } }),
      this.prisma.opsGuestCheckIn.count({ where: { eventId, status: 'checked_in' } }),
    ]);
    return {
      eventType: event.inquiry?.eventType ?? 'Event', eventDate: event.eventDate, phase: event.status,
      guestCount: briefing?.guestCount || null, proposalStatus: event.proposalClientStatus ?? 'none', floorPlanStatus: event.floorPlanStatus ?? 'none',
      suppliersRequested, suppliersConfirmed, openTasks, overdueTasks, openIssues, openComplianceItems,
      outstandingBalance: Math.max(0, Math.round(Number(balance._sum.remainingBalance ?? 0))), checkedInGuests,
    };
  }

  async findClientMessageTriggerFacts(eventId: string): Promise<ClientMessageTriggerFacts | null> {
    const event = await this.prisma.opsEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true, eventName: true, eventDate: true, archived: true, clientPortalStatus: true,
        proposalClientStatus: true, floorPlanStatus: true, floorPlanSubmittedAt: true,
        inquiry: { select: { eventType: true, email: true } },
      },
    });
    if (!event) return null;
    const [proposal, milestone] = await Promise.all([
      this.prisma.opsProposalVersion.findFirst({ where: { eventId, status: 'issued', issuedAt: { not: null } }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true, issuedAt: true } }),
      this.prisma.opsPaymentMilestone.findFirst({ where: { eventId, supersededAt: null, status: { not: 'paid' }, remainingBalance: { gt: 0 } }, orderBy: [{ dueDate: 'asc' }, { id: 'asc' }], select: { label: true, remainingBalance: true, dueDate: true } }),
    ]);
    return {
      event: {
        id: event.id,
        eventName: event.eventName,
        eventType: event.inquiry?.eventType ?? 'Event',
        eventDate: event.eventDate,
        archived: event.archived,
        clientPortalStatus: event.clientPortalStatus,
        proposalClientStatus: event.proposalClientStatus,
        floorPlanStatus: event.floorPlanStatus,
        floorPlanSubmittedAt: event.floorPlanSubmittedAt,
        clientEmail: event.inquiry?.email ?? '',
      },
      latestIssuedProposal: proposal?.issuedAt ? { versionNumber: proposal.versionNumber, issuedAt: proposal.issuedAt } : null,
      nextUnpaidMilestone: milestone,
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

    const [billingStatements, paymentRecords] = await Promise.all([
      this.prisma.opsBillingStatement.groupBy({ by: ['eventId'], where: { eventId: { in: eventIds } }, _count: { _all: true } }),
      this.prisma.opsPaymentRecord.groupBy({ by: ['eventId'], where: { eventId: { in: eventIds } }, _count: { _all: true } }),
    ]);
    const countFor = (rows: Array<{ eventId: string; _count: { _all: number } }>, eventId: string) => rows.find((row) => row.eventId === eventId)?._count._all ?? 0;
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
        billingStatementCount: countFor(billingStatements, event.id),
        paymentRecordCount: countFor(paymentRecords, event.id),
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

  findApprovedPmcmOperator(userId: string): Promise<{ id: string; name: string } | null> {
    return this.prisma.opsUser.findFirst({
      where: { id: userId, role: 'pmcm-admin', approvalStatus: 'approved', permanentLockout: false },
      select: { id: true, name: true },
    });
  }
}
