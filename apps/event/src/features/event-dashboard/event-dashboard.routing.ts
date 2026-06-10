import type { PmcmDetailTab } from "@/app/components/pmcm/event-command-cockpit";
export type DetailTab = PmcmDetailTab;
export type DashboardSection =
  | "dashboard"
  | "events"
  | "inquiries"
  | "events-list"
  | "clients"
  | "calendar"
  | "tasks"
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
  floorplans: "floorplans",
  briefing: "briefing",
  suppliers: "suppliers",
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

export const EVENT_WORKSPACE_ROUTE_TABS: Record<string, DetailTab> = {
  overview: "overview",
  "planning-checklist": "briefing",
  schedule: "live-ops",
  attendees: "live-ops",
  staff: "coordinators",
  suppliers: "suppliers",
  budget: "billing",
  files: "floorplans",
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
  floorplans: "event-files",
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
  "event-files": "floorplans",
  "event-messages": "activity",
  "event-timeline": "live-ops",
  "event-report": "closure",
};

export function routeStateFromPath(pathname: string): RouteState {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "dashboard") return { section: "dashboard", tab: "overview", view: "overview" };
  if (parts.length === 1) return { section: "dashboard", tab: "overview", view: "overview" };
  if (DASHBOARD_ROUTE_ITEMS[parts[1]]) {
    return { section: "dashboard", tab: "overview", view: parts[1] };
  }
  if (parts[1] === "inquiries") return { section: "inquiries", tab: "overview", view: "prospects" };
  if (parts[1] === "clients") {
    if (!parts[2]) return { section: "clients", tab: "overview", view: "all" };
    if (CLIENT_LIST_ROUTE_ITEMS[parts[2]]) return { section: "clients", tab: "overview", view: parts[2] };
    return {
      section: "clients",
      tab: "overview",
      clientId: decodeURIComponent(parts[2]),
      view: parts[3] ?? "overview",
    };
  }
  if (parts[1] === "events" && parts[2]) {
    if (EVENT_LIST_ROUTE_ITEMS[parts[2]]) return { section: "events-list", tab: "overview", view: parts[2] };
    const eventRoute = parts[3] ?? "overview";
    return {
      section: "events",
      eventId: decodeURIComponent(parts[2]),
      tab: EVENT_WORKSPACE_ROUTE_TABS[eventRoute] ?? EVENT_TAB_BY_ROUTE[eventRoute] ?? "overview",
      view: eventRoute,
    };
  }
  if (parts[1] === "events") return { section: "events-list", tab: "overview", view: "all" };
  if (parts[1] === "calendar") return { section: "calendar", tab: "overview", view: parts[2] ?? "all" };
  if (parts[1] === "tasks") return { section: "tasks", tab: "overview", view: parts[2] ?? "mine" };
  if (parts[1] === "team") return { section: "team", tab: "coordinators", view: parts[2] ?? "all" };
  if (parts[1] === "suppliers") return { section: "suppliers", tab: "overview", view: parts[2] ?? "all" };
  if (parts[1] === "files") return { section: "files", tab: "floorplans", view: parts[2] ?? "all" };
  if (parts[1] === "messages") return { section: "messages", tab: "activity", view: parts[2] ?? "inbox" };
  if (parts[1] === "finance") return { section: "finance", tab: "billing", view: parts[2] ?? "overview" };
  if (parts[1] === "audit") return { section: "audit", tab: "overview", view: "system-logs" };
  if (parts[1] === "settings" && parts[2] === "system-logs") return { section: "audit", tab: "overview", view: "system-logs" };
  if (parts[1] === "settings") return { section: "settings", tab: "overview", view: parts[2] ?? "organization-profile" };
  return { section: "dashboard", tab: "overview", view: "overview" };
}

