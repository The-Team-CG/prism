import type { PrismApprovalRequest, PrismEvent, PrismPmcmDashboardWorkspace, PrismPmcmEventWorkspace } from "@prism/types";

export function selectActiveEvents(
  state: Pick<PrismPmcmDashboardWorkspace, "events"> | null | undefined,
): PrismEvent[] {
  return (state?.events ?? []).filter((event) => !event.archived);
}

export function selectSelectedEvent(
  events: PrismEvent[],
  selectedEventId?: string | null,
): PrismEvent | undefined {
  return events.find((event) => event.id === selectedEventId) ?? events[0];
}

export function selectPendingApprovals(approvalRequests: PrismApprovalRequest[]): PrismApprovalRequest[] {
  return approvalRequests.filter((request) => request.status === "pending");
}

export function selectEventWorkspaceResources(
  state: Pick<
    PrismPmcmDashboardWorkspace,
    | "auditLogs"
    | "billingSources"
    | "billingStatements"
    | "briefings"
    | "complianceChecks"
    | "coordinatorAssignments"
    | "documents"
    | "eventInsights"
    | "floorPlanDrafts"
    | "notificationLogs"
    | "paymentMilestones"
    | "paymentRecords"
    | "postEventDocuments"
    | "supplierQuoteRequests"
    | "supplierQuotes"
  > | null | undefined,
  selectedEvent?: Pick<PrismEvent, "id">,
  eventWorkspace?: PrismPmcmEventWorkspace | null,
) {
  const selectedEventId = selectedEvent?.id;
  const scopedWorkspace = eventWorkspace?.event.id === selectedEventId ? eventWorkspace : null;
  const drafts =
    scopedWorkspace?.floorPlanDrafts ??
    (selectedEventId
      ? (state?.floorPlanDrafts ?? []).filter((draft) => draft.eventId === selectedEventId)
      : []);

  return {
    activeDraft: drafts.find((draft) => draft.isActive),
    assignments:
      scopedWorkspace?.coordinatorAssignments ??
      (state?.coordinatorAssignments ?? []).filter((item) => item.eventId === selectedEventId),
    audit: (
      scopedWorkspace?.auditLogs ??
      (state?.auditLogs ?? []).filter((item) => item.eventId === selectedEventId || !item.eventId)
    ).slice(0, 14),
    billingSources:
      scopedWorkspace?.billingSources ??
      (state?.billingSources ?? []).filter((item) => item.eventId === selectedEventId),
    billingStatements:
      scopedWorkspace?.billingStatements ??
      (state?.billingStatements ?? []).filter((item) => item.eventId === selectedEventId),
    briefing:
      scopedWorkspace?.briefings[0] ?? state?.briefings.find((item) => item.eventId === selectedEventId),
    checks:
      scopedWorkspace?.complianceChecks ??
      (state?.complianceChecks ?? []).filter((item) => item.eventId === selectedEventId),
    documents:
      scopedWorkspace?.documents ??
      (state?.documents ?? []).filter((item) => item.eventId === selectedEventId),
    drafts,
    eventInsights:
      scopedWorkspace?.eventInsights ??
      (state?.eventInsights ?? []).filter((item) => item.eventId === selectedEventId),
    notificationLogs: (
      scopedWorkspace?.notificationLogs ??
      (state?.notificationLogs ?? []).filter(
        (item) => !item.eventId || item.eventId === selectedEventId,
      )
    ).slice(0, 8),
    payments:
      scopedWorkspace?.paymentMilestones ??
      (state?.paymentMilestones ?? []).filter((item) => item.eventId === selectedEventId),
    paymentRecords:
      scopedWorkspace?.paymentRecords ??
      (state?.paymentRecords ?? []).filter((item) => item.eventId === selectedEventId),
    postEventDocuments:
      scopedWorkspace?.postEventDocuments ??
      (state?.postEventDocuments ?? []).filter((item) => item.eventId === selectedEventId),
    quoteRequests:
      scopedWorkspace?.supplierQuoteRequests ??
      (state?.supplierQuoteRequests ?? []).filter((item) => item.eventId === selectedEventId),
    quotes:
      scopedWorkspace?.supplierQuotes ??
      (state?.supplierQuotes ?? []).filter((item) => item.eventId === selectedEventId),
  };
}

export function selectSelectedEventWorkspaceResources(
  state: PrismPmcmDashboardWorkspace,
  events: PrismEvent[],
  selectedEventId?: string | null,
  eventWorkspace?: PrismPmcmEventWorkspace | null,
) {
  const workspace = eventWorkspace?.event.id === selectedEventId ? eventWorkspace : null;
  const selectedEvent = workspace?.event ?? selectSelectedEvent(events, selectedEventId);
  return {
    selectedEvent,
    ...selectEventWorkspaceResources(state, selectedEvent, workspace),
  };
}
