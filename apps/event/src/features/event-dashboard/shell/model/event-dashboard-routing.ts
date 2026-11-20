import { type PmcmDetailTab } from "@/features/command-inbox/list/views/event-command-cockpit";
import type { PrismEvent } from "@prism/types";
import { formatPortalDate } from "@prism/ui/format-date";
export type DetailTab = PmcmDetailTab;
export type DashboardSection =
  | "dashboard"
  | "events"
  | "inquiries"
  | "events-list"
  | "clients"
  | "calendar"
  | "team"
  | "suppliers"
  | "files"
  | "messages"
  | "notifications"
  | "finance"
  | "audit"
  | "privacy"
  | "account"
  | "settings";
export type RouteState = { section: DashboardSection; tab: DetailTab; eventId?: string; clientId?: string; view?: string };

export type EventDashboardClientProps = Partial<RouteState>;

/** An event's overview leads with the event itself, so the page title above it would only repeat the name. */
export function isEventOverviewRoute(state: RouteState): boolean {
  return state.section === "events" && Boolean(state.eventId) && state.tab === "overview";
}

const PRODUCT_NAME = "P.R.I.S.M";

/** Each event workspace tab has one canonical URL segment. Alias URLs redirect to these in next.config. */
export const EVENT_TAB_ROUTES: Record<DetailTab, string> = {
  overview: "overview",
  games: "registration",
  files: "files",
  floorplans: "floorplans",
  briefing: "briefing",
  suppliers: "suppliers",
  registration: "registration",
  coordinators: "coordinators",
  "live-ops": "live-ops",
  billing: "billing",
  closure: "closure",
  decisions: "decision-log",
  messages: "messages",
};

/** The route of one event workspace tab. The Games tab is the Registration route's `part=games` section. */
export function eventWorkspaceHref(eventId: string, tab: DetailTab = "overview"): string {
  const href = `/dashboard/events/${encodeURIComponent(eventId)}/${EVENT_TAB_ROUTES[tab]}`;
  return tab === "games" ? `${href}?part=games` : href;
}

export function clientDossierHref(clientId: string, view = "overview"): string {
  const href = `/dashboard/clients/${encodeURIComponent(clientId)}`;
  return view === "overview" ? href : `${href}/${view}`;
}

export const EVENT_TAB_BY_ROUTE = Object.fromEntries(
  Object.entries(EVENT_TAB_ROUTES).map(([tabId, route]) => [route, tabId]),
) as Record<string, DetailTab>;

/** The client dossier's tabs, in display order. Each one is its own URL. */
export const CLIENT_DOSSIER_VIEWS: ReadonlyArray<{ view: string; label: string }> = [
  { view: "overview", label: "Overview" },
  { view: "history", label: "History" },
  { view: "contacts", label: "Contacts" },
];

