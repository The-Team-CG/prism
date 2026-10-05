import { ForbiddenException, Inject, Injectable, InternalServerErrorException, NotFoundException, Optional } from '@nestjs/common';
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
  OpsOcularVisitRequest,
  OpsPaymentMilestone,
  OpsPaymentRecord,
  OpsPostEventDocument,
  OpsRegistrationPlatform,
  OpsSupplierQuote,
  OpsSupplierQuoteRequest,
  OpsUser,
} from '@prisma/client';
import {
  CLOSURE_READINESS_READER,
  EVENT_CLIENT_FLOORPLAN_ACCESS_READER,
  type ClosureReadinessReader,
  type EventClientFloorplanAccessReader,
} from '@prism/contexts/event-lifecycle';
import { FLOORPLAN_READER, type FloorplanReader } from '@prism/contexts/floorplan';
import { OpsUserRole, SupplierQuoteRequestStatus, isOpsConstantValue } from '@prism/kernel/event-core';
import type {
  PrismClientEventTimeline,
  PrismClientSharedFloorplanEntry,
  PrismClientTimelineMilestoneKey,
  PrismClientTimelineMilestoneStatus,
  PrismCommandInboxSeverity,
  PrismClientOcularVisit,
  PrismOcularVisitStatus,
  PrismPmcmOcularVisit,
} from '@prism/types';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import {
  GUEST_READER,
  REGISTRATION_PLATFORM_READER,
  type GuestReader,
  type RegistrationPlatformReader,
  STAFFING_READER,
  type StaffingReader,
} from '@prism/contexts/operations';
import { EventReadModelQueries, MAX_PMCM_COMMAND_INBOX_PAGE_SIZE } from '../queries/event-read-models.queries';
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

type ClientEventTimelineSource = Pick<
  OpsEvent,
  'id' | 'eventDate' | 'status' | 'archived' | 'proposalClientStatus' | 'proposalReviewedAt'
> & {
  inquiry: Pick<OpsInquiry, 'conformeSignedAt'> | null;
  floorPlanDrafts: Array<Pick<OpsFloorPlanDraft, 'approvedAt'>>;
  paymentMilestones: Array<Pick<OpsPaymentMilestone, 'dueDate' | 'status' | 'remainingBalance'>>;
};

const CLIENT_TIMELINE_KEYS = [
  'conforme_signed',
  'proposal_accepted',
  'floor_plan_approved',
  'balance_payment_due',
  'event_date',
] as const satisfies readonly PrismClientTimelineMilestoneKey[];

function toClientTimelineDate(value: Date | null | undefined): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

function mapClientEventTimeline(source: ClientEventTimelineSource): PrismClientEventTimeline {
  const balanceMilestone = source.paymentMilestones[0];
  const terminalEvent = source.status === 'completed' || source.archived;
  const milestoneDates = [
    source.inquiry?.conformeSignedAt ?? null,
    source.proposalClientStatus === 'approved' ? source.proposalReviewedAt : null,
    source.floorPlanDrafts[0]?.approvedAt ?? null,
    balanceMilestone?.dueDate ?? null,
    source.eventDate,
  ];
  const completed = [
    source.inquiry?.conformeSignedAt != null,
    source.proposalClientStatus === 'approved',
    source.floorPlanDrafts.length > 0,
    balanceMilestone?.status === 'paid' || balanceMilestone?.remainingBalance === 0,
    source.status === 'completed' || source.archived,
  ];

  let currentAssigned = false;
  const milestones = CLIENT_TIMELINE_KEYS.map((key, index) => {
    const isComplete = completed[index] ?? false;
    let status: PrismClientTimelineMilestoneStatus;
    if (isComplete) {
      status = 'completed';
    } else if (terminalEvent || currentAssigned) {
      status = 'pending';
    } else {
      status = 'current';
      currentAssigned = true;
    }

    return {
      key,
      date: toClientTimelineDate(milestoneDates[index]),
      status,
    };
  }) as PrismClientEventTimeline['milestones'];

  return { eventId: source.id, milestones };
}

type ClientOcularVisitRecord = Pick<
  OpsOcularVisitRequest,
  'eventId' | 'status' | 'clientNote' | 'requestedAt' | 'scheduledAt'
>;

function ocularVisitStatus(status: string): PrismOcularVisitStatus {
  if (status === 'requested' || status === 'scheduled' || status === 'completed' || status === 'waived') {
    return status;
  }
  throw new InternalServerErrorException('Stored ocular visit status is invalid');
}

function mapClientOcularVisit(request: ClientOcularVisitRecord): PrismClientOcularVisit {
  return {
    eventId: request.eventId,
    status: ocularVisitStatus(request.status),
    clientNote: request.clientNote,
    requestedAt: request.requestedAt?.toISOString() ?? null,
    scheduledAt: request.scheduledAt?.toISOString() ?? null,
  };
}

