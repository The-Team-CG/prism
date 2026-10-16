import type { PmcmDetailTab } from "@/features/command-inbox/list";
import type { PrismEvent } from "@prism/types";
export type DetailTab = PmcmDetailTab;
export type DashboardSection =
  | "dashboard"
  | "events"
  | "inquiries"
  | "events-list"
  | "clients"
  | "calendar"
  | "tasks"
  | "command-inbox"
  | "team"
  | "suppliers"
  | "files"
  | "messages"
  | "finance"
  | "audit"
  | "settings";
export type RouteState = { section: DashboardSection; tab: DetailTab; eventId?: string; clientId?: string; view?: string };

export type EventDashboardClientProps = Partial<RouteState>;

export const EVENT_TAB_ROUTES: Record<DetailTab, string> = {
  overview: "overview",
  games: "games",
  files: "files",
  floorplans: "floorplans",
  briefing: "briefing",
  suppliers: "suppliers",
  registration: "registration",
  coordinators: "coordinators",
  "live-ops": "live-ops",
  billing: "billing",
  closure: "closure",
  activity: "activity",
};

export const EVENT_TAB_BY_ROUTE = Object.fromEntries(
  Object.entries(EVENT_TAB_ROUTES).map(([tabId, route]) => [route, tabId]),
) as Record<string, DetailTab>;

export const DASHBOARD_ROUTE_ITEMS: Record<string, string> = {
  overview: "dashboard-overview",
  "upcoming-events": "dashboard-upcoming",
  "pending-tasks": "dashboard-pending",
  "recent-messages": "dashboard-messages",
  "financial-summary": "dashboard-finance",
};

export const CLIENT_LIST_ROUTE_ITEMS: Record<string, string> = {
  all: "clients-all",
  active: "clients-active",
  prospects: "clients-prospects",
  past: "clients-past",
  archived: "clients-archived",
};

export const CLIENT_DETAIL_ROUTE_ITEMS: Record<string, string> = {
  overview: "client-overview",
  events: "client-events",
  contacts: "client-contacts",
  files: "client-files",
  messages: "client-messages",
  contracts: "client-contracts",
  invoices: "client-invoices",
  notes: "client-notes",
  "activity-log": "client-activity",
};

export const EVENT_LIST_ROUTE_ITEMS: Record<string, string> = {
  all: "events-all",
  upcoming: "events-upcoming",
  ongoing: "events-ongoing",
  completed: "events-completed",
  cancelled: "events-cancelled",
  draft: "events-draft",
  "by-client": "events-by-client",
  "by-event-type": "events-by-type",
};

export function isEventListView(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(EVENT_LIST_ROUTE_ITEMS, value);
}

export function eventListRouteState(view = "all"): RouteState {
  return { section: "events-list", tab: "overview", view: isEventListView(view) ? view : "all" };
}

export const EVENT_WORKSPACE_ROUTE_TABS: Record<string, DetailTab> = {
  overview: "overview",
  games: "games",
  "planning-checklist": "briefing",
  schedule: "live-ops",
  attendees: "live-ops",
  staff: "coordinators",
  suppliers: "suppliers",
  registration: "registration",
  budget: "billing",
  files: "files",
  messages: "activity",
  timeline: "live-ops",
  "post-event-report": "closure",
  floorplans: "floorplans",
  briefing: "briefing",
  coordinators: "coordinators",
  "live-ops": "live-ops",
  billing: "billing",
  closure: "closure",
  activity: "activity",
};

export const EVENT_WORKSPACE_ROUTE_ITEMS: Record<string, string> = {
  overview: "event-overview",
  games: "event-games",
  "planning-checklist": "event-planning",
  briefing: "event-planning",
  schedule: "event-timeline",
  attendees: "event-timeline",
  staff: "event-staff",
  coordinators: "event-staff",
  suppliers: "event-suppliers",
  budget: "event-budget",
  billing: "event-budget",
  files: "event-files",
  floorplans: "event-floorplans",
  messages: "event-messages",
  activity: "event-messages",
  timeline: "event-timeline",
  "live-ops": "event-timeline",
  "post-event-report": "event-report",
  closure: "event-report",
};