export const CLIENT_DETAIL_ROUTES: Record<string, string> = {
  "client-overview": "overview",
  "client-events": "history",
  "client-contacts": "contacts",
  "client-files": "files",
  "client-messages": "messages",
  "client-contracts": "contracts",
  "client-invoices": "invoices",
  "client-notes": "notes",
  "client-activity": "activity-log",
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

/** Canonical event workspace segments → tab. `run-sheet` is its own page that renders the live operations tab. */
export const EVENT_WORKSPACE_ROUTE_TABS: Record<string, DetailTab> = {
  ...EVENT_TAB_BY_ROUTE,
  "run-sheet": "live-ops",
};

/** Canonical event workspace segments → sidebar item. Alias segments are not listed; they redirect. */
export const EVENT_WORKSPACE_ROUTE_ITEMS: Record<string, string> = {
  overview: "event-overview",
  registration: "event-games",
  briefing: "event-planning",
  "decision-log": "event-planning",
  floorplans: "event-floorplans",
  suppliers: "event-suppliers",
  coordinators: "event-staff",
  billing: "event-budget",
  files: "event-files",
  messages: "event-messages",
  "live-ops": "event-timeline",
  "run-sheet": "event-timeline",
  closure: "event-report",
};

/** Sub-views that filter their section. Calendar, Messages, Files, Finance and Settings have none and redirect to their parent. */
export const SECTION_ROUTE_ITEMS: Record<string, Record<string, string>> = {
  team: {
    all: "team-all",
    availability: "team-availability",
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
  },
  finance: { receipts: "finance-receipts", "payment-details": "finance-payment-details" },
};

export const SIDEBAR_STATIC_ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  inquiries: "/dashboard/inquiries",
  clients: "/dashboard/clients",
  "events-list": "/dashboard/events",
  calendar: "/dashboard/calendar",
  messages: "/dashboard/messages",
  notifications: "/dashboard/notifications",
  files: "/dashboard/files",
  team: "/dashboard/team",
  suppliers: "/dashboard/suppliers",
  finance: "/dashboard/finance",
  audit: "/dashboard/audit",
  privacy: "/dashboard/privacy",
  account: "/dashboard/account",
  settings: "/dashboard/settings",
  "events-all": "/dashboard/events",
  "events-upcoming": "/dashboard/events/upcoming",
  "events-ongoing": "/dashboard/events/ongoing",
  "events-completed": "/dashboard/events/completed",
  "events-cancelled": "/dashboard/events/cancelled",
  "events-draft": "/dashboard/events/draft",
  "events-by-client": "/dashboard/events/by-client",
  "events-by-type": "/dashboard/events/by-event-type",
  "team-all": "/dashboard/team",
  "team-availability": "/dashboard/team/availability",
  "team-archived": "/dashboard/team/archived",
  "suppliers-all": "/dashboard/suppliers",
  "suppliers-preferred": "/dashboard/suppliers/preferred",
  "suppliers-venues": "/dashboard/suppliers/venues",
  "suppliers-catering": "/dashboard/suppliers/catering",
  "suppliers-media": "/dashboard/suppliers/photography-videography",
  "suppliers-lights": "/dashboard/suppliers/lights-sounds",
  "suppliers-decor": "/dashboard/suppliers/decorations",
  "suppliers-transport": "/dashboard/suppliers/transportation",
  "finance-receipts": "/dashboard/finance/receipts",
  "finance-payment-details": "/dashboard/finance/payment-details",
};

export const EVENT_DETAIL_ROUTES: Record<string, string> = {
  "event-overview": "overview",
  "event-planning": "briefing",
  "event-staff": "coordinators",
  "event-suppliers": "suppliers",
  "event-budget": "billing",
  "event-files": "files",
  "event-floorplans": "floorplans",
  "event-messages": "messages",
  "event-timeline": "live-ops",
  "event-report": "closure",
  "event-games": "registration",
};

export function dashboardRouteState(view = "overview"): RouteState {
  return { section: "dashboard", tab: "overview", view };
}

export function eventRouteState(eventId: string, view = "overview"): RouteState {
  return {
    section: "events",
    eventId,
    tab: EVENT_WORKSPACE_ROUTE_TABS[view] ?? "overview",
    view,
  };
}

const SIDEBAR_ITEM_TO_STATE: Record<string, RouteState> = {
  dashboard: dashboardRouteState(),
  inquiries: { section: "inquiries", tab: "overview", view: "prospects" },
  clients: { section: "clients", tab: "overview", view: "all" },
  "events-list": { section: "events-list", tab: "overview", view: "all" },
  calendar: { section: "calendar", tab: "overview", view: "all" },
  team: { section: "team", tab: "coordinators", view: "all" },
  suppliers: { section: "suppliers", tab: "overview", view: "all" },
  files: { section: "files", tab: "floorplans", view: "all" },
  messages: { section: "messages", tab: "messages", view: "inbox" },
  notifications: { section: "notifications", tab: "overview", view: "all" },
  finance: { section: "finance", tab: "billing", view: "overview" },
  audit: { section: "audit", tab: "overview", view: "system-logs" },
  privacy: { section: "privacy", tab: "overview", view: "console" },
  account: { section: "account", tab: "overview", view: "me" },
  settings: { section: "settings", tab: "overview", view: "organization-profile" },
};

for (const [view, itemId] of Object.entries(EVENT_LIST_ROUTE_ITEMS)) {
  SIDEBAR_ITEM_TO_STATE[itemId] = eventListRouteState(view);
}
for (const [section, items] of Object.entries(SECTION_ROUTE_ITEMS)) {
  for (const [view, itemId] of Object.entries(items)) {
    SIDEBAR_ITEM_TO_STATE[itemId] = { section: section as DashboardSection, tab: "overview", view };
  }
}

/**
 * The sidebar item that owns a route. Sections without a sidebar entry (Tasks, Files, Messages, Finance
 * outside an event) return undefined, so no unrelated item such as Inbox is highlighted.
 */
