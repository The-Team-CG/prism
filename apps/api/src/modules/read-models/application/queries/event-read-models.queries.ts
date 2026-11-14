import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  OpsDocument,
  OpsEvent,
  OpsSupplier,
  OpsSupplierCategory,
  OpsSupplierCertification,
  OpsSupplierReliabilityNote,
  OpsSupplierReview,
} from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { AuditCategory, CoordinatorAssignmentStatus, OpsUserRole } from '@prism/kernel/event-core';
import { canReadDocumentRow, requirementVisibilityFor, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { PRISM_PMCM_COMMAND_INBOX_MAX_PAGE } from '@prism/types';
import { findFloorPlanDraftsByEvent, withFloorPlanDrafts } from '@prism/contexts/floorplan/event-drafts';
import { CLIENT_CHANGE_REQUEST_SELECT } from '@prism/contexts/event-lifecycle';

type SupplierEventReference = Pick<OpsEvent, 'id' | 'eventName' | 'eventDate' | 'clientName'>;

const SUPPLIER_READINESS_INCLUDE = {
  contractVersions: {
    select: { reviewStatus: true, reviewReason: true, reviewedAt: true },
    orderBy: { version: 'desc' },
    take: 1,
  },
  schedule: {
    select: {
      ingressAt: true, egressAt: true, location: true, status: true, revision: true,
      acknowledgedRevision: true, acknowledgedAt: true, changeRequestNote: true, changeRequestedAt: true,
    },
  },
} satisfies Prisma.OpsSupplierQuoteRequestInclude;
type SupplierProfileBase = OpsSupplier & {
  category: OpsSupplierCategory;
  reviews: OpsSupplierReview[];
  reliabilityNotes: OpsSupplierReliabilityNote[];
  certifications: OpsSupplierCertification[];
};
type SupplierWithProfile = Omit<SupplierProfileBase, 'reviews' | 'reliabilityNotes'> & {
  reviews: Array<OpsSupplierReview & { event: SupplierEventReference | null }>;
  reliabilityNotes: Array<OpsSupplierReliabilityNote & { event: Pick<OpsEvent, 'id' | 'eventName'> | null }>;
};

export const MAX_VISIBLE_EVENTS = 500;
export const MAX_EVENT_FLOORPLAN_DRAFTS = 100;
export const MAX_LIVE_OPS_TASKS = 500;
export const MAX_LIVE_OPS_ISSUES = 500;
export const MAX_LIVE_OPS_SUPPLIER_REQUESTS = 500;
export const MAX_LIVE_OPS_LOGS = 50;
export const MAX_EVENT_SCHEDULE_DAYS = 100;
export const MAX_EVENT_SCHEDULE_SEGMENTS = 200;
export const MAX_TASK_REASSIGNMENT_REQUESTS = 100;
export const MAX_EVENT_HANDOFFS = 200;
export const DECISION_LOG_SOURCE_PAGE_SIZE = 200;
export const DECISION_LOG_AUDIT_PAGE_SIZE = 500;
/** Audit `affectedType`s that attribute (actor name and role) a decision-log source row. */
export const DECISION_LOG_AUDIT_AFFECTED_TYPES = [
  'event',
  'event_decision',
  'freeze_exception',
  'addendum',
  'compliance_check',
  'compliance_risk',
  'ocular_visit_request',
  'billing_correction',
  'additional_billing',
  'billing_source',
  'event_task_reassignment',
] as const;
export const MAX_RUN_SHEET_SUPPLIER_SCHEDULES = 500;
export const MAX_BILLING_ROWS = 500;

/** A billing statement, its milestones and payments reach the client only after PMCM sends the statement. */
const CLIENT_VISIBLE_STATEMENT = { sentAt: { not: null } } satisfies Prisma.OpsBillingStatementWhereInput;
const CLIENT_VISIBLE_MILESTONE = {
  OR: [{ statementId: null }, { statement: { is: { sentAt: { not: null } } } }],
} satisfies Prisma.OpsPaymentMilestoneWhereInput;
export const MAX_CLIENT_WORKSPACE_ROWS = 500;
export const MAX_CLIENT_ARCHIVED_EVENTS = 100;
export const MAX_CLIENT_ACTION_CENTER_ROWS = 500;
export const MAX_SUPPLIER_WORKSPACE_ROWS = 500;
export const MAX_SUPPLIER_EVENTS = 500;
export const MAX_PMCM_COMMAND_INBOX_PAGE_SIZE = 10;
export const MAX_PMCM_EVENT_WORKSPACE_ROWS = 500;
export const MAX_PMCM_DASHBOARD_ROWS = 500;
export const MAX_ACTIVE_COORDINATORS = 500;
export const MAX_ACTIVE_SUPPLIERS = 500;
export const MAX_SUPPLIER_HISTORY_ROWS = 100;
export const MAX_COORDINATOR_RELIABILITY_HISTORY_ROWS = 50;
export const MAX_SUPPLIER_CERTIFICATIONS = 100;
export const MAX_AUDIT_LOGS = 100;
export const MAX_NOTIFICATION_LOGS = 100;
export const EVENT_READ_PAGE_SIZE = 100;

type EventReadCursor = { eventDate: Date; id: string };

function encodeEventCursor(event: Pick<OpsEvent, 'eventDate' | 'id'>) {
  return Buffer.from(JSON.stringify([event.eventDate.toISOString(), event.id]), 'utf8').toString('base64url');
}

function decodeEventCursor(cursor?: string): EventReadCursor | undefined {
  if (cursor === undefined) return undefined;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Array.isArray(decoded) || typeof decoded[0] !== 'string' || typeof decoded[1] !== 'string' || !decoded[1]) {
      throw new Error('Invalid event cursor');
    }
    const eventDate = new Date(decoded[0]);
    if (Number.isNaN(eventDate.getTime())) throw new Error('Invalid event cursor');
    return { eventDate, id: decoded[1] };
  } catch {
    throw new BadRequestException('Invalid event cursor');
  }
}

function visibleEventsWhere(actor: ResolvedEventOpsActor, assignedEventIds: string[] = []): Prisma.OpsEventWhereInput {
  if (actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System) return { archived: false };
  if (actor.role === OpsUserRole.Client) return clientVisibleEventsWhere(actor);
  if (actor.role === OpsUserRole.Supplier) return assignedEventsWhere(Boolean(actor.supplierId || actor.email?.trim()), assignedEventIds);
  if (actor.role === OpsUserRole.Coordinator) {
    return assignedEventsWhere(Boolean(actor.coordinatorId || actor.id || actor.email?.trim()), assignedEventIds);
  }
  return { id: { in: [] } };
}

function assignedEventsWhere(hasIdentity: boolean, assignedEventIds: string[]): Prisma.OpsEventWhereInput {
  return hasIdentity ? { archived: false, id: { in: assignedEventIds } } : { id: { in: [] } };
}

/** Clients see their own unlocked events; archived history is a separate read-only list. */
function clientVisibleEventsWhere(actor: ResolvedEventOpsActor, archived = false): Prisma.OpsEventWhereInput {
  if (actor.email?.trim()) {
    return {
      archived,
      clientPortalStatus: 'unlocked',
      inquiry: {
        is: { email: { equals: actor.email.trim(), mode: 'insensitive' } },
      },
    };
  }
  if (actor.verified) return { id: { in: [] } };
  if (actor.clientName?.trim()) {
    return {
      archived,
      clientPortalStatus: 'unlocked',
      clientName: { equals: actor.clientName.trim(), mode: 'insensitive' },
    };
  }
  return { id: { in: [] } };
}

type DefenseReadModelCounts = {
  briefings: number;
  floorPlanDrafts: number;
  approvedFloorplan: number;
  quoteRequests: number;
  selectedSupplierRequests: number;
  eventDayTasks: number;
  urgentIssues: number;
  billingStatements: number;
  paymentMilestones: number;
  unpaidPaymentMilestones: number;
};

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestamp(value: Date) {
  return value.toISOString();
}

async function readAllRowsById<T extends { id: string }>(
  pageSize: number,
  readPage: (afterId?: string) => Promise<T[]>,
) {
  const rows: T[] = [];
  let afterId: string | undefined;
  while (true) {
    const page = await readPage(afterId);
    rows.push(...page);
    if (page.length < pageSize) return rows;
    const nextId = page[page.length - 1]?.id;
    if (!nextId || nextId === afterId) throw new Error('Read pagination failed to advance');
    afterId = nextId;
  }
}

