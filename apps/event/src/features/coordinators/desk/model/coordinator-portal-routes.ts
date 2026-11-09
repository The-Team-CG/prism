/**
 * The coordinator portal lives at one route, `/dashboard`, and names its view in `?view=`. PMCM and unknown
 * paths are not part of this portal and redirect home. Legacy `?section=coord-*` links are rewritten.
 */
export const COORDINATOR_HOME_PATH = "/dashboard";

export const COORDINATOR_VIEWS = ["shift", "tasks", "issues", "run-sheet", "calendar", "assignments", "registration", "notifications"] as const;
export type CoordinatorViewId = (typeof COORDINATOR_VIEWS)[number];

export const COORDINATOR_VIEW_LABELS: Record<CoordinatorViewId, string> = {
  shift: "My shift",
  tasks: "Tasks",
  issues: "Issues",
  "run-sheet": "Run sheet",
  calendar: "Calendar",
  assignments: "Assignments",
  registration: "Registration",
  notifications: "Notifications",
};

/** The section ids that older links and bookmarks carry. */
const LEGACY_SECTION_VIEWS: Record<string, CoordinatorViewId> = {
  "coord-home": "shift",
  "coord-queue": "tasks",
  "coord-issues": "issues",
  "coord-timeline": "run-sheet",
  "coord-assignments": "assignments",
  "coord-registration": "registration",
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
 * Where a coordinator's current URL must be corrected, or null when it is already canonical. Paths outside the
 * home route go home with the outside-portal notice. A `section` id is rewritten to its `view`, and an unknown one
 * goes to My shift with the notice.
 */
export function coordinatorLocationRedirect({ pathname, search }: { pathname: string; search: string }): { search: string } | null {
  const params = new URLSearchParams(search);
  const eventId = params.get("event");
  if (!isCoordinatorHomePath(pathname)) {
    return { search: coordinatorViewSearch("shift", eventId, OUTSIDE_PORTAL_NOTICE) };
  }
  const section = params.get("section");
  if (section === null) return null;
  const view = LEGACY_SECTION_VIEWS[section];
  return { search: coordinatorViewSearch(view ?? "shift", eventId, view ? undefined : OUTSIDE_PORTAL_NOTICE) };
}
