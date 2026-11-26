/**
 * The coordinator portal lives at its own route, `/coordinator`, and names its view in `?view=`. PMCM works under
 * `/dashboard`; a coordinator who lands there is sent here.
 */
export const COORDINATOR_HOME_PATH = "/coordinator";

/** Where the coordinator portal lived before it had its own route; its `?view=&event=` links still work. */
const LEGACY_COORDINATOR_HOME_PATH = "/dashboard";

export const COORDINATOR_VIEWS = ["shift", "tasks", "issues", "run-sheet", "calendar", "assignments", "registration", "games", "notifications", "messages", "account"] as const;
export type CoordinatorViewId = (typeof COORDINATOR_VIEWS)[number];

export const COORDINATOR_VIEW_LABELS: Record<CoordinatorViewId, string> = {
  shift: "Now",
  tasks: "Tasks",
  issues: "Issues",
  "run-sheet": "Run sheet",
  calendar: "Calendar",
  assignments: "Assignments",
  registration: "Registration",
  games: "Games",
  notifications: "Notifications",
  messages: "Messages",
  account: "Account",
};

export const OUTSIDE_PORTAL_NOTICE = "outside-portal";

export function coordinatorViewFromParam(value: string | null): CoordinatorViewId {
  return value && (COORDINATOR_VIEWS as readonly string[]).includes(value) ? (value as CoordinatorViewId) : "shift";
}

/** The query string for a coordinator view, e.g. `?view=tasks&event=evt_1`. */
export function coordinatorViewSearch(view: CoordinatorViewId, eventId?: string | null, notice?: string): string {
  const params = new URLSearchParams({ view });
  if (eventId) params.set("event", eventId);
  if (notice) params.set("notice", notice);
  return `?${params.toString()}`;
}

export function isCoordinatorHomePath(pathname: string): boolean {
  return (pathname.replace(/\/+$/, "") || "/") === COORDINATOR_HOME_PATH;
}

/**
 * Where a coordinator's current URL must be corrected, or null when it is already canonical. The old home and its
 * Messages page keep their view and event; other PMCM paths go home with the outside-portal notice. A `section` id is
 * rewritten to its `view`, and an unknown one goes to Now with the notice.
 */
export function coordinatorLocationRedirect({ pathname, search }: { pathname: string; search: string }): { search: string } | null {
  const params = new URLSearchParams(search);
  const eventId = params.get("event");
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === `${LEGACY_COORDINATOR_HOME_PATH}/messages`) {
    params.set('view', 'messages');
    return { search: `?${params.toString()}` };
  }
  if (path === LEGACY_COORDINATOR_HOME_PATH && params.get("section") === null) return { search };
  if (!isCoordinatorHomePath(pathname)) {
    return { search: coordinatorViewSearch("shift", eventId, OUTSIDE_PORTAL_NOTICE) };
  }
  if (params.get("section") === null) return null;
  return { search: coordinatorViewSearch("shift", eventId, OUTSIDE_PORTAL_NOTICE) };
}
