import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  OpsAuditLog,
  OpsBillingSource,
  OpsBillingStatement,
  OpsBriefing,
  OpsComplianceCheck,
  OpsComplianceRule,
  OpsCoordinator,
  OpsCoordinatorAssignment,
  OpsDocument,
  OpsEvent,
  OpsEventInsight,
  OpsFloorPlanDraft,
  OpsInquiry,
  OpsNotificationLog,
  OpsPaymentMilestone,
  OpsPaymentRecord,
  OpsPostEventDocument,
  OpsSupplierQuote,
  OpsSupplierQuoteRequest,
  OpsUser,
} from '@prisma/client';
import type { PrismaService } from '@prism/database';
import type { PrismClientActionItem, PrismCommandInboxItem, PrismCommandInboxSeverity } from '@prism/types';
import { GUEST_READER, type GuestReader } from '@prism/modules/guest-ops';
import { AuditCategory, OpsUserRole, SupplierQuoteRequestStatus, isOpsConstantValue } from '../ops.constants';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from './event-access-policy.service';
import { SuppliersService } from './suppliers.service';

type EventWithDrafts = OpsEvent & { floorPlanDrafts?: OpsFloorPlanDraft[] };

type BillingReadModelMappers = {
  mapEvent: (event: EventWithDrafts) => unknown;
  mapBillingSource: (source: OpsBillingSource) => unknown;
  mapBillingStatement: (statement: OpsBillingStatement) => unknown;
  mapPaymentMilestone: (payment: OpsPaymentMilestone, history: OpsPaymentRecord[]) => unknown;
  mapPaymentRecord: (record: OpsPaymentRecord) => unknown;
};

type ClientWorkspaceMappers = {
  mapEvent: (event: EventWithDrafts) => unknown;
  mapDocument: (document: OpsDocument) => unknown;
  mapBriefing: (briefing: OpsBriefing) => unknown;
  mapBillingStatement: (statement: OpsBillingStatement) => unknown;
  mapPaymentMilestone: (payment: OpsPaymentMilestone, history: OpsPaymentRecord[]) => unknown;
  mapFloorPlanDraft: (draft: OpsFloorPlanDraft) => unknown;
  mapAuditLog: (log: OpsAuditLog) => unknown;
};

type SupplierWorkspaceMappers = {
  mapSupplierQuoteRequest: (request: OpsSupplierQuoteRequest) => unknown;
  mapSupplierQuoteForSupplier: (quote: OpsSupplierQuote) => unknown;
};

export type PmcmDashboardMappers = {
  coordinatorRoleRequirements: unknown[];
  mapUser: (user: OpsUser) => unknown;
  mapInquiry: (inquiry: OpsInquiry) => unknown;
  mapEvent: (event: EventWithDrafts) => unknown;
  mapDocument: (document: OpsDocument) => unknown;
  mapBriefing: (briefing: OpsBriefing) => unknown;
  mapSupplierQuoteRequest: (request: OpsSupplierQuoteRequest) => unknown;
  mapSupplierQuote: (quote: OpsSupplierQuote) => unknown;
  mapCoordinator: (coordinator: OpsCoordinator) => unknown;
  mapCoordinatorAssignment: (assignment: OpsCoordinatorAssignment) => unknown;
  mapComplianceRule: (rule: OpsComplianceRule) => unknown;
  mapComplianceCheck: (check: OpsComplianceCheck) => unknown;
  mapBillingSource: (source: OpsBillingSource) => unknown;
  mapBillingStatement: (statement: OpsBillingStatement) => unknown;
  mapPaymentMilestone: (payment: OpsPaymentMilestone, history: OpsPaymentRecord[]) => unknown;
  mapPaymentRecord: (record: OpsPaymentRecord) => unknown;
  mapPostEventDocument: (document: OpsPostEventDocument) => unknown;
  mapEventInsight: (insight: OpsEventInsight) => unknown;
  mapFloorPlanDraft: (draft: OpsFloorPlanDraft) => unknown;
  mapAuditLog: (log: OpsAuditLog) => unknown;
  mapNotificationLog: (log: OpsNotificationLog) => unknown;
};

