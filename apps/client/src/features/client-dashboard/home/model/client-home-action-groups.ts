import type { ClientDashboardAction } from "../../workspace/model/client-dashboard-view-rules";

export type ClientEventActionGroup = {
  eventId: string;
  eventName: string;
  /** Urgent or overdue items that hold the event back now. */
  now: ClientDashboardAction[];
  /** Items for a later stage that can wait. */
  later: ClientDashboardAction[];
};

/**
 * Groups the client's own actions by event, in the order the first action of each event appears, and
 * separates current blockers from later-stage requirements so two pending items read differently.
 */
export function groupClientActionsByEvent(actions: ClientDashboardAction[]): ClientEventActionGroup[] {
  const groups = new Map<string, ClientEventActionGroup>();
  for (const action of actions) {
    const eventId = action.eventId ?? "";
    const group = groups.get(eventId) ?? { eventId, eventName: action.eventName || "Your event", now: [], later: [] };
    (action.blocking ? group.now : group.later).push(action);
    groups.set(eventId, group);
  }
  return [...groups.values()];
}
