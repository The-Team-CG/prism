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
  OpsRegistrationPlatform,
  OpsSupplierQuote,
  OpsSupplierQuoteRequest,
  OpsUser,
} from '@prisma/client';
import { CLOSURE_READINESS_READER, type ClosureReadinessReader } from '@prism/contexts/event-lifecycle';
import { OpsUserRole, SupplierQuoteRequestStatus, isOpsConstantValue } from '@prism/kernel/event-core';
import type { PrismCommandInboxSeverity } from '@prism/types';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import {
  GUEST_READER,
  REGISTRATION_PLATFORM_READER,
  type GuestReader,
  type RegistrationPlatformReader,
  STAFFING_READER,
  type StaffingReader,
} from '@prism/contexts/operations';
import { EventReadModelQueries } from '../queries/event-read-models.queries';
import {
  buildDefenseActions,
  countMatching,
  defenseLifecycleStage,
  defenseSummary,
  overallDefenseStatus,
} from './event-read-models.defense';
import {
  collectClientActionItems,
  collectPmcmCommandInboxItems,
  countByPriority,
  countBySeverity,
  emptyInboxPayload,
  isPast,
  priorityRank,
  toIso,
} from './event-read-models.inbox';

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
  mapRegistrationPlatform: (platform: OpsRegistrationPlatform) => unknown;
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
    const input = {
      eventName: event.eventName,
      archived: event.archived,
      briefingsCount: briefings.length,
      floorPlanDraftsCount: floorPlanDrafts.length,
      approvedFloorplan: Boolean(floorPlanDrafts.find((draft: { status: string }) => draft.status === 'approved')),
      quoteRequestsCount: quoteRequests.length,
      selectedSupplierCount: countMatching(supplierQuotes, (quote: { status: string }) =>
        ['selected', 'locked'].includes(quote.status),
      ),
      coordinatorAssignmentsCount: coordinatorAssignments.length,
      pendingCoordinatorCount: countMatching(coordinatorAssignments, (assignment: { status: string }) =>
        ['pending', 'pending_acknowledgement'].includes(assignment.status),
      ),
      billingStatementsCount: billingStatements.length,
      unpaidMilestoneCount: countMatching(
        paymentMilestones,
        (milestone: { status: string; remainingBalance: number }) =>
          milestone.status !== 'paid' || milestone.remainingBalance > 0,
      ),
      openTaskCount: countMatching(eventDayTasks, (task: { status: string }) => !['done', 'cancelled'].includes(task.status)),
      openIssueCount: countMatching(urgentIssues, (issue: { status: string }) => !['resolved', 'closed'].includes(issue.status)),
      guestCheckInsCount: guestCheckIns.length,
      pendingFeedbackCount: countMatching(
        guestFeedback,
        (feedback: { moderationStatus: string }) => feedback.moderationStatus === 'pending_review',
      ),
      closeGates,
    };
    const nextActions = buildDefenseActions(input);
    const doneCount = nextActions.filter((action) => action.status === 'done').length;

    return {
      eventId,
      eventName: event.eventName,
      overallStatus: overallDefenseStatus(nextActions),
      lifecycleStage: defenseLifecycleStage(input),
      score: Math.round((doneCount / nextActions.length) * 100),
      summary: defenseSummary(input),
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
    @Optional() @Inject(REGISTRATION_PLATFORM_READER) private readonly registrationPlatformReader?: RegistrationPlatformReader,
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
      return emptyInboxPayload();
    }

    const [briefings, documents, floorPlanDrafts, billingStatements, paymentMilestones, paymentRecords, postEventDocuments] =
      await this.queries.clientActionCenterForEvents(eventIds);
    const items = collectClientActionItems({
      visibleEvents,
      briefings,
      documents,
      floorPlanDrafts,
      billingStatements,
      paymentMilestones,
      paymentRecords,
      postEventDocuments,
    });

    return {
      generatedAt: new Date().toISOString(),
      counts: countByPriority(items),
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
        const overdueUnselected = isPast(request.dueDate) && request.status !== 'selected';
        const priority: PrismCommandInboxSeverity = overdueUnselected
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
          dueAt: toIso(request.dueDate),
          href: '/dashboard',
        };
      });

    items.sort((left, right) => {
      const priority = priorityRank(left.priority) - priorityRank(right.priority);
      if (priority !== 0) return priority;
      const due = (left.dueAt ?? '').localeCompare(right.dueAt ?? '');
      if (due !== 0) return due;
      return left.id.localeCompare(right.id);
    });

    return {
      generatedAt: new Date().toISOString(),
      supplier: this.sanitizeSupplierForSupplier(supplier),
      counts: countByPriority(items),
      items,
    };
  }

  async pmcmCommandInbox(actor: ResolvedEventOpsActor) {
    await this.policy.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'PMCM command inbox');

    const [inquiries, events, paymentMilestones, quoteRequests, coordinatorAssignments, floorPlanDrafts, postEventDocuments] =
      await this.queries.pmcmCommandInbox();
    const items = collectPmcmCommandInboxItems({
      inquiries,
      events,
      paymentMilestones,
      quoteRequests,
      coordinatorAssignments,
      floorPlanDrafts,
      postEventDocuments,
    });

    return {
      generatedAt: new Date().toISOString(),
      counts: countBySeverity(items),
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
    const [coordinatorAssignments, coordinatorCoverage, guestCheckIns, guestFeedback, registrationPlatform] = await Promise.all([
      this.staffingReader.listAssignmentsForEvent(eventId),
      this.staffingReader.listCoverageForEvent?.(eventId) ?? Promise.resolve([]),
      this.guestReader.listCheckInsForEvent(eventId),
      this.guestReader.listFeedbackForEvent(eventId),
      this.registrationPlatformReader?.getByEventId(eventId) ?? Promise.resolve(null),
    ]);

    return {
      event: mappers.mapEvent(event),
      documents: documents.map(mappers.mapDocument),
      briefings: briefings.map(mappers.mapBriefing),
      supplierQuoteRequests: supplierQuoteRequests.map(mappers.mapSupplierQuoteRequest),
      supplierQuotes: supplierQuotes.map(mappers.mapSupplierQuote),
      coordinatorAssignments: coordinatorAssignments.map(mappers.mapCoordinatorAssignment),
      coordinatorCoverage,
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
      registrationPlatform: registrationPlatform ? mappers.mapRegistrationPlatform(registrationPlatform) : null,
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

  private async resolveSupplierForActor(actor: ResolvedEventOpsActor) {
    const suppliers = await this.queries.activeSuppliers();
    const supplier = suppliers.find(
      (item) =>
        this.policy.sameText(actor.supplierId, item.id) ||
        this.policy.sameText(actor.email, item.email) ||
        false,
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
