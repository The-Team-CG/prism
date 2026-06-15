import type {
  PrismApprovalRequest,
  PrismEvent,
  PrismInquiry,
  PrismPmcmDashboardWorkspace,
  PrismPmcmEventWorkspace,
} from "@prism/types";

export type EventClientRecord = {
  id: string;
  name: string;
  contact?: string;
  company?: string;
  events: PrismEvent[];
  inquiries: PrismInquiry[];
};

function clientKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "client";
}

export function selectActiveEvents(state: Pick<PrismPmcmDashboardWorkspace, "events"> | null | undefined): PrismEvent[] {
  return (state?.events ?? []).filter((event) => !event.archived);
}

export function selectSelectedEvent(events: PrismEvent[], selectedEventId?: string | null): PrismEvent | undefined {
  return events.find((event) => event.id === selectedEventId) ?? events[0];
}

export function selectUnreviewedInquiryCount(inquiries: PrismInquiry[]): number {
  return inquiries.filter((inquiry) => inquiry.status === "new").length;
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
  const drafts = scopedWorkspace?.floorPlanDrafts ?? (selectedEventId ? (state?.floorPlanDrafts ?? []).filter((draft) => draft.eventId === selectedEventId) : []);

  return {
    activeDraft: drafts.find((draft) => draft.isActive),
    assignments: scopedWorkspace?.coordinatorAssignments ?? (state?.coordinatorAssignments ?? []).filter((item) => item.eventId === selectedEventId),
    audit: (scopedWorkspace?.auditLogs ?? (state?.auditLogs ?? []).filter((item) => item.eventId === selectedEventId || !item.eventId)).slice(0, 14),
    billingSources: scopedWorkspace?.billingSources ?? (state?.billingSources ?? []).filter((item) => item.eventId === selectedEventId),
    billingStatements: scopedWorkspace?.billingStatements ?? (state?.billingStatements ?? []).filter((item) => item.eventId === selectedEventId),
    briefing: scopedWorkspace?.briefings[0] ?? state?.briefings.find((item) => item.eventId === selectedEventId),
    checks: scopedWorkspace?.complianceChecks ?? (state?.complianceChecks ?? []).filter((item) => item.eventId === selectedEventId),
    documents: scopedWorkspace?.documents ?? (state?.documents ?? []).filter((item) => item.eventId === selectedEventId),
    drafts,
    eventInsights: scopedWorkspace?.eventInsights ?? (state?.eventInsights ?? []).filter((item) => item.eventId === selectedEventId),
    notificationLogs: (scopedWorkspace?.notificationLogs ?? (state?.notificationLogs ?? []).filter((item) => !item.eventId || item.eventId === selectedEventId)).slice(0, 8),
    payments: scopedWorkspace?.paymentMilestones ?? (state?.paymentMilestones ?? []).filter((item) => item.eventId === selectedEventId),
    paymentRecords: scopedWorkspace?.paymentRecords ?? (state?.paymentRecords ?? []).filter((item) => item.eventId === selectedEventId),
    postEventDocuments: scopedWorkspace?.postEventDocuments ?? (state?.postEventDocuments ?? []).filter((item) => item.eventId === selectedEventId),
    quoteRequests: scopedWorkspace?.supplierQuoteRequests ?? (state?.supplierQuoteRequests ?? []).filter((item) => item.eventId === selectedEventId),
    quotes: scopedWorkspace?.supplierQuotes ?? (state?.supplierQuotes ?? []).filter((item) => item.eventId === selectedEventId),
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

export function selectClientRecords(events: PrismEvent[], inquiries: PrismInquiry[]): EventClientRecord[] {
  const map = new Map<string, EventClientRecord>();

  inquiries.forEach((inquiry) => {
    const name = inquiry.companyName || inquiry.clientName;
    const id = clientKey(name);
    const current = map.get(id) ?? {
      id,
      name,
      contact: inquiry.clientName,
      company: inquiry.companyName,
      events: [],
      inquiries: [],
    };
    current.inquiries.push(inquiry);
    map.set(id, current);
  });

  events.forEach((event) => {
    const id = clientKey(event.clientName);
    const current = map.get(id) ?? {
      id,
      name: event.clientName,
      contact: event.clientName,
      events: [],
      inquiries: [],
    };
    current.events.push(event);
    map.set(id, current);
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function selectClientRecordsForView(records: EventClientRecord[], view: string): EventClientRecord[] {
  switch (view) {
    case "active":
      return records.filter((client) => client.events.length > 0);
    case "prospects":
      return records.filter((client) => client.inquiries.length > 0 && client.events.length === 0);
    case "past":
      return records.filter((client) => client.events.some((event) => /completed|closed|archived/i.test(event.status)));
    case "archived":
      return records.filter((client) => client.events.length > 0 && client.events.every((event) => event.archived));
    default:
      return records;
  }
}

export function selectEventsForView(events: PrismEvent[], view: string): PrismEvent[] {
  switch (view) {
    case "upcoming":
      return events.filter((event) => new Date(event.eventDate).getTime() >= Date.now());
    case "ongoing":
      return events.filter((event) => /planning|active|ongoing|in_progress|confirmed/i.test(event.status));
    case "completed":
      return events.filter((event) => /completed|closed/i.test(event.status));
    case "cancelled":
      return events.filter((event) => /cancel/i.test(event.status));
    case "draft":
      return events.filter((event) => /draft/i.test(event.status));
    default:
      return events;
  }
}