export const SECTION_ROUTE_ITEMS: Record<string, Record<string, string>> = {
  calendar: {
    all: "calendar-all",
    events: "calendar-events",
    "task-deadlines": "calendar-tasks",
    "client-meetings": "calendar-clients",
    "staff-availability": "calendar-team",
    "supplier-bookings": "calendar-suppliers",
    "payment-due-dates": "calendar-payments",
  },
  tasks: {
    mine: "tasks-my",
    all: "tasks-all",
    overdue: "tasks-overdue",
    "due-today": "tasks-today",
    "due-this-week": "tasks-week",
    "assigned-to-me": "tasks-assigned",
    "by-client": "tasks-by-client",
    "by-event": "tasks-by-event",
    templates: "tasks-templates",
  },
  messages: {
    inbox: "messages-inbox",
    client: "messages-client",
    event: "messages-event",
    team: "messages-team",
    approvals: "messages-approvals",
    announcements: "messages-announcements",
    archived: "messages-archived",
  },
  files: {
    all: "files-all",
    client: "files-client",
    event: "files-event",
    contracts: "files-contracts",
    quotations: "files-quotations",
    invoices: "files-invoices",
    "floor-plans": "files-floorplans",
    permits: "files-permits",
    media: "files-media",
    archived: "files-archived",
  },
  team: {
    all: "team-all",
    roles: "team-roles",
    availability: "team-availability",
    assignments: "team-assignments",
    workload: "team-workload",
    departments: "team-departments",
    archived: "team-archived",
  },
  suppliers: {
    all: "suppliers-all",
    preferred: "suppliers-preferred",
    venues: "suppliers-venues",
    catering: "suppliers-catering",
    "photography-videography": "suppliers-media",
    "lights-sounds": "suppliers-lights",
    decorations: "suppliers-decor",
    transportation: "suppliers-transport",
    contracts: "suppliers-contracts",
    payments: "suppliers-payments",
  },
  finance: {
    overview: "finance-overview",
    quotations: "finance-quotations",
    invoices: "finance-invoices",
    payments: "finance-payments",
    expenses: "finance-expenses",
    "client-balances": "finance-balances",
    "event-profit-loss": "finance-profit",
    reports: "finance-reports",
  },
  settings: {
    "organization-profile": "settings-organization",
    "users-permissions": "settings-users",
    roles: "settings-roles",
    "event-types": "settings-event-types",
    "task-templates": "settings-task-templates",
    "message-templates": "settings-message-templates",
    "file-categories": "settings-file-categories",
    "notification-settings": "settings-notifications",
    "system-logs": "settings-system-logs",
  },
};

