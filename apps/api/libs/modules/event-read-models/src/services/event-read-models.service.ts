import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
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
import type { PrismClientActionItem, PrismCommandInboxItem, PrismCommandInboxSeverity } from '@prism/types';
import { CLOSURE_READINESS_READER, type ClosureReadinessReader } from '@prism/modules/closure-ops';
import { GUEST_READER, type GuestReader } from '@prism/modules/guest-ops';
import { AuditCategory, OpsUserRole, SupplierQuoteRequestStatus, isOpsConstantValue } from '@prism/modules/event-core';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/modules/access-control';
import { STAFFING_READER, type StaffingReader } from '@prism/modules/staffing-ops';
import { EventReadModelQueries } from '../queries/event-read-models.queries';

type EventWithDrafts = OpsEvent & { floorPlanDrafts?: OpsFloorPlanDraft[] };

export type EventListMappers = {
  mapEvent: (event: EventWithDrafts) => unknown;
};

export type BillingReadModelMappers = {
  mapEvent: (event: EventWithDrafts) => unknown;
  mapBillingSource: (source: OpsBillingSource) => unknown;
  mapBillingStatement: (statement: OpsBillingStatement) => unknown;
  mapPaymentMilestone: (payment: OpsPaymentMilestone, history: OpsPaymentRecord[]) => unknown;
  mapPaymentRecord: (record: OpsPaymentRecord) => unknown;
};

export type ClientWorkspaceMappers = {
  mapEvent: (event: EventWithDrafts) => unknown;
  mapDocument: (document: OpsDocument) => unknown;
  mapBriefing: (briefing: OpsBriefing) => unknown;
  mapBillingStatement: (statement: OpsBillingStatement) => unknown;
  mapPaymentMilestone: (payment: OpsPaymentMilestone, history: OpsPaymentRecord[]) => unknown;
  mapFloorPlanDraft: (draft: OpsFloorPlanDraft) => unknown;
  mapAuditLog: (log: OpsAuditLog) => unknown;
};