function mapPmcmOcularVisit(request: OpsOcularVisitRequest): PrismPmcmOcularVisit {
  return {
    ...mapClientOcularVisit(request),
    completedAt: request.completedAt?.toISOString() ?? null,
    waiverReason: request.waiverReason,
    waivedAt: request.waivedAt?.toISOString() ?? null,
    waivedBy: request.waivedBy,
  };
}

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
      counts,
    ] = await this.queries.defenseReadiness(eventId);
    if (!event) throw new NotFoundException('Event not found');

    const [
      coordinatorAssignments,
      guestCheckIns,
      guestFeedback,
      closeGatesResult,
      staffingAssignmentCount,
      pendingStaffingAssignmentCount,
      guestAttendanceCount,
      pendingFeedbackCount,
    ] = await Promise.all([
      this.staffingReader.listAssignmentsForEvent(eventId),
      this.guestReader.listCheckInsForEvent(eventId),
      this.guestReader.listFeedbackForEvent(eventId),
      this.closureReadinessReader.closeGates(eventId),
      this.staffingReader.countAssignmentsForEvent(eventId),
      this.staffingReader.countPendingAssignmentsForEvent(eventId),
      this.guestReader.countCheckInsForEvent(eventId),
      this.guestReader.countPendingFeedbackForEvent(eventId),
    ]);
    const closeGates = closeGatesResult as { ready: boolean; missingKeys: string[] };
    const floorPlanDrafts = event.floorPlanDrafts ?? [];
    const input = {
      eventName: event.eventName,
      archived: event.archived,
      briefingsCount: counts?.briefings ?? briefings.length,
      floorPlanDraftsCount: counts?.floorPlanDrafts ?? floorPlanDrafts.length,
      approvedFloorplan: counts ? counts.approvedFloorplan > 0 : Boolean(floorPlanDrafts.find((draft: { status: string }) => draft.status === 'approved')),
      quoteRequestsCount: counts?.quoteRequests ?? quoteRequests.length,
      selectedSupplierCount:
        counts?.selectedSupplierQuotes ??
        countMatching(supplierQuotes, (quote: { status: string }) => ['selected', 'locked'].includes(quote.status)),
      coordinatorAssignmentsCount: staffingAssignmentCount ?? coordinatorAssignments.length,
      pendingCoordinatorCount:
        pendingStaffingAssignmentCount ??
        countMatching(coordinatorAssignments, (assignment: { status: string }) => ['pending', 'pending_acknowledgement'].includes(assignment.status)),
      billingStatementsCount: counts?.billingStatements ?? billingStatements.length,
      unpaidMilestoneCount:
        counts?.unpaidPaymentMilestones ??
        countMatching(
          paymentMilestones,
          (milestone: { status: string; remainingBalance: number }) => milestone.status !== 'paid' || milestone.remainingBalance > 0,
        ),
      openTaskCount:
        counts?.eventDayTasks ?? countMatching(eventDayTasks, (task: { status: string }) => !['done', 'cancelled'].includes(task.status)),
      openIssueCount:
        counts?.urgentIssues ?? countMatching(urgentIssues, (issue: { status: string }) => !['resolved', 'closed'].includes(issue.status)),
      guestCheckInsCount: guestAttendanceCount,
      pendingFeedbackCount,
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
    @Inject(FLOORPLAN_READER) private readonly floorplanReader: FloorplanReader,
    @Inject(EVENT_CLIENT_FLOORPLAN_ACCESS_READER)
    private readonly eventClientFloorplanAccessReader: EventClientFloorplanAccessReader,
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
        clientEventTimelines: [],
        ocularVisits: [],
      };
    }

    const [
      [documents, briefings, floorPlanDrafts, billingStatements, paymentMilestones, paymentRecords, auditLogs, ocularVisits],
      timelineSources,
    ] = await Promise.all([
      this.queries.clientWorkspaceForEvents(eventIds),
      this.queries.clientEventTimelineForEvents(eventIds),
    ]);
    const timelineSourceByEventId = new Map(timelineSources.map((source) => [source.id, source]));
    const clientEventTimelines = visibleEvents.map((event) =>
      mapClientEventTimeline(
        timelineSourceByEventId.get(event.id) ?? {
          id: event.id,
          eventDate: event.eventDate,
          status: event.status,
          archived: event.archived,
          proposalClientStatus: event.proposalClientStatus,
          proposalReviewedAt: event.proposalReviewedAt,
          inquiry: null,
          floorPlanDrafts: [],
          paymentMilestones: [],
        },
      ),
    );

    return {
      users: [],
      inquiries: [],
      events: visibleEvents.map((event) => mappers.mapEvent(event)),
      clientEventTimelines,
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
      ocularVisits: ocularVisits.map(mapClientOcularVisit),
    };
  }

  async clientSharedFloorplans(actor: ResolvedEventOpsActor): Promise<PrismClientSharedFloorplanEntry[]> {
    await this.policy.requireActorRole(actor, [OpsUserRole.Client], 'client shared floorplans');
    if (!actor.id || !actor.verified) {
      await this.policy.recordForbiddenAccess(actor, 'client shared floorplans');
      throw new ForbiddenException('A verified Client session is required for shared floorplans');
    }

    const sharedEvents = await this.eventClientFloorplanAccessReader.listActiveSharedEvents(actor.id);
    if (sharedEvents.length === 0) return [];

    const sharedEventById = new Map(sharedEvents.map((event) => [event.eventId, event]));
    const entries = await this.floorplanReader.listClientSnapshotEntries(sharedEvents.map((event) => event.eventId));
    const entriesByEventId = new Map<string, typeof entries>();
    for (const entry of entries) {
      if (!sharedEventById.has(entry.eventId)) continue;
      const eventEntries = entriesByEventId.get(entry.eventId) ?? [];
      eventEntries.push(entry);
      entriesByEventId.set(entry.eventId, eventEntries);
    }

    return sharedEvents.flatMap((event) =>
      (entriesByEventId.get(event.eventId) ?? []).map((entry) => ({ ...event, ...entry })),
    );
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

  async pmcmCommandInbox(actor: ResolvedEventOpsActor, page = 0) {
    await this.policy.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'PMCM command inbox');

    const pageData = await this.queries.pmcmCommandInbox(page);
    const eventIds = [...new Set([
      ...pageData.events.map((event) => event.id),
      ...pageData.paymentMilestones.map((row) => row.eventId),
      ...pageData.quoteRequests.map((row) => row.eventId),
      ...pageData.coordinatorAssignments.map((row) => row.eventId),
      ...pageData.floorPlanDrafts.map((row) => row.eventId),
      ...pageData.postEventDocuments.map((row) => row.eventId),
    ])];
    const [events, summary] = await Promise.all([
      this.queries.pmcmCommandInboxEventRefs(eventIds),
      this.queries.pmcmCommandInboxSummary(),
    ]);
    const items = collectPmcmCommandInboxItems({
      inquiries: pageData.inquiries,
      events,
      paymentMilestones: pageData.paymentMilestones,
      quoteRequests: pageData.quoteRequests,
      coordinatorAssignments: pageData.coordinatorAssignments,
      floorPlanDrafts: pageData.floorPlanDrafts,
      postEventDocuments: pageData.postEventDocuments,
    });

    return {
      generatedAt: new Date().toISOString(),
      summary,
      page: { index: page, size: MAX_PMCM_COMMAND_INBOX_PAGE_SIZE, hasMore: pageData.hasMore },
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
      ocularVisit,
    ] = await this.queries.pmcmEventWorkspace(eventId);
    const [coordinatorAssignments, coordinatorCoverage, guestCheckIns, guestFeedback, registrationPlatform, guestAttendanceCount] = await Promise.all([
      this.staffingReader.listAssignmentsForEvent(eventId),
      this.staffingReader.listCoverageForEvent?.(eventId) ?? Promise.resolve([]),
      this.guestReader.listCheckInsForEvent(eventId),
      this.guestReader.listFeedbackForEvent(eventId),
      this.registrationPlatformReader?.getByEventId(eventId) ?? Promise.resolve(null),
      this.guestReader.countCheckInsForEvent(eventId),
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
      ocularVisit: ocularVisit ? mapPmcmOcularVisit(ocularVisit) : null,
      guestAttendanceCount,
      guestCheckIns: guestCheckIns.map((checkIn) => this.guestReader.mapGuestCheckIn(checkIn)),
      guestFeedback: guestFeedback.map((feedback) => this.guestReader.mapGuestFeedback(feedback)),
    };
  }

  async coordinatorReliabilityHistory(actor: ResolvedEventOpsActor, coordinatorId: string) {
    await this.policy.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'coordinator reliability history');
    const notes = await this.queries.coordinatorReliabilityHistory(coordinatorId);
    return notes.map((note) => ({
      id: note.id,
      eventId: note.eventId,
      eventName: note.event?.eventName ?? null,
      eventDate: note.event?.eventDate ? note.event.eventDate.toISOString().slice(0, 10) : null,
      assignmentId: note.assignmentId,
      assignmentRole: note.assignment?.role ?? null,
      note: note.note,
      severity: note.severity,
      createdAt: note.createdAt.toISOString(),
    }));
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