export const SIDEBAR_STATIC_ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  inquiries: "/dashboard/inquiries",
  clients: "/dashboard/clients",
  "events-list": "/dashboard/events",
  calendar: "/dashboard/calendar",
  tasks: "/dashboard/tasks",
  messages: "/dashboard/messages",
  files: "/dashboard/files",
  team: "/dashboard/team",
  suppliers: "/dashboard/suppliers",
  finance: "/dashboard/finance",
  audit: "/dashboard/audit",
  settings: "/dashboard/settings",
  "dashboard-overview": "/dashboard",
  "dashboard-upcoming": "/dashboard/upcoming-events",
  "dashboard-pending": "/dashboard/pending-tasks",
  "dashboard-messages": "/dashboard/recent-messages",
  "dashboard-finance": "/dashboard/financial-summary",
  "clients-all": "/dashboard/clients",
  "clients-active": "/dashboard/clients/active",
  "clients-prospects": "/dashboard/clients/prospects",
  "clients-past": "/dashboard/clients/past",
  "clients-archived": "/dashboard/clients/archived",
  "events-all": "/dashboard/events",
  "events-upcoming": "/dashboard/events/upcoming",
  "events-ongoing": "/dashboard/events/ongoing",
  "events-completed": "/dashboard/events/completed",
  "events-cancelled": "/dashboard/events/cancelled",
  "events-draft": "/dashboard/events/draft",
  "events-by-client": "/dashboard/events/by-client",
  "events-by-type": "/dashboard/events/by-event-type",
  "calendar-all": "/dashboard/calendar",
  "calendar-events": "/dashboard/calendar/events",
  "calendar-tasks": "/dashboard/calendar/task-deadlines",
  "calendar-clients": "/dashboard/calendar/client-meetings",
  "calendar-team": "/dashboard/calendar/staff-availability",
  "calendar-suppliers": "/dashboard/calendar/supplier-bookings",
  "calendar-payments": "/dashboard/calendar/payment-due-dates",
  "command-inbox": "/dashboard/command-inbox",
  "tasks-my": "/dashboard/tasks",
  "tasks-all": "/dashboard/tasks/all",
  "tasks-overdue": "/dashboard/tasks/overdue",
  "tasks-today": "/dashboard/tasks/due-today",
  "tasks-week": "/dashboard/tasks/due-this-week",
  "tasks-assigned": "/dashboard/tasks/assigned-to-me",
  "tasks-by-client": "/dashboard/tasks/by-client",
  "tasks-by-event": "/dashboard/tasks/by-event",
  "tasks-templates": "/dashboard/tasks/templates",
  "messages-inbox": "/dashboard/messages",
  "messages-client": "/dashboard/messages/client",
  "messages-event": "/dashboard/messages/event",
  "messages-team": "/dashboard/messages/team",
  "messages-approvals": "/dashboard/messages/approvals",
  "messages-announcements": "/dashboard/messages/announcements",
  "messages-archived": "/dashboard/messages/archived",
  "files-all": "/dashboard/files",
  "files-client": "/dashboard/files/client",
  "files-event": "/dashboard/files/event",
  "files-contracts": "/dashboard/files/contracts",
  "files-quotations": "/dashboard/files/quotations",
  "files-invoices": "/dashboard/files/invoices",
  "files-floorplans": "/dashboard/files/floor-plans",
  "files-permits": "/dashboard/files/permits",
  "files-media": "/dashboard/files/media",
  "files-archived": "/dashboard/files/archived",
  "team-all": "/dashboard/team",
  "team-roles": "/dashboard/team/roles",
  "team-availability": "/dashboard/team/availability",
  "team-assignments": "/dashboard/team/assignments",
  "team-workload": "/dashboard/team/workload",
  "team-departments": "/dashboard/team/departments",
  "team-archived": "/dashboard/team/archived",
  "suppliers-all": "/dashboard/suppliers",
  "suppliers-preferred": "/dashboard/suppliers/preferred",
  "suppliers-venues": "/dashboard/suppliers/venues",
  "suppliers-catering": "/dashboard/suppliers/catering",
  "suppliers-media": "/dashboard/suppliers/photography-videography",
  "suppliers-lights": "/dashboard/suppliers/lights-sounds",
  "suppliers-decor": "/dashboard/suppliers/decorations",
  "suppliers-transport": "/dashboard/suppliers/transportation",
  "suppliers-contracts": "/dashboard/suppliers/contracts",
  "suppliers-payments": "/dashboard/suppliers/payments",
  "finance-overview": "/dashboard/finance",
  "finance-quotations": "/dashboard/finance/quotations",
  "finance-invoices": "/dashboard/finance/invoices",
  "finance-payments": "/dashboard/finance/payments",
  "finance-expenses": "/dashboard/finance/expenses",
  "finance-balances": "/dashboard/finance/client-balances",
  "finance-profit": "/dashboard/finance/event-profit-loss",
  "finance-reports": "/dashboard/finance/reports",
  "settings-organization": "/dashboard/settings",
  "settings-users": "/dashboard/settings/users-permissions",
  "settings-roles": "/dashboard/settings/roles",
  "settings-event-types": "/dashboard/settings/event-types",
  "settings-task-templates": "/dashboard/settings/task-templates",
  "settings-message-templates": "/dashboard/settings/message-templates",
  "settings-file-categories": "/dashboard/settings/file-categories",
  "settings-notifications": "/dashboard/settings/notification-settings",
  "settings-system-logs": "/dashboard/settings/system-logs",
};