@Injectable()
export class EventReadModelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: EventAccessPolicyService,
    private readonly suppliersService: SuppliersService,
    @Inject(GUEST_READER) private readonly guestReader: GuestReader,
  ) {}

  async billing(actor: ResolvedEventOpsActor, mappers: BillingReadModelMappers) {
    await this.policy.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Client],
      'billing',
    );

    const visibleEvents = await this.visibleEventsForActor(actor);
    const eventIds = visibleEvents.map((event) => event.id);

    if (eventIds.length === 0) {
      return {
        events: [],
        billingSources: [],
        billingStatements: [],
        paymentMilestones: [],
        paymentRecords: [],
      };
    }

    const [billingSources, billingStatements, paymentMilestones, paymentRecords] = await Promise.all([
      this.policy.canViewInternalCosts(actor)
        ? this.prisma.opsBillingSource.findMany({
            where: { eventId: { in: eventIds } },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([] as OpsBillingSource[]),
      this.prisma.opsBillingStatement.findMany({
        where: { eventId: { in: eventIds } },
        orderBy: { generatedAt: 'desc' },
      }),
      this.prisma.opsPaymentMilestone.findMany({
        where: { eventId: { in: eventIds } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.opsPaymentRecord.findMany({
        where: { eventId: { in: eventIds } },
        orderBy: { recordedAt: 'desc' },
      }),
    ]);

    return {
      events: visibleEvents.map((event) => mappers.mapEvent(event)),
      billingSources: billingSources.map((source) => mappers.mapBillingSource(source)),
      billingStatements: billingStatements.map((statement) => mappers.mapBillingStatement(statement)),
      paymentMilestones: paymentMilestones.map((payment) =>
        mappers.mapPaymentMilestone(
          payment,
          paymentRecords.filter((record) => record.milestoneId === payment.id),
        ),
      ),
      paymentRecords: paymentRecords.map((record) => mappers.mapPaymentRecord(record)),
    };
  }

  async clientWorkspace(actor: ResolvedEventOpsActor, mappers: ClientWorkspaceMappers) {
    await this.policy.requireActorRole(actor, [OpsUserRole.Client], 'client workspace');

    const visibleEvents = await this.visibleEventsForActor(actor);
    const eventIds = visibleEvents.map((event) => event.id);

    if (eventIds.length === 0) {
      return {
        users: [],
        inquiries: [],
        events: [],
        documents: [],
        briefings: [],
        supplierQuotes: [],
        coordinatorAssignments: [],
        complianceChecks: [],
        billingStatements: [],
        paymentMilestones: [],
        postEventDocuments: [],
        floorPlanDrafts: [],
        auditLogs: [],
        notificationLogs: [],
      };
    }

    const [documents, briefings, floorPlanDrafts, billingStatements, paymentMilestones, paymentRecords, auditLogs] =
      await Promise.all([
        this.prisma.opsDocument.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: { uploadedAt: 'desc' },
        }),
        this.prisma.opsBriefing.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: { submittedAt: 'desc' },
        }),
        this.prisma.opsFloorPlanDraft.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.opsBillingStatement.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: { generatedAt: 'desc' },
        }),
        this.prisma.opsPaymentMilestone.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.opsPaymentRecord.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: { recordedAt: 'desc' },
        }),
        this.prisma.opsAuditLog.findMany({
          where: {
            eventId: { in: eventIds },
            category: { not: AuditCategory.Access },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

    return {
      users: [],
      inquiries: [],
      events: visibleEvents.map((event) => mappers.mapEvent(event)),
      documents: documents.map((document) => mappers.mapDocument(document)),
      briefings: briefings.map((briefing) => mappers.mapBriefing(briefing)),
      supplierQuotes: [],
      coordinatorAssignments: [],
      complianceChecks: [],
      billingStatements: billingStatements.map((statement) => mappers.mapBillingStatement(statement)),
      paymentMilestones: paymentMilestones.map((payment) =>
        mappers.mapPaymentMilestone(
          payment,
          paymentRecords.filter((record) => record.milestoneId === payment.id),
        ),
      ),
      postEventDocuments: [],
      floorPlanDrafts: floorPlanDrafts.map((draft) => mappers.mapFloorPlanDraft(draft)),
      auditLogs: auditLogs.map((log) => mappers.mapAuditLog(log)),
      notificationLogs: [],
    };
  }

  async clientActionCenter(actor: ResolvedEventOpsActor) {
    await this.policy.requireActorRole(actor, [OpsUserRole.Client], 'client action center');

    const visibleEvents = await this.visibleEventsForActor(actor);
    const eventIds = visibleEvents.map((event) => event.id);
    if (eventIds.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        counts: { critical: 0, warning: 0, attention: 0, info: 0 },
        items: [],
      };
    }

    const [briefings, documents, floorPlanDrafts, billingStatements, paymentMilestones, paymentRecords, postEventDocuments] =
      await Promise.all([
        this.prisma.opsBriefing.findMany({ where: { eventId: { in: eventIds } }, orderBy: { submittedAt: 'desc' } }),
        this.prisma.opsDocument.findMany({ where: { eventId: { in: eventIds } }, orderBy: { uploadedAt: 'desc' } }),
        this.prisma.opsFloorPlanDraft.findMany({ where: { eventId: { in: eventIds } }, orderBy: { updatedAt: 'desc' } }),
        this.prisma.opsBillingStatement.findMany({ where: { eventId: { in: eventIds } }, orderBy: { generatedAt: 'desc' } }),
        this.prisma.opsPaymentMilestone.findMany({ where: { eventId: { in: eventIds } }, orderBy: { createdAt: 'asc' } }),
        this.prisma.opsPaymentRecord.findMany({ where: { eventId: { in: eventIds } }, orderBy: { recordedAt: 'desc' } }),
        this.prisma.opsPostEventDocument.findMany({ where: { eventId: { in: eventIds } }, orderBy: { title: 'asc' } }),
      ]);

    const items: PrismClientActionItem[] = [];
    const briefingsByEventId = new Set(briefings.map((briefing) => briefing.eventId));

    for (const event of visibleEvents) {
      if (!briefingsByEventId.has(event.id)) {
        items.push({
          id: `briefing:${event.id}`,
          kind: 'briefing',
          priority: 'attention',
          label: 'Complete event briefing',
          description: `Share venue, guest count, budget, and service requirements for ${event.eventName}.`,
          status: 'missing',
          eventId: event.id,
          eventName: event.eventName,
          dueAt: this.toIso(event.eventDate),
          href: `/dashboard/events/${event.id}/briefing`,
        });
      }

      if (event.floorPlanStatus === 'in_review') {
        items.push({
          id: `floorplan:review:${event.id}`,
          kind: 'floorplan',
          priority: 'attention',
          label: 'Review official floorplan',
          description: `PMCM submitted the official layout for ${event.eventName}.`,
          status: event.floorPlanStatus,
          eventId: event.id,
          eventName: event.eventName,
          href: `/dashboard/events/${event.id}/floorplan`,
        });
      } else if (event.floorPlanStatus === 'not_started') {
        items.push({
          id: `floorplan:preferences:${event.id}`,
          kind: 'floorplan',
          priority: 'info',
          label: 'Submit layout preferences',
          description: `Share layout requirements before PMCM prepares the official floorplan for ${event.eventName}.`,
          status: event.floorPlanStatus,
          eventId: event.id,
          eventName: event.eventName,
          href: `/dashboard/events/${event.id}/floorplan`,
        });
      }
    }

    for (const payment of paymentMilestones) {
      if (payment.status === 'paid') continue;
      const event = visibleEvents.find((item) => item.id === payment.eventId);
      if (!event) continue;
      const history = paymentRecords.filter((record) => record.milestoneId === payment.id);
      const paidAmount = history.reduce((sum, record) => sum + Number(record.amountReceived ?? 0), 0);
      const remaining = Number(payment.amount ?? 0) - paidAmount;
      items.push({
        id: `billing:${payment.id}`,
        kind: 'billing',
        priority: this.isPast(payment.dueDate) ? 'critical' : 'warning',
        label: this.isPast(payment.dueDate) ? 'Payment overdue' : 'Payment pending',
        description: `${payment.label} has ${Math.max(remaining, 0).toLocaleString('en-PH')} PHP remaining.`,
        status: payment.status,
        eventId: event.id,
        eventName: event.eventName,
        dueAt: this.toIso(payment.dueDate),
        href: `/dashboard/events/${event.id}/billing`,
      });
    }

    for (const document of documents) {
      if (!['needs_update', 'pending', 'rejected'].includes(document.status)) continue;
      const event = visibleEvents.find((item) => item.id === document.eventId);
      if (!event) continue;
      items.push({
        id: `document:${document.id}`,
        kind: 'document',
        priority: document.status === 'rejected' ? 'warning' : 'attention',
        label: 'Document needs attention',
        description: `${document.fileName} is ${document.status.replaceAll('_', ' ')}.`,
        status: document.status,
        eventId: event.id,
        eventName: event.eventName,
        href: `/dashboard/events/${event.id}/documents`,
      });
    }

    for (const draft of floorPlanDrafts) {
      if (!['submitted', 'in_review'].includes(draft.status)) continue;
      const event = visibleEvents.find((item) => item.id === draft.eventId);
      if (!event) continue;
      items.push({
        id: `floorplan:draft:${draft.id}`,
        kind: 'floorplan',
        priority: 'attention',
        label: 'Floorplan draft waiting for response',
        description: `${draft.name} is ${draft.status.replaceAll('_', ' ')}.`,
        status: draft.status,
        eventId: event.id,
        eventName: event.eventName,
        href: `/dashboard/events/${event.id}/floorplan`,
      });
    }

    for (const statement of billingStatements) {
      if (statement.status !== 'issued') continue;
      const event = visibleEvents.find((item) => item.id === statement.eventId);
      if (!event) continue;
      items.push({
        id: `approval:billing:${statement.id}`,
        kind: 'approval',
        priority: 'info',
        label: 'Billing statement available',
        description: `${statement.number} is ready for ${event.eventName}.`,
        status: statement.status,
        eventId: event.id,
        eventName: event.eventName,
        href: `/dashboard/events/${event.id}/billing`,
      });
    }

    for (const document of postEventDocuments) {
      if (document.status === 'complete') continue;
      const event = visibleEvents.find((item) => item.id === document.eventId);
      if (!event) continue;
      items.push({
        id: `closure:${document.id}`,
        kind: 'closure',
        priority: event.status === 'completed' ? 'warning' : 'info',
        label: 'Closeout item pending',
        description: `${document.title} is ${document.status.replaceAll('_', ' ')}.`,
        status: document.status,
        eventId: event.id,
        eventName: event.eventName,
        href: `/dashboard/events/${event.id}/activity`,
      });
    }

    items.sort((left, right) => this.priorityRank(left.priority) - this.priorityRank(right.priority));

    return {
      generatedAt: new Date().toISOString(),
      counts: {
        critical: items.filter((item) => item.priority === 'critical').length,
        warning: items.filter((item) => item.priority === 'warning').length,
        attention: items.filter((item) => item.priority === 'attention').length,
        info: items.filter((item) => item.priority === 'info').length,
      },
      items,
    };
  }

  async supplierWorkspace(actor: ResolvedEventOpsActor, mappers: SupplierWorkspaceMappers) {
    await this.policy.requireActorRole(actor, [OpsUserRole.Supplier], 'supplier workspace');
    const supplier = await this.resolveSupplierForActor(actor);
    const [requests, quotes] = await Promise.all([
      this.prisma.opsSupplierQuoteRequest.findMany({
        where: { supplierId: supplier.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.opsSupplierQuote.findMany({
        where: { supplierId: supplier.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const supplierEventIds = Array.from(new Set([...requests, ...quotes].map((record) => record.eventId)));
    const events = supplierEventIds.length
      ? await this.prisma.opsEvent.findMany({
          where: { id: { in: supplierEventIds }, archived: false },
        })
      : [];
    const visibleEventIds = new Set(
      this.policy
        .filterEventsForActor(actor, events, { supplierEventIds })
        .map((event) => event.id),
    );

    return {
      supplier: this.sanitizeSupplierForSupplier(supplier),
      quoteRequests: requests
        .filter((request) => visibleEventIds.has(request.eventId))
        .map((request) => mappers.mapSupplierQuoteRequest(this.withExpiredQuoteRequestStatus(request))),
      supplierQuotes: quotes
        .filter((quote) => visibleEventIds.has(quote.eventId))
        .map((quote) => mappers.mapSupplierQuoteForSupplier(quote)),
    };
  }

  async supplierReadinessBoard(actor: ResolvedEventOpsActor) {
    await this.policy.requireActorRole(actor, [OpsUserRole.Supplier], 'supplier readiness board');
    const supplier = await this.resolveSupplierForActor(actor);
    const requests = await this.prisma.opsSupplierQuoteRequest.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: 'desc' },
    });
    const eventIds = Array.from(new Set(requests.map((request) => request.eventId)));
    const events = eventIds.length
      ? await this.prisma.opsEvent.findMany({
          where: { id: { in: eventIds }, archived: false },
        })
      : [];
    const visibleEvents = this.policy.filterEventsForActor(actor, events, { supplierEventIds: eventIds });
    const eventsById = new Map(visibleEvents.map((event) => [event.id, event]));

    const items = requests
      .filter((request) => eventsById.has(request.eventId))
      .map((request) => {
        const event = eventsById.get(request.eventId);
        const contractStatus = request.contractDocumentId ? 'uploaded' : 'missing';
        const assignmentStatus = request.assignmentStatus ?? 'pending';
        const readinessStatus = request.readinessStatus ?? 'not_confirmed';
        const verificationStatus = request.eventDayVerificationStatus ?? 'unverified';
        const priority: PrismCommandInboxSeverity =
          this.isPast(request.dueDate) && request.status !== 'selected'
            ? 'critical'
            : contractStatus === 'missing' || readinessStatus !== 'confirmed'
              ? 'warning'
              : verificationStatus === 'rejected'
                ? 'attention'
                : 'info';

        return {
          id: `supplier-readiness:${request.id}`,
          requestId: request.id,
          eventId: request.eventId,
          eventName: event?.eventName ?? null,
          clientName: event?.clientName ?? null,
          category: request.category,
          quoteStatus: request.status,
          assignmentStatus,
          readinessStatus,
          contractStatus,
          eventDayStatus: request.eventDayStatus ?? 'not_started',
          verificationStatus,
          priority,
          dueAt: this.toIso(request.dueDate),
          href: '/dashboard',
        };
      });

    items.sort((left, right) => this.priorityRank(left.priority) - this.priorityRank(right.priority));

    return {
      generatedAt: new Date().toISOString(),
      supplier: this.sanitizeSupplierForSupplier(supplier),
      counts: {
        critical: items.filter((item) => item.priority === 'critical').length,
        warning: items.filter((item) => item.priority === 'warning').length,
        attention: items.filter((item) => item.priority === 'attention').length,
        info: items.filter((item) => item.priority === 'info').length,
      },
      items,
    };
  }

  async pmcmCommandInbox(actor: ResolvedEventOpsActor) {
    await this.policy.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'PMCM command inbox');

    const [inquiries, events, paymentMilestones, quoteRequests, coordinatorAssignments, floorPlanDrafts, postEventDocuments] =
      await Promise.all([
        this.prisma.opsInquiry.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
        this.prisma.opsEvent.findMany({
          where: { archived: false },
          include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
          orderBy: { eventDate: 'asc' },
        }),
        this.prisma.opsPaymentMilestone.findMany({ take: 500, orderBy: { dueDate: 'asc' } }),
        this.prisma.opsSupplierQuoteRequest.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
        this.prisma.opsCoordinatorAssignment.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
        this.prisma.opsFloorPlanDraft.findMany({ take: 500, orderBy: { updatedAt: 'desc' } }),
        this.prisma.opsPostEventDocument.findMany({ take: 500, orderBy: { title: 'asc' } }),
      ]);

    const eventsById = new Map(events.map((event) => [event.id, event]));
    const items: PrismCommandInboxItem[] = [];

    for (const inquiry of inquiries) {
      if (inquiry.status === 'new') {
        items.push({
          id: `inquiry:${inquiry.id}`,
          kind: 'inquiry',
          severity: 'attention',
          label: 'Review new inquiry',
          description: `${inquiry.clientName} submitted ${inquiry.eventName}.`,
          status: inquiry.status,
          clientName: inquiry.clientName,
          createdAt: this.toIso(inquiry.createdAt),
          href: '/dashboard/inquiries',
        });
      }

      if (inquiry.status === 'accepted' && !inquiry.conformeSignedAt) {
        items.push({
          id: `conforme:${inquiry.id}`,
          kind: 'conforme',
          severity: 'warning',
          label: 'Signed conforme pending',
          description: `${inquiry.clientName} is accepted but has no signed conforme yet.`,
          status: 'awaiting_conforme',
          clientName: inquiry.clientName,
          dueAt: this.toIso(inquiry.portalInvitationExpiresAt),
          createdAt: this.toIso(inquiry.acceptedAt ?? inquiry.createdAt),
          href: '/dashboard/inquiries',
        });
      }
    }

    for (const event of events) {
      if (event.floorPlanStatus !== 'approved') {
        items.push({
          id: `floorplan:event:${event.id}`,
          kind: 'floorplan',
          severity: event.floorPlanStatus === 'in_review' ? 'attention' : 'info',
          label: 'Official floorplan needs attention',
          description: `${event.eventName} floorplan is ${event.floorPlanStatus.replaceAll('_', ' ')}.`,
          status: event.floorPlanStatus,
          eventId: event.id,
          eventName: event.eventName,
          clientName: event.clientName,
          dueAt: this.toIso(event.eventDate),
          href: `/dashboard/events/${event.id}/floorplans`,
        });
      }
    }

    for (const payment of paymentMilestones) {
      const event = eventsById.get(payment.eventId);
      if (!event || payment.status === 'paid') continue;
      const overdue = this.isPast(payment.dueDate);
      items.push({
        id: `billing:${payment.id}`,
        kind: 'billing',
        severity: overdue ? 'critical' : 'warning',
        label: overdue ? 'Payment milestone overdue' : 'Payment milestone pending',
        description: `${payment.label} for ${event.eventName} is ${payment.status.replaceAll('_', ' ')}.`,
        status: payment.status,
        eventId: event.id,
        eventName: event.eventName,
        clientName: event.clientName,
        dueAt: this.toIso(payment.dueDate),
        href: `/dashboard/events/${event.id}/billing`,
      });
    }

    for (const request of quoteRequests) {
      const event = eventsById.get(request.eventId);
      if (!event || ['selected', 'closed', 'cancelled'].includes(request.status)) continue;
      items.push({
        id: `supplier:${request.id}`,
        kind: 'supplier',
        severity: this.isPast(request.dueDate) ? 'critical' : 'attention',
        label: 'Supplier quote request open',
        description: `${request.supplierName} quote request for ${event.eventName} is ${request.status.replaceAll('_', ' ')}.`,
        status: request.status,
        eventId: event.id,
        eventName: event.eventName,
        clientName: event.clientName,
        dueAt: this.toIso(request.dueDate),
        href: `/dashboard/events/${event.id}/suppliers`,
      });
    }

    for (const assignment of coordinatorAssignments) {
      const event = eventsById.get(assignment.eventId);
      if (!event || ['confirmed', 'checked_in', 'completed'].includes(assignment.status)) continue;
      items.push({
        id: `coordinator:${assignment.id}`,
        kind: 'coordinator',
        severity: assignment.status === 'replacement_requested' ? 'critical' : 'warning',
        label: 'Coordinator assignment needs confirmation',
        description: `${assignment.coordinatorName} is ${assignment.status.replaceAll('_', ' ')} for ${event.eventName}.`,
        status: assignment.status,
        eventId: event.id,
        eventName: event.eventName,
        clientName: event.clientName,
        createdAt: this.toIso(assignment.createdAt),
        href: `/dashboard/events/${event.id}/coordinators`,
      });
    }

    for (const draft of floorPlanDrafts) {
      const event = eventsById.get(draft.eventId);
      if (!event || !['submitted', 'in_review'].includes(draft.status)) continue;
      items.push({
        id: `floorplan:draft:${draft.id}`,
        kind: 'floorplan',
        severity: 'attention',
        label: 'Floorplan draft waiting for PMCM review',
        description: `${draft.name} is ${draft.status.replaceAll('_', ' ')}.`,
        status: draft.status,
        eventId: event.id,
        eventName: event.eventName,
        clientName: event.clientName,
        createdAt: this.toIso(draft.updatedAt),
        href: `/dashboard/events/${event.id}/floorplans`,
      });
    }

    for (const document of postEventDocuments) {
      const event = eventsById.get(document.eventId);
      if (!event || document.status === 'complete') continue;
      items.push({
        id: `closure:${document.id}`,
        kind: 'closure',
        severity: event.status === 'completed' ? 'warning' : 'info',
        label: 'Closeout document pending',
        description: `${document.title} for ${event.eventName} is ${document.status.replaceAll('_', ' ')}.`,
        status: document.status,
        eventId: event.id,
        eventName: event.eventName,
        clientName: event.clientName,
        href: `/dashboard/events/${event.id}/closure`,
      });
    }

    const severityOrder: Record<PrismCommandInboxSeverity, number> = {
      critical: 0,
      warning: 1,
      attention: 2,
      info: 3,
    };
    items.sort((left, right) => {
      const severity = severityOrder[left.severity] - severityOrder[right.severity];
      if (severity !== 0) return severity;
      return this.dateRank(left.dueAt ?? left.createdAt) - this.dateRank(right.dueAt ?? right.createdAt);
    });

    return {
      generatedAt: new Date().toISOString(),
      counts: {
        critical: items.filter((item) => item.severity === 'critical').length,
        warning: items.filter((item) => item.severity === 'warning').length,
        attention: items.filter((item) => item.severity === 'attention').length,
        info: items.filter((item) => item.severity === 'info').length,
      },
      items,
    };
  }

  async pmcmEventWorkspace(actor: ResolvedEventOpsActor, eventId: string, mappers: PmcmDashboardMappers) {
    await this.policy.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'PMCM event workspace', eventId);

    const event = await this.prisma.opsEvent.findUnique({
      where: { id: eventId },
      include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
    });
    if (!event) throw new NotFoundException('Event not found');
    await this.policy.requireCanReadEvent(actor, event, 'PMCM event workspace');

    const [
      documents,
      briefings,
      supplierQuoteRequests,
      supplierQuotes,
      coordinatorAssignments,
      complianceChecks,
      billingSources,
      billingStatements,
      paymentMilestones,
      paymentRecords,
      postEventDocuments,
      eventInsights,
      floorPlanDrafts,
      auditLogs,
      notificationLogs,
      guestCheckIns,
      guestFeedback,
    ] = await Promise.all([
      this.prisma.opsDocument.findMany({ where: { eventId }, orderBy: { uploadedAt: 'desc' } }),
      this.prisma.opsBriefing.findMany({ where: { eventId }, orderBy: { submittedAt: 'desc' } }),
      this.prisma.opsSupplierQuoteRequest.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsSupplierQuote.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsCoordinatorAssignment.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsComplianceCheck.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsBillingSource.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsBillingStatement.findMany({ where: { eventId }, orderBy: { generatedAt: 'desc' } }),
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.opsPaymentRecord.findMany({ where: { eventId }, orderBy: { recordedAt: 'desc' } }),
      this.prisma.opsPostEventDocument.findMany({ where: { eventId }, orderBy: { title: 'asc' } }),
      this.prisma.opsEventInsight.findMany({ where: { eventId }, orderBy: { generatedAt: 'desc' } }),
      this.prisma.opsFloorPlanDraft.findMany({ where: { eventId }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.opsAuditLog.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.opsNotificationLog.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.guestReader.listCheckInsForEvent(eventId),
      this.guestReader.listFeedbackForEvent(eventId),
    ]);

    return {
      event: mappers.mapEvent(event),
      documents: documents.map(mappers.mapDocument),
      briefings: briefings.map(mappers.mapBriefing),
      supplierQuoteRequests: supplierQuoteRequests.map(mappers.mapSupplierQuoteRequest),
      supplierQuotes: supplierQuotes.map(mappers.mapSupplierQuote),
      coordinatorAssignments: coordinatorAssignments.map(mappers.mapCoordinatorAssignment),
      complianceChecks: complianceChecks.map(mappers.mapComplianceCheck),
      billingSources: billingSources.map(mappers.mapBillingSource),
      billingStatements: billingStatements.map(mappers.mapBillingStatement),
      paymentMilestones: paymentMilestones.map((payment) =>
        mappers.mapPaymentMilestone(
          payment,
          paymentRecords.filter((record) => record.milestoneId === payment.id),
        ),
      ),
      paymentRecords: paymentRecords.map(mappers.mapPaymentRecord),
      postEventDocuments: postEventDocuments.map(mappers.mapPostEventDocument),
      eventInsights: eventInsights.map(mappers.mapEventInsight),
      floorPlanDrafts: floorPlanDrafts.map(mappers.mapFloorPlanDraft),
      auditLogs: auditLogs.map(mappers.mapAuditLog),
      notificationLogs: notificationLogs.map(mappers.mapNotificationLog),
      guestAttendanceCount: guestCheckIns.length,
      guestCheckIns: guestCheckIns.map((checkIn) => this.guestReader.mapGuestCheckIn(checkIn)),
      guestFeedback: guestFeedback.map((feedback) => this.guestReader.mapGuestFeedback(feedback)),
    };
  }

  async pmcmDashboard(actor: ResolvedEventOpsActor, mappers: PmcmDashboardMappers) {
    await this.policy.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'PMCM dashboard');

    const [
      users,
      inquiries,
      events,
      documents,
      briefings,
      supplierQuoteRequests,
      supplierQuotes,
      coordinators,
      coordinatorAssignments,
      complianceRules,
      complianceChecks,
      billingSources,
      billingStatements,
      paymentMilestones,
      paymentRecords,
      postEventDocuments,
      eventInsights,
      floorPlanDrafts,
      supplierCategories,
      suppliers,
      auditLogs,
      notificationLogs,
    ] = await Promise.all([
      this.prisma.opsUser.findMany({ take: 500, orderBy: { createdAt: 'asc' } }),
      this.prisma.opsInquiry.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsEvent.findMany({
        include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.opsDocument.findMany({ take: 500, orderBy: { uploadedAt: 'desc' } }),
      this.prisma.opsBriefing.findMany({ take: 500, orderBy: { submittedAt: 'desc' } }),
      this.prisma.opsSupplierQuoteRequest.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsSupplierQuote.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsCoordinator.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      this.prisma.opsCoordinatorAssignment.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsComplianceRule.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsComplianceCheck.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsBillingSource.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsBillingStatement.findMany({ take: 500, orderBy: { generatedAt: 'desc' } }),
      this.prisma.opsPaymentMilestone.findMany({ take: 500, orderBy: { createdAt: 'asc' } }),
      this.prisma.opsPaymentRecord.findMany({ take: 500, orderBy: { recordedAt: 'desc' } }),
      this.prisma.opsPostEventDocument.findMany({ take: 500, orderBy: { title: 'asc' } }),
      this.prisma.opsEventInsight.findMany({ take: 500, orderBy: { generatedAt: 'desc' } }),
      this.prisma.opsFloorPlanDraft.findMany({ take: 500, orderBy: { updatedAt: 'desc' } }),
      this.suppliersService.listSupplierCategories(),
      this.suppliersService.listSuppliers(),
      this.prisma.opsAuditLog.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      this.prisma.opsNotificationLog.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
    ]);

    return {
      users: users.map(mappers.mapUser),
      inquiries: inquiries.map(mappers.mapInquiry),
      events: events.map(mappers.mapEvent),
      documents: documents.map(mappers.mapDocument),
      briefings: briefings.map(mappers.mapBriefing),
      supplierQuoteRequests: supplierQuoteRequests.map(mappers.mapSupplierQuoteRequest),
      supplierQuotes: supplierQuotes.map(mappers.mapSupplierQuote),
      coordinators: coordinators.map(mappers.mapCoordinator),
      coordinatorRoleRequirements: mappers.coordinatorRoleRequirements,
      coordinatorAssignments: coordinatorAssignments.map(mappers.mapCoordinatorAssignment),
      complianceRules: complianceRules.map(mappers.mapComplianceRule),
      complianceChecks: complianceChecks.map(mappers.mapComplianceCheck),
      billingSources: billingSources.map(mappers.mapBillingSource),
      billingStatements: billingStatements.map(mappers.mapBillingStatement),
      paymentMilestones: paymentMilestones.map((payment) =>
        mappers.mapPaymentMilestone(
          payment,
          paymentRecords.filter((record) => record.milestoneId === payment.id),
        ),
      ),
      paymentRecords: paymentRecords.map(mappers.mapPaymentRecord),
      postEventDocuments: postEventDocuments.map(mappers.mapPostEventDocument),
      eventInsights: eventInsights.map(mappers.mapEventInsight),
      floorPlanDrafts: floorPlanDrafts.map(mappers.mapFloorPlanDraft),
      supplierCategories,
      suppliers,
      auditLogs: auditLogs.map(mappers.mapAuditLog),
      notificationLogs: notificationLogs.map(mappers.mapNotificationLog),
    };
  }

  private async visibleEventsForActor(actor: ResolvedEventOpsActor) {
    const events = await this.prisma.opsEvent.findMany({
      where: { archived: false },
      include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
      orderBy: { eventDate: 'asc' },
    });
    return this.policy.filterEventsForActor(actor, events);
  }

  private toIso(value?: Date | string | null) {
    if (!value) return null;
    if (typeof value === 'string') return value;
    return value.toISOString();
  }

  private isPast(value?: Date | string | null) {
    if (!value) return false;
    const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(time) && time < Date.now();
  }

  private dateRank(value?: string | null) {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
  }

  private priorityRank(priority: PrismCommandInboxSeverity) {
    const ranks: Record<PrismCommandInboxSeverity, number> = {
      critical: 0,
      warning: 1,
      attention: 2,
      info: 3,
    };
    return ranks[priority];
  }

  private async resolveSupplierForActor(actor: ResolvedEventOpsActor) {
    const suppliers = await this.suppliersService.listSuppliers();
    const supplier = suppliers.find(
      (item) =>
        this.policy.sameText(actor.supplierId, item.id) ||
        this.policy.sameText(actor.email, item.email) ||
        this.policy.sameText(actor.name, item.name),
    );
    if (!supplier) throw new NotFoundException('Supplier profile not found for actor');
    return supplier;
  }

  private sanitizeSupplierForSupplier(supplier: Awaited<ReturnType<SuppliersService['listSuppliers']>>[number]) {
    const { reviews, reliabilityNotes, performanceNotes, aggregateRating, lastEventDate, pastEvents, ...safeSupplier } =
      supplier;
    return safeSupplier;
  }

  private withExpiredQuoteRequestStatus(request: OpsSupplierQuoteRequest) {
    if (
      request.dueDate &&
      request.dueDate.getTime() < Date.now() &&
      isOpsConstantValue(SupplierQuoteRequestStatus, request.status) &&
      (request.status === SupplierQuoteRequestStatus.Open ||
        request.status === SupplierQuoteRequestStatus.RevisionRequested)
    ) {
      return { ...request, status: SupplierQuoteRequestStatus.Expired } as OpsSupplierQuoteRequest;
    }
    return request;
  }
}
