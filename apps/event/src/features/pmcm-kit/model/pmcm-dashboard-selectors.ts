import type { PrismApprovalRequest, PrismEvent, PrismPmcmEventWorkspace, PrismPmcmReference } from "@prism/types";

export function selectActiveEvents(
  reference: Pick<PrismPmcmReference, "events"> | null | undefined,
): PrismEvent[] {
  return (reference?.events ?? []).filter((event) => !event.archived);
}

export function selectSelectedEvent(
  events: PrismEvent[],
  selectedEventId?: string | null,
): PrismEvent | undefined {
  if (!selectedEventId) return undefined;
  return events.find((event) => event.id === selectedEventId);
}

export function selectPendingApprovals(approvalRequests: PrismApprovalRequest[]): PrismApprovalRequest[] {
  return approvalRequests.filter((request) => request.status === "pending");
}

/** The selected event's records, all from its own workspace; until that loads, every list is empty. */
export function selectEventWorkspaceResources(
  selectedEvent?: Pick<PrismEvent, "id">,
  eventWorkspace?: PrismPmcmEventWorkspace | null,
) {
  const workspace = selectedEvent && eventWorkspace?.event.id === selectedEvent.id ? eventWorkspace : null;
  const drafts = workspace?.floorPlanDrafts ?? [];
  return {
    activeDraft: drafts.find((draft) => draft.isActive),
    assignments: workspace?.coordinatorAssignments ?? [],
    coordinatorCoverage: workspace?.coordinatorCoverage ?? [],
    audit: (workspace?.auditLogs ?? []).slice(0, 14),
    billingSources: workspace?.billingSources ?? [],
    billingStatements: workspace?.billingStatements ?? [],
    briefing: workspace?.briefings[0],
    checks: workspace?.complianceChecks ?? [],
    documents: workspace?.documents ?? [],
    drafts,
    eventInsights: workspace?.eventInsights ?? [],
    notificationLogs: (workspace?.notificationLogs ?? []).slice(0, 8),
    payments: workspace?.paymentMilestones ?? [],
    paymentRecords: workspace?.paymentRecords ?? [],
    postEventDocuments: workspace?.postEventDocuments ?? [],
    quoteRequests: workspace?.supplierQuoteRequests ?? [],
    quotes: workspace?.supplierQuotes ?? [],
  };
}

export function selectSelectedEventWorkspaceResources(
  events: PrismEvent[],
  selectedEventId?: string | null,
  eventWorkspace?: PrismPmcmEventWorkspace | null,
) {
  const workspace = eventWorkspace?.event.id === selectedEventId ? eventWorkspace : null;
  const selectedEvent = workspace?.event ?? selectSelectedEvent(events, selectedEventId);
  return {
    selectedEvent,
    ...selectEventWorkspaceResources(selectedEvent, workspace),
  };
}
