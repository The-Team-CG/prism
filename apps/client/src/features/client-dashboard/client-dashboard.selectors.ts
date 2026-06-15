import type {
  PrismClientWorkspace,
  PrismEvent,
  PrismFloorPlanDraft,
  PrismUser,
} from "@prism/types";

export function selectClientEvents(
  state: Pick<PrismClientWorkspace, "events"> | null | undefined,
  session: Pick<PrismUser, "name"> | null | undefined,
): PrismEvent[] {
  if (!state || !session) return [];
  return state.events.filter(
    (event) => event.clientName === session.name && !event.archived && event.clientPortalStatus === "unlocked",
  );
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
    "auditLogs" | "billingStatements" | "briefings" | "documents" | "notificationLogs" | "paymentMilestones"
  > | null | undefined,
  selectedEvent?: Pick<PrismEvent, "id">,
) {
  if (!state || !selectedEvent) {
    return {
      audit: [],
      billing: undefined,
      briefing: undefined,
      documents: [],
      notifications: [],
      payments: [],
    };
  }

  return {
    audit: state.auditLogs.filter((auditLog) => auditLog.eventId === selectedEvent.id).slice(0, 10),
    billing: state.billingStatements.find((statement) => statement.eventId === selectedEvent.id),
    briefing: state.briefings.find((briefing) => briefing.eventId === selectedEvent.id),
    documents: state.documents.filter((document) => document.eventId === selectedEvent.id),
    notifications: state.notificationLogs.filter((notification) => notification.eventId === selectedEvent.id).slice(0, 4),
    payments: state.paymentMilestones.filter((payment) => payment.eventId === selectedEvent.id),
  };
}