const SECTION_SIDEBAR_ITEM: Partial<Record<DashboardSection, string>> = {
  dashboard: "dashboard",
  suppliers: "suppliers",
  audit: "audit",
  privacy: "privacy",
  clients: "clients",
  calendar: "calendar",
  notifications: "notifications",
  settings: "settings",
  inquiries: "inquiries",
  "events-list": "events-list",
  team: "team",
  finance: "finance",
};

const EVENT_SCOPED_SIDEBAR_ITEM: Partial<Record<DashboardSection, string>> = {
  team: "event-staff",
  files: "event-files",
  messages: "event-messages",
  finance: "event-budget",
};

const ROUTE_LOADING_COPY: Partial<Record<DashboardSection, { title: string }>> = {
  suppliers: { title: "Suppliers" },
  audit: { title: "Audit" },
  privacy: { title: "Privacy" },
  clients: { title: "Clients" },
  calendar: { title: "Calendar" },
  team: { title: "Team" },
  files: { title: "Event File Hub" },
  messages: { title: "Event Messages" },
  notifications: { title: "Notifications" },
  finance: { title: "Finance Desk" },
  inquiries: { title: "Inquiries" },
  "events-list": { title: "Events" },
  account: { title: "Account" },
  settings: { title: "Workspace settings" },
};

export function routeStateForSidebarItem(id: string): RouteState | undefined {
  return SIDEBAR_ITEM_TO_STATE[id];
}

export function activeSidebarItemFromRoute(routeState: RouteState): string | undefined {
  // Receipts and payment details are not tied to an event, so each keeps its own highlight even if an event was selected before.
  const financeItem = routeState.section === "finance" && routeState.view ? SECTION_ROUTE_ITEMS.finance[routeState.view] : undefined;
  if (financeItem) return financeItem;
  const eventScopedItem = EVENT_SCOPED_SIDEBAR_ITEM[routeState.section];
  if (eventScopedItem && routeState.eventId) return eventScopedItem;
  const sectionItem = SECTION_SIDEBAR_ITEM[routeState.section];
  if (sectionItem) return sectionItem;
  if (!routeState.eventId) return undefined;
  return EVENT_WORKSPACE_ROUTE_ITEMS[routeState.view ?? "overview"]
    ?? EVENT_WORKSPACE_ROUTE_ITEMS[EVENT_TAB_ROUTES[routeState.tab]]
    ?? "event-overview";
}

export function routeLoadingShellCopy(routeState: RouteState) {
  const copy = ROUTE_LOADING_COPY[routeState.section];
  if (copy) return copy;
  if (routeState.eventId) return { title: "Event workspace" };
  return { title: "Event Manager" };
}

export type EventDashboardShellCopy = {
  title: string;
  description: string;
  /** Breadcrumb labels after the role. Sections without a sidebar entry are named here. */
  breadcrumb: string[];
  /** The browser tab title, e.g. "Planning & decisions · Ayala Summit · P.R.I.S.M". */
  documentTitle: string;
};

const ROUTE_DESCRIPTIONS: Partial<Record<DashboardSection, string>> = {
  suppliers: "Who PMCM books, how often, how they are rated, and what PMCM is missing for each.",
  audit: "Complete audit trail of all actions, approvals, and system events.",
  privacy: "Privacy requests with 30-day deadlines, owners, execution, legal holds, and retention policies.",
  clients: "Every client contact, with their events and inquiries.",
  calendar: "Event days, quote deadlines, payments, ocular visits and supplier schedules across events. Click an item to open its event.",
  team: "PMCM coordinators, their roles and availability. Assign them inside each event.",
  files: "Operational documents, official floorplans, billing statements, contracts, and closeout records.",
  messages: "Client, supplier, coordinator, and internal PMCM communication threads.",
  notifications: "What changed across your events, what is new since you last looked, and what asks you to confirm receipt. Every notice opens its item.",
  finance: "What needs you across events: money overdue, to verify and to apply, disputes, and what PMCM owes suppliers.",
  account: "Who you are, how you sign in, and how PMCM reaches you.",
  settings: "Workspace preferences, account context, notification defaults, and role-safe system controls.",
  inquiries: "From first contact to a signed conforme. Each step opens its list.",
  "events-list": "Every confirmed event. Open one to work inside it.",
  dashboard: "What needs PMCM, across every event. Every item opens the work it belongs to.",
};