export const CLIENT_DETAIL_ROUTES: Record<string, string> = {
  "client-overview": "overview",
  "client-events": "events",
  "client-contacts": "contacts",
  "client-files": "files",
  "client-messages": "messages",
  "client-contracts": "contracts",
  "client-invoices": "invoices",
  "client-notes": "notes",
  "client-activity": "activity-log",
};

export const EVENT_DETAIL_ROUTES: Record<string, string> = {
  "event-overview": "overview",
  "event-planning": "briefing",
  "event-schedule": "live-ops",
  "event-attendees": "live-ops",
  "event-staff": "coordinators",
  "event-suppliers": "suppliers",
  "event-budget": "billing",
  "event-files": "files",
  "event-floorplans": "floorplans",
  "event-messages": "activity",
  "event-timeline": "live-ops",
  "event-report": "closure",
  "event-games": "games",
};

export function dashboardRouteState(view = "overview"): RouteState {
  return { section: "dashboard", tab: "overview", view };
}

export function eventRouteState(eventId: string, view = "overview"): RouteState {
  return {
    section: "events",
    eventId,
    tab: EVENT_WORKSPACE_ROUTE_TABS[view] ?? EVENT_TAB_BY_ROUTE[view] ?? "overview",
    view,
  };
}

const SECTION_VIEW_TAB: Partial<Record<DashboardSection, DetailTab>> = {
  messages: "activity",
  finance: "billing",
};

const SIDEBAR_ITEM_TO_STATE: Record<string, RouteState> = {
  dashboard: dashboardRouteState(),
  inquiries: { section: "inquiries", tab: "overview", view: "prospects" },
  clients: { section: "clients", tab: "overview", view: "all" },
  "events-list": { section: "events-list", tab: "overview", view: "all" },
  calendar: { section: "calendar", tab: "overview", view: "all" },
  tasks: { section: "tasks", tab: "overview", view: "mine" },
  "command-inbox": { section: "command-inbox", tab: "overview", view: "all" },
  team: { section: "team", tab: "coordinators", view: "all" },
  suppliers: { section: "suppliers", tab: "overview", view: "all" },
  files: { section: "files", tab: "floorplans", view: "all" },
  messages: { section: "messages", tab: "activity", view: "inbox" },
  finance: { section: "finance", tab: "billing", view: "overview" },
  audit: { section: "audit", tab: "overview", view: "system-logs" },
  settings: { section: "settings", tab: "overview", view: "organization-profile" },
};

for (const [view, itemId] of Object.entries(DASHBOARD_ROUTE_ITEMS)) {
  SIDEBAR_ITEM_TO_STATE[itemId] = dashboardRouteState(view);
}
for (const [view, itemId] of Object.entries(CLIENT_LIST_ROUTE_ITEMS)) {
  SIDEBAR_ITEM_TO_STATE[itemId] = { section: "clients", tab: "overview", view };
}
for (const [view, itemId] of Object.entries(EVENT_LIST_ROUTE_ITEMS)) {
  SIDEBAR_ITEM_TO_STATE[itemId] = eventListRouteState(view);
}
for (const [section, items] of Object.entries(SECTION_ROUTE_ITEMS)) {
  const tab = SECTION_VIEW_TAB[section as DashboardSection] ?? "overview";
  for (const [view, itemId] of Object.entries(items)) {
    SIDEBAR_ITEM_TO_STATE[itemId] = { section: section as DashboardSection, tab, view };
  }
}

SIDEBAR_ITEM_TO_STATE["settings-system-logs"] = { section: "audit", tab: "overview", view: "system-logs" };

const SECTION_SIDEBAR_ITEM: Partial<Record<DashboardSection, string>> = {
  dashboard: "dashboard",
  suppliers: "suppliers",
  audit: "audit",
  clients: "clients",
  calendar: "calendar",
  tasks: "tasks",
  "command-inbox": "command-inbox",
  settings: "settings",
  inquiries: "inquiries",
  "events-list": "events-list",
};

