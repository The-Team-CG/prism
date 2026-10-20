import type { PrismClientActionItem, PrismClientWorkspace, PrismEvent, PrismFloorPlanDraft, PrismUser } from "@prism/types";
import { actionCenterItemToDashboardAction, draftIsOfficial, type ClientDashboardAction } from "./client-dashboard-view-rules";

type ClientEventLists = Pick<PrismClientWorkspace, "events" | "archivedEvents">;

function allClientEvents(state: ClientEventLists): PrismEvent[] {
  return [...state.events, ...(state.archivedEvents ?? [])];
}

export function selectClientEvents(
  state: ClientEventLists | null | undefined,
  session: Pick<PrismUser, "name"> | null | undefined,
  includeArchivedEventId?: string,
): PrismEvent[] {
  if (!state || !session) return [];
  return allClientEvents(state).filter(
    (event) =>
      event.clientPortalStatus === "unlocked" &&
      (!event.archived || event.id === includeArchivedEventId),
  );
}

export function selectClientEventHistoryEvents(
  state: ClientEventLists | null | undefined,
  session: Pick<PrismUser, "name"> | null | undefined,
): PrismEvent[] {
  if (!state || !session) return [];
  return allClientEvents(state).filter((event) => event.clientPortalStatus === "unlocked");
}

export function clientEventMatchesFilter(
  event: PrismEvent,
  filter: "events-all" | "events-upcoming" | "events-in-planning" | "events-completed" | "events-cancelled",
): boolean {
  if (filter === "events-upcoming") return !event.archived && event.status !== "completed" && event.status !== "cancelled";
  if (filter === "events-in-planning") return !event.archived && /planning|confirmed|active|pending/i.test(event.status);
  if (filter === "events-completed") return /completed|closed|archived/i.test(event.status);
  if (filter === "events-cancelled") return /cancelled|canceled/i.test(event.status);
  return true;
}

export function selectSelectedClientEvent(
  events: PrismEvent[],
  eventId?: string,
  selectedEventId?: string | null,
): PrismEvent | undefined {
  if (eventId) return events.find((event) => event.id === eventId);
  return events.find((event) => event.id === selectedEventId) ?? events[0];
}

export function selectEventDrafts(
  state: Pick<PrismClientWorkspace, "floorPlanDrafts"> | null | undefined,
  selectedEvent?: Pick<PrismEvent, "id">,
): PrismFloorPlanDraft[] {
  if (!state || !selectedEvent) return [];
  return state.floorPlanDrafts.filter((draft) => draft.eventId === selectedEvent.id);
}

export function selectEventWorkspaceResources(
  state: Pick<
    PrismClientWorkspace,
    "auditLogs" | "billingDisputes" | "billingStatements" | "briefings" | "documents" | "notificationLogs" | "paymentMilestones"
  > | null | undefined,
  selectedEvent?: Pick<PrismEvent, "id">,
) {
  if (!state || !selectedEvent) {
    return {
      audit: [],
      billing: undefined,
      briefing: undefined,
      disputes: [],
      documents: [],
      notifications: [],
      payments: [],
    };
  }

  return {
    audit: state.auditLogs.filter((auditLog) => auditLog.eventId === selectedEvent.id).slice(0, 10),
    billing: state.billingStatements.find((statement) => statement.eventId === selectedEvent.id),
    briefing: state.briefings.find((briefing) => briefing.eventId === selectedEvent.id),
    disputes: (state.billingDisputes ?? []).filter((dispute) => dispute.eventId === selectedEvent.id),
    documents: state.documents.filter((document) => document.eventId === selectedEvent.id),
    notifications: state.notificationLogs.filter((notification) => notification.eventId === selectedEvent.id).slice(0, 4),
    payments: state.paymentMilestones.filter((payment) => payment.eventId === selectedEvent.id),
  };
}

export function selectOfficialDraft(eventDrafts: PrismFloorPlanDraft[]) {
  return eventDrafts.find((draft) => draft.isActive && draftIsOfficial(draft)) ?? eventDrafts.find(draftIsOfficial);
}

export function selectPreferenceDrafts(eventDrafts: PrismFloorPlanDraft[]) {
  return eventDrafts.filter(
    (draft) => draft.sourceType === "client_preference" && draft.createdByRole === "client",
  ).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    right.id.localeCompare(left.id),
  );
}

export function selectClientFloorPlanDraft(
  officialDraft: PrismFloorPlanDraft | undefined,
  preferenceDrafts: PrismFloorPlanDraft[],
) {
  const latestPreference = preferenceDrafts[0];
  return latestPreference?.status === "revision_requested" ? latestPreference : officialDraft ?? latestPreference;
}

export function selectClientDashboardActions(
  actionCenter: { items: PrismClientActionItem[] } | null | undefined,
  eventId?: string,
): ClientDashboardAction[] {
  if (!actionCenter || !eventId) return [];
  const priorityOrder = { critical: 0, warning: 1, attention: 2, info: 3 } as const;
  return actionCenter.items
    .filter((item) => item.eventId === eventId)
    .sort((left, right) => {
      const priority = priorityOrder[left.priority] - priorityOrder[right.priority];
      if (priority !== 0) return priority;
      const due = (left.dueAt ?? "").localeCompare(right.dueAt ?? "");
      if (due !== 0) return due;
      return left.id.localeCompare(right.id);
    })
    .map(actionCenterItemToDashboardAction);
}
