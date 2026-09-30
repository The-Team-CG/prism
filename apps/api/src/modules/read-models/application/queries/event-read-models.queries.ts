import { Injectable } from '@nestjs/common';
import type {
  OpsEvent,
  OpsSupplier,
  OpsSupplierCategory,
  OpsSupplierCertification,
  OpsSupplierReliabilityNote,
  OpsSupplierReview,
} from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { AuditCategory } from '@prism/kernel/event-core';
import { PRISM_PMCM_COMMAND_INBOX_MAX_PAGE } from '@prism/types';

type SupplierWithProfile = OpsSupplier & {
  category: OpsSupplierCategory;
  reviews: Array<OpsSupplierReview & { event: OpsEvent | null }>;
  reliabilityNotes: Array<OpsSupplierReliabilityNote & { event: OpsEvent | null }>;
  certifications: OpsSupplierCertification[];
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
export const MAX_READINESS_ROWS = 500;
export const MAX_BILLING_ROWS = 500;
export const MAX_CLIENT_WORKSPACE_ROWS = 500;
export const MAX_CLIENT_ACTION_CENTER_ROWS = 500;
export const MAX_SUPPLIER_WORKSPACE_ROWS = 500;
export const MAX_SUPPLIER_EVENTS = 500;
export const MAX_PMCM_COMMAND_INBOX_PAGE_SIZE = 10;
export const MAX_PMCM_EVENT_WORKSPACE_ROWS = 500;
export const MAX_PMCM_DASHBOARD_ROWS = 500;
export const MAX_ACTIVE_COORDINATORS = 500;
export const MAX_ACTIVE_SUPPLIERS = 500;
export const MAX_SUPPLIER_HISTORY_ROWS = 100;
export const MAX_SUPPLIER_CERTIFICATIONS = 100;
export const MAX_AUDIT_LOGS = 100;
export const MAX_NOTIFICATION_LOGS = 100;

type DefenseReadModelCounts = {
  briefings: number;
  floorPlanDrafts: number;
  approvedFloorplan: number;
  quoteRequests: number;
  selectedSupplierQuotes: number;
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

@Injectable()
export class EventReadModelQueries {
  constructor(private readonly prisma: PrismaService) {}

  // Query budget: one archived-filtered event query with floorplan drafts, no per-row Prisma loop.
  visibleEvents() {
    return this.prisma.opsEvent.findMany({
      where: { archived: false },
      include: {
        inquiry: { select: { email: true } },
        floorPlanDrafts: {
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: MAX_EVENT_FLOORPLAN_DRAFTS,
        },
      },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
      take: MAX_VISIBLE_EVENTS,
    });
  }

  // Query budget: one selected-event query with floorplan drafts, no per-row Prisma loop.
  eventWithDrafts(eventId: string) {
    return this.prisma.opsEvent.findUnique({
      where: { id: eventId },
      include: {
        inquiry: { select: { email: true } },
        floorPlanDrafts: {
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: MAX_EVENT_FLOORPLAN_DRAFTS,
        },
      },
    });
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

  // Query budget: one selected event query plus seven event-scoped readiness queries, no per-row Prisma loop.
  defenseReadiness(eventId: string) {
    return Promise.all([
      this.eventWithDrafts(eventId),
      this.prisma.opsBriefing.findMany({ where: { eventId }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], take: MAX_READINESS_ROWS }),
      this.prisma.opsSupplierQuoteRequest.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_READINESS_ROWS }),
      this.prisma.opsSupplierQuote.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_READINESS_ROWS }),
      this.prisma.opsEventDayTask.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_READINESS_ROWS }),
      this.prisma.opsUrgentIssue.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_READINESS_ROWS }),
      this.prisma.opsBillingStatement.findMany({ where: { eventId }, orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }], take: MAX_READINESS_ROWS }),
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_READINESS_ROWS }),
      this.defenseReadinessCounts(eventId),
    ]);
  }

  private defenseReadinessCounts(eventId: string): Promise<DefenseReadModelCounts> {
    return Promise.all([
      this.prisma.opsBriefing.count({ where: { eventId } }),
      this.prisma.opsFloorPlanDraft.count({ where: { eventId } }),
      this.prisma.opsFloorPlanDraft.count({ where: { eventId, status: 'approved' } }),
      this.prisma.opsSupplierQuoteRequest.count({ where: { eventId } }),
      this.prisma.opsSupplierQuote.count({ where: { eventId, status: { in: ['selected', 'locked'] } } }),
      this.prisma.opsEventDayTask.count({ where: { eventId, status: { notIn: ['done', 'cancelled'] } } }),
      this.prisma.opsUrgentIssue.count({ where: { eventId, status: { notIn: ['resolved', 'closed'] } } }),
      this.prisma.opsBillingStatement.count({ where: { eventId } }),
      this.prisma.opsPaymentMilestone.count({ where: { eventId } }),
      this.prisma.opsPaymentMilestone.count({ where: { eventId, OR: [{ status: { not: 'paid' } }, { remainingBalance: { gt: 0 } }] } }),
    ]).then(([briefings, floorPlanDrafts, approvedFloorplan, quoteRequests, selectedSupplierQuotes, eventDayTasks, urgentIssues, billingStatements, paymentMilestones, unpaidPaymentMilestones]) => ({
      briefings,
      floorPlanDrafts,
      approvedFloorplan,
      quoteRequests,
      selectedSupplierQuotes,
      eventDayTasks,
      urgentIssues,
      billingStatements,
      paymentMilestones,
      unpaidPaymentMilestones,
    }));
  }

  // Query budget: four finance queries for a bounded actor-visible event id set, no per-row Prisma loop.
  billingForEvents(eventIds: string[], includeInternalCosts: boolean) {
    return Promise.all([
      includeInternalCosts
        ? this.prisma.opsBillingSource.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_BILLING_ROWS })
        : Promise.resolve([]),
      this.prisma.opsBillingStatement.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }], take: MAX_BILLING_ROWS }),
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_BILLING_ROWS }),
      this.prisma.opsPaymentRecord.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }], take: MAX_BILLING_ROWS }),
    ]);
  }

  // Query budget: seven client workspace queries for a bounded visible event id set, no per-row Prisma loop.
  clientWorkspaceForEvents(eventIds: string[]) {
    return Promise.all([
      this.prisma.opsDocument.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }], take: MAX_CLIENT_WORKSPACE_ROWS }),
      this.prisma.opsBriefing.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], take: MAX_CLIENT_WORKSPACE_ROWS }),
      this.prisma.opsFloorPlanDraft.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: MAX_CLIENT_WORKSPACE_ROWS }),
      this.prisma.opsBillingStatement.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }], take: MAX_CLIENT_WORKSPACE_ROWS }),
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_CLIENT_WORKSPACE_ROWS }),
      this.prisma.opsPaymentRecord.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }], take: MAX_CLIENT_WORKSPACE_ROWS }),
      this.prisma.opsAuditLog.findMany({
        where: { eventId: { in: eventIds }, category: { not: AuditCategory.Access } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAX_AUDIT_LOGS,
      }),
    ]);
  }

  // Query budget: seven client action-center queries for a bounded visible event id set, no per-row Prisma loop.
  clientActionCenterForEvents(eventIds: string[]) {
    return Promise.all([
      this.prisma.opsBriefing.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], take: MAX_CLIENT_ACTION_CENTER_ROWS }),
      this.prisma.opsDocument.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }], take: MAX_CLIENT_ACTION_CENTER_ROWS }),
      this.prisma.opsFloorPlanDraft.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: MAX_CLIENT_ACTION_CENTER_ROWS }),
      this.prisma.opsBillingStatement.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }], take: MAX_CLIENT_ACTION_CENTER_ROWS }),
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_CLIENT_ACTION_CENTER_ROWS }),
      this.prisma.opsPaymentRecord.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }], take: MAX_CLIENT_ACTION_CENTER_ROWS }),
      this.prisma.opsPostEventDocument.findMany({ where: { eventId: { in: eventIds } }, orderBy: [{ title: 'asc' }, { id: 'asc' }], take: MAX_CLIENT_ACTION_CENTER_ROWS }),
    ]);
  }

  // Query budget: two supplier quote queries for one supplier, no per-row Prisma loop.
  supplierWorkspaceForSupplier(supplierId: string) {
    return Promise.all([
      this.prisma.opsSupplierQuoteRequest.findMany({ where: { supplierId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_SUPPLIER_WORKSPACE_ROWS }),
      this.prisma.opsSupplierQuote.findMany({ where: { supplierId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_SUPPLIER_WORKSPACE_ROWS }),
    ]);
  }

  // Query budget: one archived-filtered event query for supplier event ids, no per-row Prisma loop.
  supplierEvents(eventIds: string[]) {
    return eventIds.length
      ? this.prisma.opsEvent.findMany({ where: { id: { in: eventIds }, archived: false }, orderBy: { id: 'asc' }, take: MAX_SUPPLIER_EVENTS })
      : Promise.resolve([]);
  }

  // Query budget: one bounded supplier quote-request query for one supplier, no per-row Prisma loop.
  supplierReadinessRequests(supplierId: string) {
    return this.prisma.opsSupplierQuoteRequest.findMany({ where: { supplierId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_SUPPLIER_WORKSPACE_ROWS });
  }

  // Each actionable source has its own deterministic page so combined queue rows are never silently dropped.
  async pmcmCommandInbox(page: number, pageSize = MAX_PMCM_COMMAND_INBOX_PAGE_SIZE) {
    const skip = page * pageSize;
    const take = pageSize + 1;
    const [inquiries, events, paymentMilestones, quoteRequests, coordinatorAssignments, floorPlanDrafts, postEventDocuments] = await Promise.all([
      this.prisma.opsInquiry.findMany({
        where: { OR: [{ status: 'new' }, { status: 'accepted', conformeSignedAt: null }] },
        select: { id: true, status: true, clientName: true, eventName: true, createdAt: true, acceptedAt: true, conformeSignedAt: true, portalInvitationExpiresAt: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip, take,
      }),
      this.prisma.opsEvent.findMany({
        where: { archived: false, floorPlanStatus: { not: 'approved' } },
        select: { id: true, eventName: true, eventDate: true, floorPlanStatus: true, status: true, clientName: true },
        orderBy: [{ eventDate: 'asc' }, { id: 'asc' }], skip, take,
      }),
      this.prisma.opsPaymentMilestone.findMany({
        where: { status: { not: 'paid' } },
        select: { id: true, eventId: true, label: true, status: true, dueDate: true },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }], skip, take,
      }),
      this.prisma.opsSupplierQuoteRequest.findMany({
        where: { status: { notIn: ['selected', 'closed', 'cancelled'] } },
        select: { id: true, eventId: true, supplierName: true, status: true, dueDate: true },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }], skip, take,
      }),
      this.prisma.opsCoordinatorAssignment.findMany({
        where: { status: { notIn: ['confirmed', 'checked_in', 'completed'] } },
        select: { id: true, eventId: true, coordinatorName: true, status: true, createdAt: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip, take,
      }),
      this.prisma.opsFloorPlanDraft.findMany({
        where: { status: { in: ['submitted', 'in_review'] } },
        select: { id: true, eventId: true, name: true, status: true, updatedAt: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }], skip, take,
      }),
      this.prisma.opsPostEventDocument.findMany({
        where: { status: { not: 'complete' } },
        select: { id: true, eventId: true, title: true, status: true },
        orderBy: [{ id: 'asc' }], skip, take,
      }),
    ]);
    const items = <T,>(rows: T[]) => rows.slice(0, pageSize);

    return {
      inquiries: items(inquiries),
      events: items(events),
      paymentMilestones: items(paymentMilestones),
      quoteRequests: items(quoteRequests),
      coordinatorAssignments: items(coordinatorAssignments),
      floorPlanDrafts: items(floorPlanDrafts),
      postEventDocuments: items(postEventDocuments),
      hasMore: page < PRISM_PMCM_COMMAND_INBOX_MAX_PAGE && [inquiries, events, paymentMilestones, quoteRequests, coordinatorAssignments, floorPlanDrafts, postEventDocuments]
        .some((rows) => rows.length > pageSize),
    };
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

  // Query budget: fourteen selected-event relation queries; guest, staffing, and registration reads use public reader ports outside this query builder.
  pmcmEventWorkspace(eventId: string) {
    return Promise.all([
      this.prisma.opsDocument.findMany({ where: { eventId }, orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }], take: MAX_PMCM_EVENT_WORKSPACE_ROWS }),
      this.prisma.opsBriefing.findMany({ where: { eventId }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], take: MAX_PMCM_EVENT_WORKSPACE_ROWS }),
      this.prisma.opsSupplierQuoteRequest.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_PMCM_EVENT_WORKSPACE_ROWS }),
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
    ]);
  }

  // Query budget: eighteen bounded PMCM dashboard queries plus supplier directory/category reads; staffing display cards use a reader port.
  pmcmDashboard() {
    return Promise.all([
      this.prisma.opsUser.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
      this.prisma.opsInquiry.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.opsEvent.findMany({
        include: { floorPlanDrafts: { orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: MAX_EVENT_FLOORPLAN_DRAFTS } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAX_VISIBLE_EVENTS,
      }),
      this.prisma.opsDocument.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.opsBriefing.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.opsSupplierQuoteRequest.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.opsSupplierQuote.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.opsComplianceRule.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.opsComplianceCheck.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.opsBillingSource.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.opsBillingStatement.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.opsPaymentMilestone.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
      this.prisma.opsPaymentRecord.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.opsPostEventDocument.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ title: 'asc' }, { id: 'asc' }] }),
      this.prisma.opsEventInsight.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.opsFloorPlanDraft.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.opsAuditLog.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.opsNotificationLog.findMany({ take: MAX_PMCM_DASHBOARD_ROWS, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.supplierCategories(),
      this.activeSuppliers(),
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

  // Query budget: one active supplier directory query, no per-row Prisma loop.
  activeSuppliers() {
    return this.prisma.opsSupplier
      .findMany({
        take: MAX_ACTIVE_SUPPLIERS,
        include: {
          category: true,
          reviews: { include: { event: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_SUPPLIER_HISTORY_ROWS },
          reliabilityNotes: { include: { event: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: MAX_SUPPLIER_HISTORY_ROWS },
          certifications: { orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }], take: MAX_SUPPLIER_CERTIFICATIONS },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      })
      .then(async (suppliers) => {
        if (suppliers.length === 0) return [];
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
        return suppliers.map((supplier) => this.mapSupplier(supplier, aggregateRatingBySupplier.get(supplier.id)));
      });
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