const EVENT_SCOPED_SIDEBAR_ITEM: Partial<Record<DashboardSection, string>> = {
  team: "event-staff",
  files: "event-files",
  messages: "event-messages",
  finance: "event-budget",
};

const ROUTE_LOADING_COPY: Partial<Record<DashboardSection, { eyebrow: string; title: string }>> = {
  suppliers: { eyebrow: "Supplier directory", title: "Supplier Directory" },
  audit: { eyebrow: "Audit log", title: "Audit Trail" },
  clients: { eyebrow: "Clients", title: "Client Desk" },
  calendar: { eyebrow: "Calendar", title: "Calendar" },
  tasks: { eyebrow: "Tasks", title: "Tasks" },
  "command-inbox": { eyebrow: "Command inbox", title: "Command Inbox" },
  team: { eyebrow: "Team", title: "Team & Coordinators" },
  files: { eyebrow: "Files", title: "Event File Hub" },
  messages: { eyebrow: "Messages", title: "Event Messages" },
  finance: { eyebrow: "Finance", title: "Finance Desk" },
  inquiries: { eyebrow: "Inquiries", title: "Inquiry Intake" },
  "events-list": { eyebrow: "Events", title: "All Events" },
  settings: { eyebrow: "Settings", title: "Settings" },
};

export function routeStateForSidebarItem(id: string): RouteState | undefined {
  return SIDEBAR_ITEM_TO_STATE[id];
}

export function activeSidebarItemFromRoute(routeState: RouteState) {
  const scopedItem = EVENT_SCOPED_SIDEBAR_ITEM[routeState.section];
  if (scopedItem) return routeState.eventId ? scopedItem : "dashboard";
  const sectionItem = SECTION_SIDEBAR_ITEM[routeState.section];
  if (sectionItem) return sectionItem;
  if (!routeState.eventId) return "dashboard";
  return EVENT_WORKSPACE_ROUTE_ITEMS[routeState.view ?? "overview"]
    ?? EVENT_WORKSPACE_ROUTE_ITEMS[EVENT_TAB_ROUTES[routeState.tab]]
    ?? "event-overview";
}

export function routeLoadingShellCopy(routeState: RouteState) {
  const copy = ROUTE_LOADING_COPY[routeState.section];
  if (copy) return copy;
  if (routeState.eventId) return { eyebrow: "Event workspace", title: "Event workspace" };
  return { eyebrow: "Command home", title: "Event Manager" };
}

export type EventDashboardShellCopy = {
  eyebrow: string;
  title: string;
  description: string;
};

const ROUTE_DESCRIPTIONS: Partial<Record<DashboardSection, string>> = {
  suppliers: "Master supplier directory with category tagging, tiering, and performance reviews.",
  audit: "Complete audit trail of all actions, approvals, and system events.",
  clients: "Client intake, conforme status, approval requests, and portal readiness.",
  calendar: "Event dates, planning windows, supplier deadlines, and onsite schedule checkpoints.",
  tasks: "PMCM actions across inquiries, approvals, planning, finance, live operations, and closure.",
  "command-inbox": "Prioritized action queue across inquiries, suppliers, billing, coordinators, and closure.",
  team: "Coordinator roster, assignment coverage, availability, and event-day staffing.",
  files: "Operational documents, official floorplans, billing statements, contracts, and closeout records.",
  messages: "Client, supplier, coordinator, and internal PMCM communication threads.",
  finance: "Billing statements, payment milestones, balances, and statement delivery.",
  settings: "Workspace preferences, account context, notification defaults, and role-safe system controls.",
  inquiries: "Review, accept, pend, or decline incoming event inquiries.",
  "events-list": "Confirmed event workspaces ready for planning and operations.",
  dashboard: "Active event workspaces, inquiry intake, and client onboarding.",
};

const ROUTE_TITLES: Partial<Record<DashboardSection, string>> = {
  suppliers: "Supplier Directory",
  audit: "Audit Trail",
  "command-inbox": "Command Inbox",
  team: "Team & Coordinators",
  inquiries: "Inquiry Intake",
};