/** Copy for a view that has its own page inside a section, keyed `section:view`. */
const VIEW_SHELL_COPY: Record<string, EventDashboardShellCopy> = {
  "finance:receipts": {
    title: "Payments received",
    description: "Money clients paid outside P.R.I.S.M, checked against the statement and applied to the milestones it settles.",
    breadcrumb: ["Finance", "Receipts"],
    documentTitle: "Receipts · Finance · P.R.I.S.M",
  },
  "finance:payment-details": {
    title: "Payment details",
    description: "Where clients are told to send money: your bank accounts, e-wallets and cheque payee, with the QR they scan.",
    breadcrumb: ["Finance", "Payment details"],
    documentTitle: "Payment details · Finance · P.R.I.S.M",
  },
};

const ROUTE_TITLES: Partial<Record<DashboardSection, string>> = {
  dashboard: "Inbox",
  suppliers: "Suppliers",
  audit: "Audit",
  privacy: "Privacy",
  account: "Account",
  settings: "Workspace settings",
  calendar: "Calendar",
  files: "Files",
  messages: "Messages",
  notifications: "Notifications",
  finance: "Finance",
  team: "Team",
  inquiries: "Inquiries",
};

/** The browser tab title for a page: its named parts, then the product, e.g. "Suppliers · P.R.I.S.M". */
export function pageDocumentTitle(parts: Array<string | undefined>): string {
  return [...parts.filter((part): part is string => Boolean(part)), PRODUCT_NAME].join(" · ");
}

export function routeShellCopy(
  routeState: RouteState,
  options: {
    activeNavLabel?: string;
    selectedEvent?: Pick<PrismEvent, "eventName" | "clientName" | "eventDate">;
    selectedClient?: { name: string };
  } = {},
): EventDashboardShellCopy {
  const loadingCopy = routeLoadingShellCopy(routeState);
  const sectionLabel = options.activeNavLabel;
  if (routeState.eventId) {
    const event = options.selectedEvent;
    return {
      title: sectionLabel ?? "Event workspace",
      description: event
        ? [event.eventName, `${event.clientName} · ${formatPortalDate(event.eventDate)}`].filter(Boolean).join(" · ")
        : "Select an event or accept an inquiry to begin.",
      breadcrumb: ["Events", event?.eventName, sectionLabel].filter((part): part is string => Boolean(part)),
      documentTitle: pageDocumentTitle([sectionLabel, event?.eventName]),
    };
  }

  if (routeState.section === "clients" && options.selectedClient) {
    const clientName = options.selectedClient.name;
    return {
      title: clientName,
      description: ROUTE_DESCRIPTIONS.clients ?? "",
      breadcrumb: ["Clients", clientName],
      documentTitle: pageDocumentTitle(["Clients", clientName]),
    };
  }

  const viewCopy = VIEW_SHELL_COPY[`${routeState.section}:${routeState.view}`];
  if (viewCopy) return viewCopy;

  const title = ROUTE_TITLES[routeState.section] ?? sectionLabel ?? loadingCopy.title;
  return {
    title,
    description: ROUTE_DESCRIPTIONS[routeState.section] ?? "Select an event or accept an inquiry to begin.",
    breadcrumb: [title],
    documentTitle: pageDocumentTitle([title]),
  };
}

// Sections that render from their own scoped reads (approval requests, the inbox, the supplier workspace)
// and must not wait for the PMCM reference.
const SCOPED_READ_SECTIONS: ReadonlySet<DashboardSection> = new Set(["dashboard", "suppliers"]);

/** Every other section renders from the PMCM reference (plus its own scoped reads); none reads whole-system state. */
export function sectionNeedsPmcmReference(section: DashboardSection): boolean {
  return !SCOPED_READ_SECTIONS.has(section);
}

/**
 * The route a sidebar destination opens, so the shell renders it as a real link (new tab, copy link).
 * Event sections need an event; without one they stay buttons and the click handler chooses.
 */
export function eventSidebarItemHref(id: string, eventId?: string | null): string | undefined {
  const staticRoute = SIDEBAR_STATIC_ROUTES[id];
  if (staticRoute) return staticRoute;
  const segment = EVENT_DETAIL_ROUTES[id];
  if (!segment || !eventId) return undefined;
  return `/dashboard/events/${encodeURIComponent(eventId)}/${segment}`;
}