function sortByDate<T extends { id: string }>(rows: T[], dateOf: (row: T) => Date, direction: 'asc' | 'desc') {
  const sign = direction === 'asc' ? 1 : -1;
  return rows.sort((left, right) => {
    const date = (dateOf(left).getTime() - dateOf(right).getTime()) * sign;
    return date || left.id.localeCompare(right.id) * sign;
  });
}

/** Upload rows read to tell whether a waiting supplier file is still its supplier's newest. */
const SUPERSEDED_SUPPLIER_FILE_SCAN = 1000;

@Injectable()
export class EventReadModelQueries {
  constructor(private readonly prisma: PrismaService) {}

  // Query budget: actor scope and keyset are applied in Postgres before each bounded page.
  async visibleEvents(actor: ResolvedEventOpsActor, cursor?: string) {
    const assignedEventIds = await this.assignedEventIds(actor);
    const where = visibleEventsWhere(actor, assignedEventIds);
    const decodedCursor = decodeEventCursor(cursor);
    const pageWhere: Prisma.OpsEventWhereInput = decodedCursor
      ? {
          AND: [
            where,
            {
              OR: [
                { eventDate: { gt: decodedCursor.eventDate } },
                {
                  eventDate: decodedCursor.eventDate,
                  id: { gt: decodedCursor.id },
                },
              ],
            },
          ],
        }
      : where;
    const [rows, totalCount] = await Promise.all([
      this.prisma.opsEvent.findMany({
        where: pageWhere,
        include: {
          inquiry: { select: { email: true } },
        },
        orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
        take: EVENT_READ_PAGE_SIZE + 1,
      }),
      this.prisma.opsEvent.count({ where }),
    ]);
    const hasMore = rows.length > EVENT_READ_PAGE_SIZE;
    const items = hasMore ? rows.slice(0, EVENT_READ_PAGE_SIZE) : rows;
    const draftsByEvent = await findFloorPlanDraftsByEvent(
      this.prisma,
      items.map((event) => event.id),
      { perEventLimit: MAX_EVENT_FLOORPLAN_DRAFTS },
    );
    const eventsWithDrafts = withFloorPlanDrafts(items, draftsByEvent);
    return {
      items: eventsWithDrafts,
      pagination: {
        nextCursor: hasMore && items.length ? encodeEventCursor(items[items.length - 1]) : null,
        hasMore,
        totalCount,
      },
    };
  }

  /** The client's own archived events, newest first, for read-only history and testimonial consent withdrawal. */
  async archivedClientEvents(actor: ResolvedEventOpsActor) {
    if (actor.role !== OpsUserRole.Client) return [];
    const rows = await this.prisma.opsEvent.findMany({
      where: clientVisibleEventsWhere(actor, true),
      include: { inquiry: { select: { email: true } } },
      orderBy: [{ eventDate: 'desc' }, { id: 'desc' }],
      take: MAX_CLIENT_ARCHIVED_EVENTS,
    });
    return withFloorPlanDrafts(rows, new Map());
  }

  private async assignedEventIds(actor: ResolvedEventOpsActor) {
    if (actor.role === OpsUserRole.Supplier) {
      const supplierId = actor.supplierId ?? (actor.email?.trim()
        ? (await this.prisma.opsSupplier.findFirst({
            where: { email: { equals: actor.email.trim(), mode: 'insensitive' } },
            select: { id: true },
          }))?.id
        : undefined);
      if (!supplierId) return [];
      const rows = await this.prisma.opsSupplierQuoteRequest.findMany({
        where: { supplierId },
        select: { eventId: true },
      });
      return [...new Set(rows.map((row) => row.eventId))];
    }
    if (actor.role === OpsUserRole.Coordinator) {
      const coordinator = await this.prisma.opsCoordinator.findFirst({
        where: {
          active: true,
          ...(actor.coordinatorId ? { id: actor.coordinatorId } : actor.id ? { userId: actor.id } : actor.email?.trim()
            ? { email: { equals: actor.email.trim(), mode: 'insensitive' } }
            : { id: { in: [] } }),
        },
        select: { id: true },
      });
      if (!coordinator) return [];
      const rows = await this.prisma.opsCoordinatorAssignment.findMany({
        where: {
          coordinatorId: coordinator.id,
          status: { notIn: [CoordinatorAssignmentStatus.Cancelled, CoordinatorAssignmentStatus.Replaced, CoordinatorAssignmentStatus.Declined] },
        },
        select: { eventId: true },
      });
      return [...new Set(rows.map((row) => row.eventId))];
    }
    return [];
  }

  // Query budget: one query for the dates of a coordinator's open (not archived) assigned events.
  coordinatorFocusCandidates(eventIds: string[]) {
    return this.prisma.opsEvent.findMany({ where: { id: { in: eventIds }, archived: false }, select: { id: true, eventDate: true } });
  }