export type SupplierWorkspaceMappers = {
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
  async eventList(actor: ResolvedEventOpsActor, mappers: EventListMappers) {
    const visibleEvents = await this.visibleEventsForActor(actor);
    return visibleEvents.map((event) => mappers.mapEvent(event));
  }

  async eventDetail(actor: ResolvedEventOpsActor, eventId: string, mappers: EventListMappers) {
    const event = await this.queries.eventWithDrafts(eventId);
    if (!event) throw new NotFoundException('Event not found');
    await this.policy.requireCanReadEvent(actor, event, 'event detail');
    return mappers.mapEvent(event);
  }

  async defenseReadiness(actor: ResolvedEventOpsActor, eventId: string) {
    await this.policy.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'defense readiness', eventId);
    if (!this.closureReadinessReader) throw new Error('Closure readiness reader is not configured');

    const [
      event,
      briefings,
      quoteRequests,
      supplierQuotes,
      eventDayTasks,
      urgentIssues,
      billingStatements,
      paymentMilestones,
    ] = await this.queries.defenseReadiness(eventId);
    if (!event) throw new NotFoundException('Event not found');

    const [coordinatorAssignments, guestCheckIns, guestFeedback, closeGatesResult] = await Promise.all([
      this.staffingReader.listAssignmentsForEvent(eventId),
      this.guestReader.listCheckInsForEvent(eventId),
      this.guestReader.listFeedbackForEvent(eventId),
      this.closureReadinessReader.closeGates(eventId),
    ]);
    const closeGates = closeGatesResult as { ready: boolean; missingKeys: string[] };
    const floorPlanDrafts = event.floorPlanDrafts ?? [];

    const approvedFloorplan = floorPlanDrafts.find((draft: any) => draft.status === 'approved');
    const selectedSupplierCount = supplierQuotes.filter((quote: any) => ['selected', 'locked'].includes(quote.status)).length;
    const pendingCoordinatorCount = coordinatorAssignments.filter((assignment: any) =>
      ['pending', 'pending_acknowledgement'].includes(assignment.status),
    ).length;
    const openTaskCount = eventDayTasks.filter((task: any) => !['done', 'cancelled'].includes(task.status)).length;
    const openIssueCount = urgentIssues.filter((issue: any) => !['resolved', 'closed'].includes(issue.status)).length;
    const unpaidMilestoneCount = paymentMilestones.filter((milestone: any) =>
      milestone.status !== 'paid' || milestone.remainingBalance > 0,
    ).length;
    const pendingFeedbackCount = guestFeedback.filter((feedback: any) => feedback.moderationStatus === 'pending_review').length;

    const nextActions = [
      {
        key: 'briefing',
        label: 'Client briefing',
        detail: briefings.length > 0 ? 'Briefing is on file for planning.' : 'Submit the confirmed venue, pax, budget, and service notes.',
        status: briefings.length > 0 ? 'done' : 'blocked',
        targetTab: 'briefing',
      },
      {
        key: 'floorplan',
        label: 'Official floorplan',
        detail: approvedFloorplan ? 'Approved PMCM floorplan is ready for client review.' : 'Create, submit, and approve the official PMCM layout.',
        status: approvedFloorplan ? 'done' : floorPlanDrafts.length > 0 ? 'attention' : 'blocked',
        targetTab: 'floorplans',
      },
      {
        key: 'suppliers',
        label: 'Supplier selection',
        detail:
          selectedSupplierCount > 0
            ? `${selectedSupplierCount} selected supplier quote(s) are locked.`
            : quoteRequests.length > 0
              ? 'Quote requests are out; select winning supplier quotes.'
              : 'Send scoped quote requests to Tier 1 or backup suppliers.',
        status: selectedSupplierCount > 0 ? 'done' : quoteRequests.length > 0 ? 'attention' : 'blocked',
        targetTab: 'suppliers',
      },
      {
        key: 'coordinators',
        label: 'Coordinator readiness',
        detail:
          coordinatorAssignments.length === 0
            ? 'Assign event-day roles before the live run.'
            : pendingCoordinatorCount > 0
              ? `${pendingCoordinatorCount} coordinator assignment(s) still need acknowledgment.`
              : 'Coordinator assignments are acknowledged.',
        status: coordinatorAssignments.length === 0 ? 'blocked' : pendingCoordinatorCount > 0 ? 'attention' : 'done',
        targetTab: 'coordinators',
      },
      {
        key: 'billing',
        label: 'Billing and payments',
        detail:
          billingStatements.length === 0
            ? 'Generate a billing statement from the approved CE/proposal source.'
            : unpaidMilestoneCount > 0
              ? `${unpaidMilestoneCount} payment milestone(s) still need recording.`
              : 'Billing statement and payment schedule are closed.',
        status: billingStatements.length === 0 ? 'attention' : unpaidMilestoneCount > 0 ? 'attention' : 'done',
        targetTab: 'billing',
      },
      {
        key: 'live-ops',
        label: 'Event-day operations',
        detail:
          openTaskCount + openIssueCount > 0
            ? `${openTaskCount} open task(s) and ${openIssueCount} urgent issue(s) need attention.`
            : 'Live-ops board is ready for supplier, coordinator, and attendance signals.',
        status: openIssueCount > 0 ? 'attention' : 'done',
        targetTab: 'live-ops',
      },
      {
        key: 'closure',
        label: 'Closure and archive',
        detail: closeGates.ready
          ? 'Close gates are complete; archive can proceed.'
          : `Close gate(s) still open: ${closeGates.missingKeys.join(', ') || 'none'}.`,
        status: closeGates.ready ? 'done' : 'attention',
        targetTab: 'closure',
      },
    ];
    const doneCount = nextActions.filter((action) => action.status === 'done').length;
    const overallStatus = nextActions.some((action) => action.status === 'blocked')
      ? 'blocked'
      : nextActions.some((action) => action.status === 'attention')
        ? 'attention'
        : 'ready';
    const lifecycleStage =
      event.archived
        ? 'archive'
        : !briefings.length
          ? 'briefing'
          : !approvedFloorplan
            ? 'planning'
            : selectedSupplierCount === 0 || pendingCoordinatorCount > 0
              ? 'supplier-coordinator-setup'
              : openTaskCount + openIssueCount > 0
                ? 'event-day'
                : closeGates.ready
                  ? 'closure-ready'
                  : 'closure';

    return {
      eventId,
      eventName: event.eventName,
      overallStatus,
      lifecycleStage,
      score: Math.round((doneCount / nextActions.length) * 100),
      summary: {
        briefingSubmitted: briefings.length > 0,
        officialFloorplanApproved: Boolean(approvedFloorplan),
        quoteRequests: quoteRequests.length,
        selectedSuppliers: selectedSupplierCount,
        coordinatorAssignments: coordinatorAssignments.length,
        pendingCoordinatorAcknowledgments: pendingCoordinatorCount,
        openLiveOpsItems: openTaskCount + openIssueCount,
        billingStatements: billingStatements.length,
        unpaidMilestones: unpaidMilestoneCount,
        guestAttendanceCount: guestCheckIns.length,
        pendingFeedbackModeration: pendingFeedbackCount,
        closureReady: closeGates.ready,
      },
      nextActions,
      liveAiBlocked: true,
      deferredScope: [
        'Live AI calls',
        'QR scanning',
        'Production notification adapters',
        'External auth',
        'Canva/Zoom integrations',
      ],
      generatedAt: new Date().toISOString(),
    };
  }
  constructor(
    private readonly queries: EventReadModelQueries,
    private readonly policy: EventAccessPolicyService,
    @Inject(GUEST_READER) private readonly guestReader: GuestReader,
    @Inject(STAFFING_READER) private readonly staffingReader: StaffingReader,
    @Optional() @Inject(CLOSURE_READINESS_READER) private readonly closureReadinessReader?: ClosureReadinessReader,
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

    const [billingSources, billingStatements, paymentMilestones, paymentRecords] = await this.queries.billingForEvents(
      eventIds,
      this.policy.canViewInternalCosts(actor),
    );

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
      await this.queries.clientWorkspaceForEvents(eventIds);

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
      await this.queries.clientActionCenterForEvents(eventIds);

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
    const [requests, quotes] = await this.queries.supplierWorkspaceForSupplier(supplier.id);
    const supplierEventIds = Array.from(new Set([...requests, ...quotes].map((record) => record.eventId)));
    const events = await this.queries.supplierEvents(supplierEventIds);
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
    const requests = await this.queries.supplierReadinessRequests(supplier.id);
    const eventIds = Array.from(new Set(requests.map((request) => request.eventId)));
    const events = await this.queries.supplierEvents(eventIds);
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
      await this.queries.pmcmCommandInbox();

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

    const event = await this.queries.eventWithDrafts(eventId);
    if (!event) throw new NotFoundException('Event not found');
    await this.policy.requireCanReadEvent(actor, event, 'PMCM event workspace');

    const [
      documents,
      briefings,
      supplierQuoteRequests,
      supplierQuotes,
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
    ] = await this.queries.pmcmEventWorkspace(eventId);
    const [coordinatorAssignments, guestCheckIns, guestFeedback] = await Promise.all([
      this.staffingReader.listAssignmentsForEvent(eventId),
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
      complianceRules,
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
      supplierCategories,
      suppliers,
    ] = await this.queries.pmcmDashboard();
    const [coordinators, coordinatorAssignments] = await Promise.all([
      this.queries.activeCoordinators(),
      this.queries.boundedCoordinatorAssignments(),
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
    const events = await this.queries.visibleEvents();
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
    const suppliers = await this.queries.activeSuppliers();
    const supplier = suppliers.find(
      (item) =>
        this.policy.sameText(actor.supplierId, item.id) ||
        this.policy.sameText(actor.email, item.email) ||
        this.policy.sameText(actor.name, item.name),
    );
    if (!supplier) throw new NotFoundException('Supplier profile not found for actor');
    return supplier;
  }

  private sanitizeSupplierForSupplier(supplier: Awaited<ReturnType<EventReadModelQueries['activeSuppliers']>>[number]) {
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