export function routeShellCopy(
  routeState: RouteState,
  options: {
    activeNavLabel?: string;
    selectedEvent?: Pick<PrismEvent, "eventName" | "clientName" | "eventDate">;
  } = {},
): EventDashboardShellCopy {
  const loadingCopy = routeLoadingShellCopy(routeState);
  if (routeState.eventId) {
    return {
      eyebrow: loadingCopy.eyebrow,
      title: options.selectedEvent?.eventName ?? "Event Manager",
      description: options.selectedEvent
        ? `${options.selectedEvent.clientName} — ${options.selectedEvent.eventDate}`
        : "Select an event or accept an inquiry to begin.",
    };
  }

  return {
    eyebrow: loadingCopy.eyebrow,
    title: ROUTE_TITLES[routeState.section] ?? options.activeNavLabel ?? loadingCopy.title,
    description: ROUTE_DESCRIPTIONS[routeState.section] ?? "Select an event or accept an inquiry to begin.",
  };
}

const DEFAULT_DASHBOARD_ROUTE: RouteState = { section: "dashboard", tab: "overview", view: "overview" };

function parseClientsPath(parts: string[]): RouteState {
  if (!parts[2]) return { section: "clients", tab: "overview", view: "all" };
  if (CLIENT_LIST_ROUTE_ITEMS[parts[2]]) return { section: "clients", tab: "overview", view: parts[2] };
  return {
    section: "clients",
    tab: "overview",
    clientId: decodeURIComponent(parts[2]),
    view: parts[3] ?? "overview",
  };
}

function parseEventsPath(parts: string[]): RouteState {
  if (!parts[2]) return { section: "events-list", tab: "overview", view: "all" };
  if (isEventListView(parts[2])) return eventListRouteState(parts[2]);
  const eventRoute = parts[3] ?? "overview";
  return {
    section: "events",
    eventId: decodeURIComponent(parts[2]),
    tab: EVENT_WORKSPACE_ROUTE_TABS[eventRoute] ?? EVENT_TAB_BY_ROUTE[eventRoute] ?? "overview",
    view: eventRoute,
  };
}

function parseSettingsPath(parts: string[]): RouteState {
  if (parts[2] === "system-logs") return { section: "audit", tab: "overview", view: "system-logs" };
  return { section: "settings", tab: "overview", view: parts[2] ?? "organization-profile" };
}

const PATH_SECTION_PARSERS: Record<string, (parts: string[]) => RouteState> = {
  inquiries: () => ({ section: "inquiries", tab: "overview", view: "prospects" }),
  clients: parseClientsPath,
  events: parseEventsPath,
  calendar: (parts) => ({ section: "calendar", tab: "overview", view: parts[2] ?? "all" }),
  tasks: (parts) => ({ section: "tasks", tab: "overview", view: parts[2] ?? "mine" }),
  "command-inbox": () => ({ section: "command-inbox", tab: "overview", view: "all" }),
  team: (parts) => ({ section: "team", tab: "coordinators", view: parts[2] ?? "all" }),
  suppliers: (parts) => ({ section: "suppliers", tab: "overview", view: parts[2] ?? "all" }),
  files: (parts) => ({ section: "files", tab: "floorplans", view: parts[2] ?? "all" }),
  messages: (parts) => ({ section: "messages", tab: "activity", view: parts[2] ?? "inbox" }),
  finance: (parts) => ({ section: "finance", tab: "billing", view: parts[2] ?? "overview" }),
  audit: () => ({ section: "audit", tab: "overview", view: "system-logs" }),
  settings: parseSettingsPath,
};

/**
 * Compatibility parser for legacy deep links. New App Router pages pass
 * explicit route state and do not parse pathname strings in a ViewModel.
 */
export function routeStateFromPath(pathname: string): RouteState {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "dashboard" || parts.length === 1) return DEFAULT_DASHBOARD_ROUTE;
  if (DASHBOARD_ROUTE_ITEMS[parts[1]]) {
    return { section: "dashboard", tab: "overview", view: parts[1] };
  }
  const parse = PATH_SECTION_PARSERS[parts[1]];
  return parse ? parse(parts) : DEFAULT_DASHBOARD_ROUTE;
}