  // Query budget: one selected-event query, for reads that load the event's drafts in their own batch.
  eventRow(eventId: string) {
    return this.prisma.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: { select: { email: true } } } });
  }

  // Query budget: one selected-event query plus one bounded Floorplan-owner draft query.
  async eventWithDrafts(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({
      where: { id: eventId },
      include: {
        inquiry: { select: { email: true } },
      },
    });
    if (!event) return null;
    const floorPlanDrafts = await this.prisma.opsFloorPlanDraft.findMany({
      where: { eventId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: MAX_EVENT_FLOORPLAN_DRAFTS,
    });
    return { ...event, floorPlanDrafts };
  }

  // Query budget: one selected event query plus five event-day/readiness queries, no per-row Prisma loop.
  liveOpsForEvent(eventId: string) {
    return Promise.all([
      this.eventWithDrafts(eventId),
      this.prisma.opsEventDayTask.findMany({ where: { eventId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_LIVE_OPS_TASKS }),
      this.prisma.opsUrgentIssue.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_LIVE_OPS_ISSUES }),
      this.prisma.opsSupplierQuoteRequest.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_LIVE_OPS_SUPPLIER_REQUESTS }),
      this.prisma.opsEventDayLog.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_LIVE_OPS_LOGS }),
      this.prisma.opsBriefing.findFirst({ where: { eventId }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }] }),
    ]).then(([event, tasks, urgentIssues, supplierRequests, eventDayLogs, briefing]) => ({
      event,
      tasks,
      urgentIssues,
      supplierRequests,
      eventDayLogs,
      briefing,
    }));
  }

  scheduleForEvent(eventId: string) {
    return this.prisma.opsEventScheduleDay.findMany({
      where: { eventId },
      include: { segments: { orderBy: [{ sequence: 'asc' }, { id: 'asc' }], take: MAX_EVENT_SCHEDULE_SEGMENTS } },
      orderBy: [{ dayDate: 'asc' }, { id: 'asc' }],
      take: MAX_EVENT_SCHEDULE_DAYS,
    });
  }

  handoffsForEvent(eventId: string) {
    return this.prisma.opsEventHandoff.findMany({
      where: { eventId },
      orderBy: [{ handedOffAt: 'desc' }, { id: 'desc' }],
      take: MAX_EVENT_HANDOFFS,
    });
  }

  // Run sheet supplier windows (FL-026). Selects timing fields only; supplier schedule notes stay private.
  supplierSchedulesForEvent(eventId: string) {
    return this.prisma.opsSupplierSchedule.findMany({
      where: { eventId },
      select: { id: true, requestId: true, ingressAt: true, egressAt: true, location: true, status: true },
      orderBy: [{ ingressAt: 'asc' }, { id: 'asc' }],
      take: MAX_RUN_SHEET_SUPPLIER_SCHEDULES,
    });
  }

  activeOperatorForCoordinator(eventId: string, coordinatorId: string) {
    return this.prisma.opsEventOperatorDesignation.findFirst({
      where: { eventId, coordinatorId, revokedAt: null },
      select: { id: true },
    });
  }

  taskReassignmentRequests(eventId: string) {
    return this.prisma.opsEventTaskReassignmentRequest.findMany({
      where: { eventId },
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
      take: MAX_TASK_REASSIGNMENT_REQUESTS,
    });
  }

  // Query budget: one selected event query plus twelve keyset-paged decision-source queries (FL-019).
  // Reasons come from source rows; the audit query returns attribution columns only, never metadata.
  async decisionLogSourcesForEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        inquiryId: true,
        clientName: true,
        clientPortalStatus: true,
        archivedAt: true,
        archiveOverrideReason: true,
        archiveOverrideBy: true,
        updatedAt: true,
      },
    });
    if (!event) return null;
    const [
      eventDecisions,
      freezeExceptions,
      addenda,
      complianceOverrides,
      riskChanges,
      ocularWaivers,
      billingCorrections,
      billingWaivers,
      paymentTermsOverrides,
      reassignments,
      inquiryMerges,
      auditAttributions,
    ] = await Promise.all([
      readAllRowsById(DECISION_LOG_SOURCE_PAGE_SIZE, (afterId) =>
        this.prisma.opsEventDecision.findMany({
          where: { eventId, ...(afterId ? { id: { gt: afterId } } : {}) },
          select: { id: true, decision: true, reason: true, actorName: true, actorRole: true, decidedAt: true },
          orderBy: { id: 'asc' },
          take: DECISION_LOG_SOURCE_PAGE_SIZE,
        }),
      ),
      readAllRowsById(DECISION_LOG_SOURCE_PAGE_SIZE, (afterId) =>
        this.prisma.opsEventFreezeException.findMany({
          where: { eventId, ...(afterId ? { id: { gt: afterId } } : {}) },
          select: { id: true, requestedChange: true, reason: true, status: true, decidedBy: true, decisionNote: true, requestedAt: true, decidedAt: true },
          orderBy: { id: 'asc' },
          take: DECISION_LOG_SOURCE_PAGE_SIZE,
        }),
      ),
      readAllRowsById(DECISION_LOG_SOURCE_PAGE_SIZE, (afterId) =>
        this.prisma.opsAddendum.findMany({
          where: { eventId, ...(afterId ? { id: { gt: afterId } } : {}) },
          select: { id: true, versionNumber: true, title: true, summary: true, status: true, financialDelta: true, issuedAt: true, effectiveAt: true, withdrawnAt: true, withdrawalReason: true, _count: { select: { impacts: true } } },
          orderBy: { id: 'asc' },
          take: DECISION_LOG_SOURCE_PAGE_SIZE,
        }),
      ),
      readAllRowsById(DECISION_LOG_SOURCE_PAGE_SIZE, (afterId) =>
        this.prisma.opsComplianceCheck.findMany({
          where: { eventId, overrideAt: { not: null }, ...(afterId ? { id: { gt: afterId } } : {}) },
          select: { id: true, title: true, status: true, overrideReason: true, overrideAt: true, overrideBy: true },
          orderBy: { id: 'asc' },
          take: DECISION_LOG_SOURCE_PAGE_SIZE,
        }),
      ),
      // Engine-raised history rows are automated evaluations, not management decisions.
      readAllRowsById(DECISION_LOG_SOURCE_PAGE_SIZE, (afterId) =>
        this.prisma.opsComplianceRiskHistory.findMany({
          where: { risk: { eventId }, action: { in: ['create', 'update'] }, ...(afterId ? { id: { gt: afterId } } : {}) },
          select: { id: true, riskId: true, action: true, status: true, severity: true, actor: true, reason: true, createdAt: true, risk: { select: { title: true } } },
          orderBy: { id: 'asc' },
          take: DECISION_LOG_SOURCE_PAGE_SIZE,
        }),
      ),
      readAllRowsById(DECISION_LOG_SOURCE_PAGE_SIZE, (afterId) =>
        this.prisma.opsOcularVisitRequest.findMany({
          where: { eventId, waivedAt: { not: null }, ...(afterId ? { id: { gt: afterId } } : {}) },
          select: { id: true, status: true, waiverReason: true, waivedAt: true, waivedBy: true },
          orderBy: { id: 'asc' },
          take: DECISION_LOG_SOURCE_PAGE_SIZE,
        }),
      ),
      readAllRowsById(DECISION_LOG_SOURCE_PAGE_SIZE, (afterId) =>
        this.prisma.opsBillingCorrection.findMany({
          where: { eventId, ...(afterId ? { id: { gt: afterId } } : {}) },
          select: { id: true, statementId: true, reason: true, status: true, correctedTotalAmount: true, resolvedBy: true, resolutionNotes: true, createdAt: true, resolvedAt: true },
          orderBy: { id: 'asc' },
          take: DECISION_LOG_SOURCE_PAGE_SIZE,
        }),
      ),
      readAllRowsById(DECISION_LOG_SOURCE_PAGE_SIZE, (afterId) =>
        this.prisma.opsAdditionalBilling.findMany({
          where: { eventId, waivedAt: { not: null }, ...(afterId ? { id: { gt: afterId } } : {}) },
          select: { id: true, description: true, amount: true, status: true, waiverReason: true, waivedBy: true, waivedAt: true },
          orderBy: { id: 'asc' },
          take: DECISION_LOG_SOURCE_PAGE_SIZE,
        }),
      ),
      readAllRowsById(DECISION_LOG_SOURCE_PAGE_SIZE, (afterId) =>
        this.prisma.opsBillingSource.findMany({
          where: { eventId, paymentTermsPolicyState: 'repeat_client_override', ...(afterId ? { id: { gt: afterId } } : {}) },
          select: { id: true, sourceLabel: true, status: true, paymentTermsOverrideReason: true, paymentTermsApprovedBy: true, approvedAt: true, createdAt: true },
          orderBy: { id: 'asc' },
          take: DECISION_LOG_SOURCE_PAGE_SIZE,
        }),
      ),
      readAllRowsById(DECISION_LOG_SOURCE_PAGE_SIZE, (afterId) =>
        this.prisma.opsEventTaskReassignmentRequest.findMany({
          where: { eventId, ...(afterId ? { id: { gt: afterId } } : {}) },
          select: {
            id: true, status: true, reason: true, decisionReason: true, decidedBy: true, requestedAt: true, decidedAt: true,
            fromOwnerRole: true, fromOwnerName: true, toOwnerRole: true, toOwnerName: true,
            task: { select: { title: true } },
          },
          orderBy: { id: 'asc' },
          take: DECISION_LOG_SOURCE_PAGE_SIZE,
        }),
      ),
      readAllRowsById(DECISION_LOG_SOURCE_PAGE_SIZE, (afterId) =>
        this.prisma.opsInquiryMerge.findMany({
          where: { OR: [{ primaryInquiryId: event.inquiryId }, { mergedInquiryId: event.inquiryId }], ...(afterId ? { id: { gt: afterId } } : {}) },
          select: { id: true, primaryInquiryId: true, mergedInquiryId: true, matchBasis: true, reason: true, actorName: true, actorRole: true, createdAt: true },
          orderBy: { id: 'asc' },
          take: DECISION_LOG_SOURCE_PAGE_SIZE,
        }),
      ),
      readAllRowsById(DECISION_LOG_AUDIT_PAGE_SIZE, (afterId) =>
        this.prisma.opsAuditLog.findMany({
          where: { eventId, affectedType: { in: [...DECISION_LOG_AUDIT_AFFECTED_TYPES] }, category: { not: AuditCategory.Access }, ...(afterId ? { id: { gt: afterId } } : {}) },
          select: { id: true, actor: true, actorRole: true, affectedType: true, affectedId: true, createdAt: true },
          orderBy: { id: 'asc' },
          take: DECISION_LOG_AUDIT_PAGE_SIZE,
        }),
      ),
    ]);
    return {
      event,
      eventDecisions,
      freezeExceptions,
      addenda,
      complianceOverrides,
      riskChanges,
      ocularWaivers,
      billingCorrections,
      billingWaivers,
      paymentTermsOverrides,
      reassignments,
      inquiryMerges,
      auditAttributions,
    };
  }

  // Query budget: one selected event query plus seven event-scoped readiness queries, no per-row Prisma loop.
  // Query budget: the event row and ten counts in one parallel wave. Readiness needs counts, never rows.
  defenseReadiness(eventId: string) {
    return Promise.all([
      this.prisma.opsEvent.findUnique({ where: { id: eventId } }),
      this.defenseReadinessCounts(eventId),
    ]);
  }

  private defenseReadinessCounts(eventId: string): Promise<DefenseReadModelCounts> {
    return Promise.all([
      this.prisma.opsBriefing.count({ where: { eventId } }),
      this.prisma.opsFloorPlanDraft.count({ where: { eventId } }),
      this.prisma.opsFloorPlanDraft.count({ where: { eventId, status: 'approved' } }),
      this.prisma.opsSupplierQuoteRequest.count({ where: { eventId } }),
      this.prisma.opsSupplierQuoteRequest.count({ where: { eventId, status: 'selected' } }),
      this.prisma.opsEventDayTask.count({ where: { eventId, status: { notIn: ['done', 'cancelled'] } } }),
      this.prisma.opsUrgentIssue.count({ where: { eventId, status: { notIn: ['resolved', 'closed'] } } }),
      this.prisma.opsBillingStatement.count({ where: { eventId } }),
      this.prisma.opsPaymentMilestone.count({ where: { eventId } }),
      this.prisma.opsPaymentMilestone.count({ where: { eventId, OR: [{ status: { not: 'paid' } }, { remainingBalance: { gt: 0 } }] } }),
    ]).then(([briefings, floorPlanDrafts, approvedFloorplan, quoteRequests, selectedSupplierRequests, eventDayTasks, urgentIssues, billingStatements, paymentMilestones, unpaidPaymentMilestones]) => ({
      briefings,
      floorPlanDrafts,
      approvedFloorplan,
      quoteRequests,
      selectedSupplierRequests,
      eventDayTasks,
      urgentIssues,
      billingStatements,
      paymentMilestones,
      unpaidPaymentMilestones,
    }));
  }

  // Query budget: four finance queries for a bounded actor-visible event id set, no per-row Prisma loop.
  billingForEvents(eventIds: string[], includeInternalCosts: boolean, clientView = false) {
    return Promise.all([
      includeInternalCosts
        ? this.prisma.opsBillingSource.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_BILLING_ROWS })
        : Promise.resolve([]),
      this.prisma.opsBillingStatement.findMany({ where: { eventId: { in: eventIds }, ...(clientView ? CLIENT_VISIBLE_STATEMENT : {}) }, orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }], take: MAX_BILLING_ROWS }),
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId: { in: eventIds }, ...(clientView ? CLIENT_VISIBLE_MILESTONE : {}) }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_BILLING_ROWS }),
      this.prisma.opsPaymentRecord.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }], take: MAX_BILLING_ROWS }),
    ]);
  }

  // Query budget: three PMCM-only adjustment queries (corrections, disputes, additional billing) for visible event ids.
  // Callers must gate on the internal-cost policy; clients never receive these rows.
  billingAdjustmentsForEvents(eventIds: string[]) {
    return Promise.all([
      this.prisma.opsBillingCorrection.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_BILLING_ROWS }),
      this.prisma.opsBillingDispute.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_BILLING_ROWS }),
      this.prisma.opsAdditionalBilling.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_BILLING_ROWS }),
    ]);
  }

  // Query budget: one bounded client milestone projection for visible event ids.
  // Floorplan drafts and payment milestones hold only the event id, so each is read from its owner table
  // (one row per event) and composed here instead of through a cross-domain Prisma relation.
  async clientEventTimelineForEvents(eventIds: string[]) {
    const events = await this.prisma.opsEvent.findMany({
      where: { id: { in: eventIds } },
      select: {
        id: true,
        eventDate: true,
        status: true,
        archived: true,
        proposalClientStatus: true,
        proposalReviewedAt: true,
        inquiry: { select: { conformeSignedAt: true } },
      },
      orderBy: [{ id: 'asc' }],
      take: MAX_VISIBLE_EVENTS,
    });
    if (events.length === 0) return [];
    const visibleIds = events.map((event) => event.id);
    const [drafts, milestones] = await Promise.all([
      this.prisma.opsFloorPlanDraft.findMany({
        where: { eventId: { in: visibleIds }, status: 'approved', sourceType: { not: 'client_preference' } },
        select: { eventId: true, isActive: true, approvedAt: true },
        distinct: ['eventId'],
        orderBy: [
          { eventId: 'asc' },
          { isActive: 'desc' },
          { approvedAt: { sort: 'desc', nulls: 'last' } },
          { id: 'asc' },
        ],
        take: MAX_VISIBLE_EVENTS,
      }),
      this.prisma.opsPaymentMilestone.findMany({
        where: { eventId: { in: visibleIds }, label: { contains: 'balance', mode: 'insensitive' }, ...CLIENT_VISIBLE_MILESTONE },
        select: { eventId: true, dueDate: true, status: true, remainingBalance: true },
        distinct: ['eventId'],
        orderBy: [{ eventId: 'asc' }, { dueDate: 'asc' }, { id: 'asc' }],
        take: MAX_VISIBLE_EVENTS,
      }),
    ]);
    const draftByEvent = new Map(drafts.map(({ eventId, ...draft }) => [eventId, draft]));
    const milestoneByEvent = new Map(milestones.map(({ eventId, ...milestone }) => [eventId, milestone]));
    return events.map((event) => ({
      ...event,
      floorPlanDrafts: draftByEvent.has(event.id) ? [draftByEvent.get(event.id)!] : [],
      paymentMilestones: milestoneByEvent.has(event.id) ? [milestoneByEvent.get(event.id)!] : [],
    }));
  }

  // Each client collection is loaded through bounded keyset pages after the actor-scoped event page.
  async clientWorkspaceForEvents(eventIds: string[]) {
    const [
      documents,
      briefings,
      floorPlanDrafts,
      billingStatements,
      paymentMilestones,
      paymentRecords,
      auditLogs,
      ocularVisits,
      billingDisputes,
    ] = await Promise.all([
      readAllRowsById(MAX_CLIENT_WORKSPACE_ROWS, (afterId) =>
        this.prisma.opsDocument.findMany({ where: { eventId: { in: eventIds }, ...(afterId ? { id: { gt: afterId } } : {}) },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_WORKSPACE_ROWS }),
      ),
      readAllRowsById(MAX_CLIENT_WORKSPACE_ROWS, (afterId) =>
        this.prisma.opsBriefing.findMany({ where: { eventId: { in: eventIds }, ...(afterId ? { id: { gt: afterId } } : {}) },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_WORKSPACE_ROWS }),
      ),
      readAllRowsById(MAX_CLIENT_WORKSPACE_ROWS, (afterId) =>
        this.prisma.opsFloorPlanDraft.findMany({ where: { eventId: { in: eventIds }, ...(afterId ? { id: { gt: afterId } } : {}) },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_WORKSPACE_ROWS }),
      ),
      readAllRowsById(MAX_CLIENT_WORKSPACE_ROWS, (afterId) =>
        this.prisma.opsBillingStatement.findMany({ where: { eventId: { in: eventIds }, ...CLIENT_VISIBLE_STATEMENT, ...(afterId ? { id: { gt: afterId } } : {}) },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_WORKSPACE_ROWS }),
      ),
      readAllRowsById(MAX_CLIENT_WORKSPACE_ROWS, (afterId) =>
        this.prisma.opsPaymentMilestone.findMany({ where: { eventId: { in: eventIds }, ...CLIENT_VISIBLE_MILESTONE, ...(afterId ? { id: { gt: afterId } } : {}) },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_WORKSPACE_ROWS }),
      ),
      readAllRowsById(MAX_CLIENT_WORKSPACE_ROWS, (afterId) =>
        this.prisma.opsPaymentRecord.findMany({ where: { eventId: { in: eventIds }, ...(afterId ? { id: { gt: afterId } } : {}) },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_WORKSPACE_ROWS }),
      ),
      readAllRowsById(MAX_AUDIT_LOGS, (afterId) =>
        this.prisma.opsAuditLog.findMany({
        where: { eventId: { in: eventIds }, category: { not: AuditCategory.Access },
            ...(afterId ? { id: { gt: afterId } } : {}),
          },
          orderBy: { id: 'asc' },
        take: MAX_AUDIT_LOGS,
      }),
      ),
      this.prisma.opsOcularVisitRequest.findMany({
        where: { eventId: { in: eventIds } },
        select: { eventId: true, status: true, clientNote: true, scheduleNote: true, requestedAt: true, scheduledAt: true },
        orderBy: [{ eventId: 'asc' }],
        take: MAX_CLIENT_WORKSPACE_ROWS,
      }),
      readAllRowsById(MAX_CLIENT_WORKSPACE_ROWS, (afterId) =>
        this.prisma.opsBillingDispute.findMany({ where: { eventId: { in: eventIds }, ...(afterId ? { id: { gt: afterId } } : {}) },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_WORKSPACE_ROWS }),
      ),
    ]);
    return [
      sortByDate(documents, (row) => row.uploadedAt, 'desc'),
      sortByDate(briefings, (row) => row.submittedAt, 'desc'),
      sortByDate(floorPlanDrafts, (row) => row.updatedAt, 'desc'),
      sortByDate(billingStatements, (row) => row.generatedAt, 'desc'),
      sortByDate(paymentMilestones, (row) => row.createdAt, 'asc'),
      sortByDate(paymentRecords, (row) => row.recordedAt, 'desc'),
      sortByDate(auditLogs, (row) => row.createdAt, 'desc'),
      ocularVisits,
      sortByDate(billingDisputes, (row) => row.createdAt, 'desc'),
    ] as const;
  }

  /** Client feed is limited to client-addressed notifications for events already scoped by the caller. */
  clientNotificationsForEvents(eventIds: string[]) {
    if (eventIds.length === 0) return Promise.resolve([]);
    return this.prisma.opsNotificationLog.findMany({
      where: { eventId: { in: eventIds }, recipient: 'Client' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_NOTIFICATION_LOGS,
    });
  }
  /**
   * Document rows a client may see under the shared file policy. A row bound to a stored object follows
   * that object's list rule, including requirement narrowing; a row without one follows its type. Every
   * lookup is bounded by the batch's own rows, so nothing is truncated into a fail-open decision.
   */
  async clientReadableDocuments(actor: ResolvedEventOpsActor, documents: OpsDocument[]): Promise<OpsDocument[]> {
    if (documents.length === 0) return documents;
    const boundTypes = new Map<string, string[]>();
    for (const document of documents) {
      if (document.storageKey) boundTypes.set(document.storageKey, [...(boundTypes.get(document.storageKey) ?? []), document.type]);
    }
    const objectIds = [...boundTypes.keys()];
    const eventIds = [...new Set(documents.map((document) => document.eventId))];
    const keys = [...new Set(['signed_conforme', 'billing_statement', ...documents.map((document) => document.type)])];
    const objects = objectIds.length === 0 ? [] : await this.prisma.opsStoredObject.findMany({
      where: { id: { in: objectIds } },
      select: { id: true, usage: true, ownerRecordType: true, ownerRecordId: true, lifecycleState: true, deletedAt: true },
      take: objectIds.length,
    });
    const billingOwnerIds = objects.filter((object) => object.ownerRecordType === 'billing_statement').map((object) => object.ownerRecordId);
    // Requirement narrowing matters only for rows bound to a stored object; billing sent state only for billing rows.
    const requirements = objectIds.length === 0 ? [] : await this.prisma.opsFileRequirement.findMany({
      where: { eventId: { in: eventIds }, key: { in: keys } },
      select: { eventId: true, key: true, visibleToRoles: true },
      take: eventIds.length * keys.length,
    });
    const needsBilling = billingOwnerIds.length > 0 || documents.some((document) => document.type === 'billing_statement');
    const statements = needsBilling ? await this.prisma.opsBillingStatement.findMany({
      where: {
        sentAt: { not: null },
        OR: [{ documentId: { in: documents.map((document) => document.id) } }, { id: { in: billingOwnerIds } }],
      },
      select: { id: true, documentId: true },
      take: documents.length + billingOwnerIds.length,
    }) : [];
    const objectById = new Map(objects.map((object) => [object.id, object]));
    const visibilityByEvent = new Map<string, Record<string, string[]>>();
    for (const row of requirements) visibilityByEvent.set(row.eventId, { ...visibilityByEvent.get(row.eventId), [row.key]: row.visibleToRoles });
    const sentStatementIds = new Set(statements.map((statement) => statement.id));
    const sentDocumentIds = new Set(statements.flatMap((statement) => (statement.documentId ? [statement.documentId] : [])));
    return documents.filter((document) => {
      const object = document.storageKey ? objectById.get(document.storageKey) ?? null : null;
      const bound = object
        ? {
          object,
          requirementVisibility: requirementVisibilityFor(object, boundTypes.get(object.id) ?? [], visibilityByEvent.get(document.eventId) ?? {}),
          billingStatementSent: sentStatementIds.has(object.ownerRecordId),
        }
        : { object: null, requirementVisibility: [], billingStatementSent: sentDocumentIds.has(document.id) };
      return canReadDocumentRow(actor, { type: document.type, storageKey: document.storageKey ?? null }, bound);
    });
  }

  // Every action source is fetched in bounded keyset pages for the visible event set.
  async clientActionCenterForEvents(eventIds: string[], changeDecisionsSince = new Date(0)) {
    const [
      briefings,
      documents,
      floorPlanDrafts,
      billingStatements,
      paymentMilestones,
      paymentRecords,
      postEventDocuments,
      closeoutResponses,
      changeRequests,
      addenda,
    ] = await Promise.all([
      readAllRowsById(MAX_CLIENT_ACTION_CENTER_ROWS, (afterId) =>
        this.prisma.opsBriefing.findMany({ where: { eventId: { in: eventIds }, ...(afterId ? { id: { gt: afterId } } : {}) },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_ACTION_CENTER_ROWS }),
      ),
      readAllRowsById(MAX_CLIENT_ACTION_CENTER_ROWS, (afterId) =>
        this.prisma.opsDocument.findMany({ where: { eventId: { in: eventIds }, ...(afterId ? { id: { gt: afterId } } : {}) },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_ACTION_CENTER_ROWS }),
      ),
      readAllRowsById(MAX_CLIENT_ACTION_CENTER_ROWS, (afterId) =>
        this.prisma.opsFloorPlanDraft.findMany({ where: { eventId: { in: eventIds }, ...(afterId ? { id: { gt: afterId } } : {}) },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_ACTION_CENTER_ROWS }),
      ),
      readAllRowsById(MAX_CLIENT_ACTION_CENTER_ROWS, (afterId) =>
        this.prisma.opsBillingStatement.findMany({ where: { eventId: { in: eventIds }, ...CLIENT_VISIBLE_STATEMENT, ...(afterId ? { id: { gt: afterId } } : {}) },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_ACTION_CENTER_ROWS }),
      ),
      readAllRowsById(MAX_CLIENT_ACTION_CENTER_ROWS, (afterId) =>
        this.prisma.opsPaymentMilestone.findMany({ where: { eventId: { in: eventIds }, ...CLIENT_VISIBLE_MILESTONE, ...(afterId ? { id: { gt: afterId } } : {}) },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_ACTION_CENTER_ROWS }),
      ),
      readAllRowsById(MAX_CLIENT_ACTION_CENTER_ROWS, (afterId) =>
        this.prisma.opsPaymentRecord.findMany({ where: { eventId: { in: eventIds }, ...(afterId ? { id: { gt: afterId } } : {}) },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_ACTION_CENTER_ROWS }),
      ),
      readAllRowsById(MAX_CLIENT_ACTION_CENTER_ROWS, (afterId) =>
        this.prisma.opsPostEventDocument.findMany({ where: { eventId: { in: eventIds }, ...(afterId ? { id: { gt: afterId } } : {}) },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_ACTION_CENTER_ROWS }),
      ),
      // Feedback presence only: the response content is not part of the action center.
      readAllRowsById(MAX_CLIENT_ACTION_CENTER_ROWS, (afterId) =>
        this.prisma.opsClientCloseoutResponse.findMany({ where: { eventId: { in: eventIds }, ...(afterId ? { id: { gt: afterId } } : {}) },
          select: { id: true, eventId: true }, orderBy: { id: 'asc' }, take: MAX_CLIENT_ACTION_CENTER_ROWS }),
      ),
      // Client-safe change request columns only; PMCM reasons and decision notes are never selected.
      readAllRowsById(MAX_CLIENT_ACTION_CENTER_ROWS, (afterId) =>
        this.prisma.opsEventFreezeException.findMany({
          where: {
            eventId: { in: eventIds },
            OR: [{ status: 'pending' }, { decidedAt: { gte: changeDecisionsSince } }],
            ...(afterId ? { id: { gt: afterId } } : {}),
          },
          select: { ...CLIENT_CHANGE_REQUEST_SELECT, eventId: true },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_ACTION_CENTER_ROWS }),
      ),
      readAllRowsById(MAX_CLIENT_ACTION_CENTER_ROWS, (afterId) =>
        this.prisma.opsAddendum.findMany({
          where: {
            eventId: { in: eventIds },
            conformeExecution: { is: { status: 'awaiting_client' } },
            ...(afterId ? { id: { gt: afterId } } : {}),
          },
          select: {
            id: true,
            eventId: true,
            versionNumber: true,
            title: true,
            issuedAt: true,
            conformeExecution: { select: { status: true } },
          },
          orderBy: { id: 'asc' }, take: MAX_CLIENT_ACTION_CENTER_ROWS,
        }),
      ),
    ]);
    return [
      sortByDate(briefings, (row) => row.submittedAt, 'desc'),
      sortByDate(documents, (row) => row.uploadedAt, 'desc'),
      sortByDate(floorPlanDrafts, (row) => row.updatedAt, 'desc'),
      sortByDate(billingStatements, (row) => row.generatedAt, 'desc'),
      sortByDate(paymentMilestones, (row) => row.createdAt, 'asc'),
      sortByDate(paymentRecords, (row) => row.recordedAt, 'desc'),
      postEventDocuments.sort(
        (left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id),
      ),
      closeoutResponses,
      sortByDate(changeRequests, (row) => row.requestedAt, 'desc'),
      sortByDate(addenda, (row) => row.issuedAt, 'desc'),
    ] as const;
  }
  // Supplier and event eligibility is applied before each bounded keyset page.
  // Quote requests and quotes carry only the event id, so archived events are excluded by resolving the
  // supplier's active event ids from the owner tables instead of filtering through a cross-domain relation.
  private async activeEventIdsForSupplier(supplierId: string): Promise<string[]> {
    const [requestEvents, quoteEvents] = await Promise.all([
      this.prisma.opsSupplierQuoteRequest.findMany({
        where: { supplierId },
        select: { eventId: true },
        distinct: ['eventId'],
        orderBy: { eventId: 'asc' },
        take: MAX_SUPPLIER_WORKSPACE_ROWS,
      }),
      this.prisma.opsSupplierQuote.findMany({
        where: { supplierId },
        select: { eventId: true },
        distinct: ['eventId'],
        orderBy: { eventId: 'asc' },
        take: MAX_SUPPLIER_WORKSPACE_ROWS,
      }),
    ]);
    const candidateIds = [...new Set([...requestEvents, ...quoteEvents].map(({ eventId }) => eventId))];
    if (candidateIds.length === 0) return [];
    const activeEvents = await this.prisma.opsEvent.findMany({
      where: { id: { in: candidateIds }, archived: false },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: MAX_SUPPLIER_EVENTS,
    });
    return activeEvents.map(({ id }) => id);
  }

  async supplierWorkspaceForSupplier(supplierId: string) {
    const activeEventIds = await this.activeEventIdsForSupplier(supplierId);
    const activeRequestWhere = {
      supplierId,
      eventId: { in: activeEventIds },
    };
    const activeQuoteWhere = { supplierId, eventId: { in: activeEventIds } };
    const [requests, quotes] = await Promise.all([
      readAllRowsById(MAX_SUPPLIER_WORKSPACE_ROWS, (afterId) =>
        this.prisma.opsSupplierQuoteRequest.findMany({ where: {
            ...activeRequestWhere,
            ...(afterId ? { id: { gt: afterId } } : {}),
          },
          include: { contractVersions: { select: { reviewStatus: true }, orderBy: { version: 'desc' }, take: 1 } },
          orderBy: { id: 'asc' }, take: MAX_SUPPLIER_WORKSPACE_ROWS }),
      ),
      readAllRowsById(MAX_SUPPLIER_WORKSPACE_ROWS, (afterId) =>
        this.prisma.opsSupplierQuote.findMany({ where: {
            ...activeQuoteWhere,
            ...(afterId ? { id: { gt: afterId } } : {}),
          },
          orderBy: { id: 'asc' }, take: MAX_SUPPLIER_WORKSPACE_ROWS }),
      ),
    ]);
    return [
      sortByDate(requests, (row) => row.createdAt, 'desc'),
      sortByDate(quotes, (row) => row.createdAt, 'desc'),
    ] as const;
  }

  async supplierEvents(eventIds: string[]) {
    if (!eventIds.length) return [];
    return readAllRowsById(MAX_SUPPLIER_EVENTS, (afterId) =>
      this.prisma.opsEvent.findMany({ where: {
          archived: false,
          id: { in: eventIds, ...(afterId ? { gt: afterId } : {}) },
        }, orderBy: { id: 'asc' }, take: MAX_SUPPLIER_EVENTS }),
    );
  }

  async supplierReadinessRequests(supplierId: string) {
    const activeEventIds = await this.activeEventIdsForSupplier(supplierId);
    const requests = await readAllRowsById(MAX_SUPPLIER_WORKSPACE_ROWS, (afterId) =>
      this.prisma.opsSupplierQuoteRequest.findMany({
        where: { supplierId, eventId: { in: activeEventIds }, ...(afterId ? { id: { gt: afterId } } : {}) },
        include: SUPPLIER_READINESS_INCLUDE,
        orderBy: { id: 'asc' }, take: MAX_SUPPLIER_WORKSPACE_ROWS,
      }),
    );
    return sortByDate(requests, (row) => row.createdAt, 'desc');
  }

  /** Event-scoped readiness sources; callers authorize event access before reading them. */
  supplierReadinessRequestsForEvent(eventId: string) {
    return readAllRowsById(MAX_SUPPLIER_WORKSPACE_ROWS, (afterId) =>
      this.prisma.opsSupplierQuoteRequest.findMany({
        where: { eventId, ...(afterId ? { id: { gt: afterId } } : {}) },
        include: SUPPLIER_READINESS_INCLUDE,
        orderBy: { id: 'asc' },
        take: MAX_SUPPLIER_WORKSPACE_ROWS,
      }),
    );
  }

  // Each actionable source has its own deterministic page so combined queue rows are never silently dropped.
  async pmcmCommandInbox(page: number, pageSize = MAX_PMCM_COMMAND_INBOX_PAGE_SIZE, now = new Date()) {
    const skip = page * pageSize;
    const take = pageSize + 1;
    const [
      inquiries,
      events,
      paymentMilestones,
      quoteRequests,
      coordinatorAssignments,
      floorPlanDrafts,
      postEventDocuments,
      eventDayTasks,
      urgentIssues,
      fileReviews,
    ] = await Promise.all([
      this.prisma.opsInquiry.findMany({
        where: { OR: [{ status: 'new' }, { status: 'accepted', conformeSignedAt: null }] },
        select: { id: true, status: true, clientName: true, eventName: true, createdAt: true, acceptedAt: true, conformeSignedAt: true, portalInvitationExpiresAt: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        // QUERY_AUDIT_ALLOW_OFFSET: shared inbox page schema caps page at 100 (maximum offset 1000).
        skip, take,
      }),
      this.prisma.opsEvent.findMany({
        where: { archived: false, floorPlanStatus: { not: 'approved' } },
        select: { id: true, eventName: true, eventDate: true, floorPlanStatus: true, status: true, clientName: true },
        orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
        // QUERY_AUDIT_ALLOW_OFFSET: shared inbox page schema caps page at 100 (maximum offset 1000).
        skip, take,
      }),
      this.prisma.opsPaymentMilestone.findMany({
        where: { status: { not: 'paid' } },
        select: { id: true, eventId: true, label: true, status: true, dueDate: true },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        // QUERY_AUDIT_ALLOW_OFFSET: shared inbox page schema caps page at 100 (maximum offset 1000).
        skip, take,
      }),
      this.prisma.opsSupplierQuoteRequest.findMany({
        where: { status: { notIn: ['selected', 'closed', 'cancelled'] } },
        select: { id: true, eventId: true, supplierName: true, status: true, dueDate: true },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        // QUERY_AUDIT_ALLOW_OFFSET: shared inbox page schema caps page at 100 (maximum offset 1000).
        skip, take,
      }),
      this.prisma.opsCoordinatorAssignment.findMany({
        where: { status: { notIn: ['acknowledged', 'confirmed', 'checked_in', 'completed'] } },
        select: { id: true, eventId: true, coordinatorName: true, status: true, createdAt: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        // QUERY_AUDIT_ALLOW_OFFSET: shared inbox page schema caps page at 100 (maximum offset 1000).
        skip, take,
      }),
      this.prisma.opsFloorPlanDraft.findMany({
        where: { status: { in: ['submitted', 'in_review'] } },
        select: { id: true, eventId: true, name: true, status: true, updatedAt: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        // QUERY_AUDIT_ALLOW_OFFSET: shared inbox page schema caps page at 100 (maximum offset 1000).
        skip, take,
      }),
      this.prisma.opsPostEventDocument.findMany({
        where: { status: { not: 'complete' } },
        select: { id: true, eventId: true, title: true, status: true },
        orderBy: [{ id: 'asc' }],
        // QUERY_AUDIT_ALLOW_OFFSET: shared inbox page schema caps page at 100 (maximum offset 1000).
        skip, take,
      }),
      // Event-day work is actionable when it is blocked or past its SLA (falling back to the due time).
      this.prisma.opsEventDayTask.findMany({
        where: {
          status: { notIn: ['done', 'cancelled'] },
          completedAt: null,
          OR: [
            { status: 'blocked' },
            { slaStatus: 'overdue' },
            { slaDueAt: { lt: now } },
            { slaDueAt: null, dueAt: { lt: now } },
          ],
        },
        select: { id: true, eventId: true, title: true, status: true, assignedRole: true, ownerName: true, blockedReason: true, dueAt: true, slaDueAt: true, slaStatus: true },
        orderBy: [{ slaDueAt: 'asc' }, { id: 'asc' }],
        // QUERY_AUDIT_ALLOW_OFFSET: shared inbox page schema caps page at 100 (maximum offset 1000).
        skip, take,
      }),
      this.prisma.opsUrgentIssue.findMany({
        where: { status: { in: ['open', 'assigned'] }, resolvedAt: null },
        select: { id: true, eventId: true, title: true, severity: true, status: true, slaDueAt: true, slaStatus: true, createdAt: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        // QUERY_AUDIT_ALLOW_OFFSET: shared inbox page schema caps page at 100 (maximum offset 1000).
        skip, take,
      }),
      // Files a client, supplier or coordinator sent for a requirement and PMCM has not reviewed. A newer upload marks
      // the sender's earlier unreviewed files replaced, so each sender has at most one waiting per requirement.
      this.prisma.opsDocument.findMany({
        where: { status: 'submitted', validationStatus: { not: 'rejected' }, storageKey: { not: null }, uploadedByRole: { in: ['client', 'supplier', 'coordinator'] } },
        select: { id: true, eventId: true, type: true, fileName: true, uploadedByRole: true, uploadedAt: true, storageKey: true },
        orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
        // QUERY_AUDIT_ALLOW_OFFSET: shared inbox page schema caps page at 100 (maximum offset 1000).
        skip, take,
      }),
    ]);
    const items = <T>(rows: T[]) => rows.slice(0, pageSize);
    const sources = [inquiries, events, paymentMilestones, quoteRequests, coordinatorAssignments, floorPlanDrafts, postEventDocuments, eventDayTasks, urgentIssues, fileReviews];

    return {
      inquiries: items(inquiries),
      events: items(events),
      paymentMilestones: items(paymentMilestones),
      quoteRequests: items(quoteRequests),
      coordinatorAssignments: items(coordinatorAssignments),
      floorPlanDrafts: items(floorPlanDrafts),
      postEventDocuments: items(postEventDocuments),
      eventDayTasks: items(eventDayTasks),
      urgentIssues: items(urgentIssues),
      fileReviews: items(fileReviews),
      hasMore: page < PRISM_PMCM_COMMAND_INBOX_MAX_PAGE && sources.some((rows) => rows.length > pageSize),
    };
  }

  /**
   * Of these waiting files, the supplier ones their own supplier has since replaced with a newer upload. Files sent
   * before a new upload started marking earlier ones replaced are still stored as waiting; the supplier that sent each
   * file is the owner of its stored object.
   */
  async supersededSupplierFiles(files: ReadonlyArray<{ id: string; eventId: string; type: string; uploadedAt: Date; uploadedByRole: string | null; storageKey: string | null }>) {
    const waiting = files.filter((file) => file.uploadedByRole === 'supplier' && file.storageKey);
    if (waiting.length === 0) return new Set<string>();
    const pairs = [...new Map(waiting.map((file) => [`${file.eventId}:${file.type}`, { eventId: file.eventId, type: file.type }])).values()];
    const siblings = await this.prisma.opsDocument.findMany({
      where: { storageKey: { not: null }, OR: pairs },
      select: { id: true, eventId: true, type: true, uploadedAt: true, storageKey: true },
      // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: the uploads for at most one inbox page of requirements.
      take: SUPERSEDED_SUPPLIER_FILE_SCAN,
    });
    const objectIds = [...new Set(siblings.map((sibling) => sibling.storageKey!))];
    const owners = await this.prisma.opsStoredObject.findMany({
      where: { id: { in: objectIds }, ownerRecordType: 'supplier' },
      select: { id: true, ownerRecordId: true },
    });
    const ownerOf = new Map(owners.map((owner) => [owner.id, owner.ownerRecordId]));
    const newer = (left: { id: string; uploadedAt: Date }, right: { id: string; uploadedAt: Date }) =>
      left.uploadedAt.getTime() > right.uploadedAt.getTime() || (left.uploadedAt.getTime() === right.uploadedAt.getTime() && left.id < right.id);
    return new Set(waiting.filter((file) => {
      const owner = ownerOf.get(file.storageKey!);
      return owner !== undefined && siblings.some((sibling) => sibling.id !== file.id && sibling.eventId === file.eventId && sibling.type === file.type
        && ownerOf.get(sibling.storageKey!) === owner && newer(sibling, file));
    }).map((file) => file.id));
  }

  /** The labels of the requirements the waiting files were sent for. */
  async fileRequirementLabels(files: ReadonlyArray<{ eventId: string; type: string }>) {
    if (files.length === 0) return new Map<string, string>();
    const rows = await this.prisma.opsFileRequirement.findMany({
      where: { OR: files.map((file) => ({ eventId: file.eventId, key: file.type })) },
      select: { eventId: true, key: true, label: true },
      // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: one requirement per (event, key), so never more rows than the inbox page of files (at most 100).
      take: files.length,
    });
    return new Map(rows.map((row) => [`${row.eventId}:${row.key}`, row.label]));
  }

  pmcmCommandInboxEventRefs(eventIds: string[]) {
    if (eventIds.length === 0) return Promise.resolve([]);
    return this.prisma.opsEvent.findMany({
      where: { id: { in: eventIds }, archived: false },
      select: { id: true, eventName: true, eventDate: true, floorPlanStatus: true, status: true, clientName: true },
      orderBy: [{ id: 'asc' }],
    });
  }

  pmcmCommandInboxSummary() {
    return Promise.all([
      this.prisma.opsEvent.count({ where: { archived: false } }),
      this.prisma.opsInquiry.count({ where: { status: 'new' } }),
      this.prisma.opsApprovalRequest.count({ where: { status: 'pending' } }),
    ]).then(([activeEvents, pendingInquiries, pendingApprovals]) => ({ activeEvents, pendingInquiries, pendingApprovals }));
  }

  // Query budget: fifteen selected-event relation queries; guest, staffing, and registration reads use public reader ports outside this query builder.
  pmcmEventWorkspace(eventId: string) {
    return Promise.all([
      this.prisma.opsDocument.findMany({ where: { eventId }, orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }], take: MAX_PMCM_EVENT_WORKSPACE_ROWS }),
      this.prisma.opsBriefing.findMany({ where: { eventId }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], take: MAX_PMCM_EVENT_WORKSPACE_ROWS }),
      this.prisma.opsSupplierQuoteRequest.findMany({ where: { eventId }, include: { round: { select: { roundNumber: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_PMCM_EVENT_WORKSPACE_ROWS }),
      this.prisma.opsSupplierQuote.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_PMCM_EVENT_WORKSPACE_ROWS }),
      this.prisma.opsComplianceCheck.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_PMCM_EVENT_WORKSPACE_ROWS }),
      this.prisma.opsBillingSource.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_PMCM_EVENT_WORKSPACE_ROWS }),
      this.prisma.opsBillingStatement.findMany({ where: { eventId }, orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }], take: MAX_PMCM_EVENT_WORKSPACE_ROWS }),
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_PMCM_EVENT_WORKSPACE_ROWS }),
      this.prisma.opsPaymentRecord.findMany({ where: { eventId }, orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }], take: MAX_PMCM_EVENT_WORKSPACE_ROWS }),
      this.prisma.opsPostEventDocument.findMany({ where: { eventId }, orderBy: [{ title: 'asc' }, { id: 'asc' }], take: MAX_PMCM_EVENT_WORKSPACE_ROWS }),
      this.prisma.opsEventInsight.findMany({ where: { eventId }, orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }], take: MAX_PMCM_EVENT_WORKSPACE_ROWS }),
      this.prisma.opsFloorPlanDraft.findMany({ where: { eventId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: MAX_PMCM_EVENT_WORKSPACE_ROWS }),
      this.prisma.opsAuditLog.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_AUDIT_LOGS }),
      this.prisma.opsNotificationLog.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_NOTIFICATION_LOGS }),
      this.prisma.opsOcularVisitRequest.findUnique({ where: { eventId } }),
    ]);
  }

  // Query budget: seven bounded reference queries in one wave (events without drafts, inquiries, users, compliance
  // rules, supplier categories, active suppliers, one grouped balance sum); coordinators and assignments are read
  // alongside by the service.
  pmcmReference() {
    return Promise.all([
      this.prisma.opsEvent.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_VISIBLE_EVENTS }),
      this.prisma.opsInquiry.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.opsUser.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
      this.prisma.opsComplianceRule.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.supplierCategories(),
      this.activeSuppliers(),
      // Current (not superseded) milestones only, so a revised schedule is not counted twice.
      this.prisma.opsPaymentMilestone.groupBy({ by: ['eventId'], where: { supersededAt: null }, _sum: { remainingBalance: true } }),
    ]);
  }

  // Query budget: one active coordinator dashboard query, no per-row Prisma loop.
  activeCoordinators() {
    return this.prisma.opsCoordinator.findMany({ where: { active: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: MAX_ACTIVE_COORDINATORS });
  }
  // Query budget: one bounded coordinator assignment dashboard query, no per-row Prisma loop.
  boundedCoordinatorAssignments() {
    return this.prisma.opsCoordinatorAssignment.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  }

  async coordinatorReliabilityHistory(coordinatorId: string) {
    const notes = await this.prisma.opsCoordinatorReliabilityNote.findMany({
      where: { coordinatorId },
      include: {
        assignment: { select: { role: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_COORDINATOR_RELIABILITY_HISTORY_ROWS,
    });
    const eventIds = [...new Set(notes.flatMap((note) => note.eventId ? [note.eventId] : []))];
    const events = eventIds.length
      ? await this.prisma.opsEvent.findMany({ where: { id: { in: eventIds } }, select: { id: true, eventName: true, eventDate: true } })
      : [];
    const eventById = new Map(events.map((event) => [event.id, event]));
    return notes.map((note) => ({ ...note, event: note.eventId ? eventById.get(note.eventId) ?? null : null }));
  }

  async supplierForActor(supplierId?: string, email?: string) {
    const identityWhere: Prisma.OpsSupplierWhereInput | undefined = supplierId
      ? { id: supplierId }
      : email?.trim()
        ? { email: { equals: email.trim(), mode: 'insensitive' } }
        : undefined;
    if (!identityWhere) return null;
    const supplier = await this.prisma.opsSupplier.findFirst({
      where: identityWhere,
      include: {
        category: true,
        reviews: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: MAX_SUPPLIER_HISTORY_ROWS,
        },
        reliabilityNotes: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: MAX_SUPPLIER_HISTORY_ROWS,
        },
        certifications: {
          orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
          take: MAX_SUPPLIER_CERTIFICATIONS,
        },
      },
    });
    if (!supplier) return null;
    const [profile] = await this.attachSupplierEvents([supplier]);
    const aggregates =
      typeof this.prisma.opsSupplierReview.groupBy === 'function'
        ? await this.prisma.opsSupplierReview.groupBy({
            by: ['supplierId'],
            where: { supplierId: supplier.id },
            _avg: { rating: true },
          })
        : [];
    return this.mapSupplier(profile, aggregates[0]?._avg.rating);
  }
  // Query budget: one active supplier directory query, no per-row Prisma loop.
  activeSuppliers() {
    return this.prisma.opsSupplier
      .findMany({
        take: MAX_ACTIVE_SUPPLIERS,
        include: {
          category: true,
          reviews: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_SUPPLIER_HISTORY_ROWS },
          reliabilityNotes: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_SUPPLIER_HISTORY_ROWS },
          certifications: { orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }], take: MAX_SUPPLIER_CERTIFICATIONS },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      })
      .then(async (suppliers) => {
        if (suppliers.length === 0) return [];
        const profiles = await this.attachSupplierEvents(suppliers);
        // Some Prisma test doubles may not expose groupBy; production
        // Prisma does, and uses the exact aggregate to keep capped review rows
        // from changing the displayed supplier rating.
        const reviewAggregates = typeof this.prisma.opsSupplierReview.groupBy === 'function'
          ? await this.prisma.opsSupplierReview.groupBy({
              by: ['supplierId'],
              where: { supplierId: { in: suppliers.map((supplier) => supplier.id) } },
              _avg: { rating: true },
            })
          : [];
        const aggregateRatingBySupplier = new Map(
          reviewAggregates.map((aggregate) => [aggregate.supplierId, aggregate._avg.rating]),
        );
        return profiles.map((supplier) => this.mapSupplier(supplier, aggregateRatingBySupplier.get(supplier.id)));
      });
  }

  private async attachSupplierEvents(suppliers: readonly SupplierProfileBase[]): Promise<SupplierWithProfile[]> {
    const eventIds = [...new Set(suppliers.flatMap((supplier) => [
      ...supplier.reviews.flatMap((review) => review.eventId ? [review.eventId] : []),
      ...supplier.reliabilityNotes.flatMap((note) => note.eventId ? [note.eventId] : []),
    ]))];
    const events = eventIds.length
      ? await this.prisma.opsEvent.findMany({ where: { id: { in: eventIds } }, select: { id: true, eventName: true, eventDate: true, clientName: true } })
      : [];
    const eventById = new Map(events.map((event) => [event.id, event]));
    return suppliers.map((supplier) => ({
      ...supplier,
      reviews: supplier.reviews.map((review) => ({ ...review, event: review.eventId ? eventById.get(review.eventId) ?? null : null })),
      reliabilityNotes: supplier.reliabilityNotes.map((note) => {
        const event = note.eventId ? eventById.get(note.eventId) : undefined;
        return { ...note, event: event ? { id: event.id, eventName: event.eventName } : null };
      }),
    }));
  }

  // Query budget: one supplier category query, no per-row Prisma loop.
  supplierCategories() {
    return this.prisma.opsSupplierCategory
      .findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], take: MAX_ACTIVE_SUPPLIERS })
      .then((categories) => categories.map((category) => this.mapSupplierCategory(category)));
  }

  private mapSupplierCategory(category: OpsSupplierCategory) {
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      sortOrder: category.sortOrder,
      active: category.active,
      acceptableMin: category.acceptableMin ?? null,
      acceptableMax: category.acceptableMax ?? null,
    };
  }

  private mapSupplier(supplier: SupplierWithProfile, exactAggregateRating?: number | null) {
    const ratings = supplier.reviews.map((review) => review.rating);
    const aggregateRating =
      exactAggregateRating !== undefined
        ? exactAggregateRating === null
          ? null
          : Math.round(exactAggregateRating * 10) / 10
        : ratings.length > 0
          ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
          : null;
    const datedEvents = supplier.reviews
      .map((review) => review.event)
      .filter((event): event is OpsEvent => Boolean(event))
      .sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime() || b.id.localeCompare(a.id));

    return {
      id: supplier.id,
      name: supplier.name,
      categoryId: supplier.categoryId,
      categoryName: supplier.category.name,
      categorySlug: supplier.category.slug,
      tier: supplier.tier,
      bniMember: supplier.bniMember,
      autoTrust: supplier.bniMember,
      contactName: supplier.contactName,
      email: supplier.email,
      phone: supplier.phone,
      serviceInclusions: supplier.serviceInclusions,
      performanceNotes: supplier.performanceNotes,
      applicationDate: isoDate(supplier.applicationDate),
      aggregateRating,
      lastEventDate: datedEvents[0] ? isoDate(datedEvents[0].eventDate) : null,
      pastEvents: datedEvents.map((event) => ({
        id: event.id,
        eventName: event.eventName,
        clientName: event.clientName,
        eventDate: isoDate(event.eventDate),
      })),
      reviews: supplier.reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        notes: review.notes,
        reviewedBy: review.reviewedBy,
        eventId: review.eventId,
        eventName: review.event?.eventName ?? null,
        createdAt: timestamp(review.createdAt),
      })),
      reliabilityNotes: supplier.reliabilityNotes.map((note) => ({
        id: note.id,
        note: note.note,
        eventId: note.eventId,
        eventName: note.event?.eventName ?? null,
        createdAt: timestamp(note.createdAt),
      })),
      certifications: supplier.certifications.map((certification) => {
        const metadata = certification as OpsSupplierCertification & {
          documentType?: string;
          issuer?: string;
          expiresAt?: Date | null;
          status?: string;
          notes?: string;
        };
        return {
          id: certification.id,
          fileName: certification.fileName,
          documentType: metadata.documentType ?? '',
          issuer: metadata.issuer ?? '',
          expiresAt: metadata.expiresAt ? isoDate(metadata.expiresAt) : null,
          status: metadata.status ?? 'submitted',
          notes: metadata.notes ?? '',
          uploadedAt: timestamp(certification.uploadedAt),
        };
      }),
    };
  }
}
