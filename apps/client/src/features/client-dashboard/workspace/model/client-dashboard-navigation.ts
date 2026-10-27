import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  FileText,
  Home,
  LayoutGrid,
  MapPinned,
  MessageSquareText,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import type { ClientDashboardRoute, ClientPortalView, ClientSidebarLink, ClientSidebarNavItem, ClientSidebarSubItem, DetailTab } from "./client-dashboard-types";

export const CLIENT_CONFORME_REVIEW_HREF = "/conforme";

export const CLIENT_SIDEBAR_ITEMS: ClientSidebarNavItem[] = [
  {
    id: "client-dashboard",
    label: "Home",
    icon: Home,
    section: "Client Portal",
    route: "home",
  },
  {
    id: "shared-floorplans",
    label: "Shared floorplans",
    icon: MapPinned,
    section: "Client Portal",
    route: "shared-floorplans",
  },
  {
    id: "my-events",
    label: "My Events",
    icon: CalendarDays,
    section: "Client Portal",
    route: "events",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: CalendarDays,
    section: "Client Portal",
    route: "calendar",
  },
  {
    id: "approvals",
    label: "Approvals",
    icon: BadgeCheck,
    section: "Client Portal",
    route: "approvals",
    subItems: [
      { id: "approvals-pending", label: "Pending", route: "approvals" },
      { id: "approvals-approved", label: "Approved", route: "approvals" },
      { id: "approvals-contracts", label: "Contracts", route: "files" },
    ],
  },
  {
    id: "messages",
    label: "Messages",
    icon: MessageSquareText,
    section: "Client Portal",
    route: "messages",
  },
  {
    id: "files",
    label: "Files",
    icon: FileText,
    section: "Client Portal",
    route: "files",
  },
  {
    id: "billing-payments",
    label: "Billing & Payments",
    icon: WalletCards,
    section: "Client Portal",
    route: "billing",
    subItems: [
      { id: "billing-overview", label: "Overview", route: "billing" },
      { id: "billing-payment-schedule", label: "Payment Schedule", route: "billing" },
      { id: "billing-balance", label: "Balance", route: "billing" },
    ],
  },
];

export const EVENT_WORKSPACE_NAV_ITEMS: ClientSidebarSubItem[] = [
  { id: "event-overview", label: "Overview", route: "overview", requiresEvent: true, eventScoped: true },
  { id: "event-progress", label: "Planning", route: "progress", requiresEvent: true, eventScoped: true },
  { id: "event-floorplan", label: "Floor plan", route: "floorplan", requiresEvent: true, eventScoped: true },
  { id: "event-approvals", label: "Approvals", route: "approvals", requiresEvent: true, eventScoped: true },
  { id: "event-billing", label: "Billing", route: "billing", requiresEvent: true, eventScoped: true },
  { id: "event-files", label: "Documents", route: "documents", requiresEvent: true, eventScoped: true },
  { id: "event-messages", label: "Messages", route: "messages", requiresEvent: true, eventScoped: true },
];

const EVENT_NAV_ICONS: Record<string, LucideIcon> = {
  "event-overview": LayoutGrid,
  "event-progress": ClipboardList,
  "event-floorplan": MapPinned,
  "event-approvals": BadgeCheck,
  "event-billing": WalletCards,
  "event-files": FileText,
  "event-messages": MessageSquareText,
};

/**
 * Inside one event the sidebar is that event's workspace, with My Events and Home as the way back,
 * instead of the portal sidebar plus a second row of tabs.
 */
export function clientEventSidebarItems(eventName: string) {
  return [
    ...EVENT_WORKSPACE_NAV_ITEMS.map((item) => ({ id: item.id, label: item.label, icon: EVENT_NAV_ICONS[item.id] ?? LayoutGrid, section: eventName })),
    { id: "my-events", label: "My Events", icon: CalendarDays, section: "Client portal" },
    { id: "client-dashboard", label: "Home", icon: Home, section: "Client portal" },
  ];
}

export function findClientEventNavItem(id: string) {
  return EVENT_WORKSPACE_NAV_ITEMS.find((item) => item.id === id);
}

export const PORTAL_ROUTE_TO_NAV_ITEM: Partial<Record<ClientDashboardRoute, string>> = {
  home: "client-dashboard",
  "shared-floorplans": "shared-floorplans",
  request: "client-dashboard",
  events: "my-events",
  calendar: "calendar",
  approvals: "approvals",
  files: "files",
  billing: "billing-payments",
  messages: "messages",
};

export const EVENT_ROUTE_TO_NAV_ITEM: Partial<Record<ClientDashboardRoute, string>> = {
  overview: "event-overview",
  actions: "event-progress",
  details: "event-overview",
  progress: "event-progress",
  schedule: "event-progress",
  guests: "event-progress",
  preferences: "event-progress",
  briefing: "event-progress",
  floorplan: "event-floorplan",
  proposal: "event-approvals",
  documents: "event-files",
  billing: "event-billing",
  payments: "event-billing",
  messages: "event-messages",
  approvals: "event-approvals",
  files: "event-files",
  changes: "event-progress",
  summary: "event-overview",
};

export const ROUTE_TO_DETAIL_TAB: Partial<Record<ClientDashboardRoute, DetailTab>> = {
  overview: "overview",
  actions: "overview",
  details: "overview",
  progress: "overview",
  schedule: "overview",
  guests: "briefing",
  preferences: "briefing",
  briefing: "briefing",
  proposal: "proposal",
  floorplan: "floorplan",
  documents: "documents",
  billing: "billing",
  payments: "billing",
  messages: "activity",
  approvals: "proposal",
  files: "documents",
  changes: "activity",
  summary: "overview",
};

export const DETAIL_TAB_TO_ROUTE: Record<DetailTab, ClientDashboardRoute> = {
  overview: "overview",
  activity: "messages",
  briefing: "briefing",
  proposal: "proposal",
  floorplan: "floorplan",
  documents: "documents",
  billing: "billing",
};

export const CLIENT_PORTAL_VIEW_HREFS: Record<ClientPortalView, string> = {
  "dashboard-overview": "/dashboard",
  "dashboard-upcoming-events": "/dashboard/events/upcoming",
  "dashboard-pending-approvals": "/dashboard/approvals/pending",
  "dashboard-recent-messages": "/dashboard/messages/recent",
  "dashboard-payment-reminders": "/dashboard/billing/payment-reminders",
  "events-all": "/dashboard/events",
  "events-upcoming": "/dashboard/events/upcoming",
  "events-in-planning": "/dashboard/events/in-planning",
  "events-completed": "/dashboard/events/completed",
  "events-cancelled": "/dashboard/events/cancelled",
  "events-draft-requests": "/dashboard/events/draft-requests",
  "calendar-event-dates": "/dashboard/calendar/event-dates",
  "calendar-meetings": "/dashboard/calendar/meetings",
  "calendar-deadlines": "/dashboard/calendar/deadlines",
  "calendar-payment-due-dates": "/dashboard/calendar/payment-due-dates",
  "calendar-approval-deadlines": "/dashboard/calendar/approval-deadlines",
  "approvals-pending": "/dashboard/approvals/pending",
  "approvals-approved": "/dashboard/approvals/approved",
  "approvals-needs-revision": "/dashboard/approvals/needs-revision",
  "approvals-contracts": "/dashboard/approvals/contracts",
  "approvals-quotations": "/dashboard/approvals/quotations",
  "approvals-final-confirmation": "/dashboard/approvals/final-confirmation",
  "messages-inbox": "/dashboard/messages/inbox",
  "messages-event-conversations": "/dashboard/messages/event-conversations",
  "messages-organizer-updates": "/dashboard/messages/organizer-updates",
  "messages-announcements": "/dashboard/messages/announcements",
  "messages-archived": "/dashboard/messages/archived",
  "files-all": "/dashboard/files",
  "files-contracts": "/dashboard/files/contracts",
  "files-quotations": "/dashboard/files/quotations",
  "files-invoices-receipts": "/dashboard/files/invoices-receipts",
  "files-event-layouts": "/dashboard/files/event-layouts",
  "files-uploaded": "/dashboard/files/uploaded",
  "files-shared": "/dashboard/files/shared",
  "billing-overview": "/dashboard/billing",
  "billing-quotations": "/dashboard/billing/quotations",
  "billing-invoices": "/dashboard/billing/invoices",
  "billing-payment-schedule": "/dashboard/billing/payment-schedule",
  "billing-payment-reminders": "/dashboard/billing/payment-reminders",
  "billing-receipts": "/dashboard/billing/receipts",
  "billing-balance": "/dashboard/billing/balance",
};

export const CLIENT_PORTAL_VIEW_META: Record<ClientPortalView, { title: string; description: string }> = {
  "dashboard-overview": { title: "Home", description: "Your events and the decisions that need your attention." },
  "dashboard-upcoming-events": { title: "Upcoming events", description: "Confirmed PMCM events that still need planning attention." },
  "dashboard-pending-approvals": { title: "Pending approvals", description: "Client-visible items waiting for approval or review." },
  "dashboard-recent-messages": { title: "Recent messages", description: "Recent PMCM updates and client-visible activity." },
  "dashboard-payment-reminders": { title: "Payment reminders", description: "Open payment milestones and upcoming due dates." },
  "events-all": { title: "All events", description: "Your confirmed PMCM event workspaces." },
  "events-upcoming": { title: "Upcoming events", description: "Events that are still ahead on the calendar." },
  "events-in-planning": { title: "In planning", description: "Events currently moving through PMCM planning." },
  "events-completed": { title: "Completed events", description: "Finished PMCM events in your client history." },
  "events-cancelled": { title: "Cancelled events", description: "Cancelled or stopped event workspaces." },
  "events-draft-requests": { title: "Draft requests", description: "Start or review event requests before PMCM activates a workspace." },
  "calendar-event-dates": { title: "Event dates", description: "Confirmed event dates across your client portal." },
  "calendar-meetings": { title: "Site visits", description: "Ocular visits PMCM has scheduled with you." },
  "calendar-deadlines": { title: "Due dates", description: "Payment due dates PMCM has set for your events." },
  "calendar-payment-due-dates": { title: "Payment due dates", description: "Payment milestones across active events." },
  "calendar-approval-deadlines": { title: "Approvals", description: "The days your event layouts were approved." },
  "approvals-pending": { title: "Pending approval", description: "Contracts, layouts, quotations, and final checks still awaiting action." },
  "approvals-approved": { title: "Approved", description: "Client-visible approvals already accepted for the selected event." },
  "approvals-needs-revision": { title: "Needs revision", description: "Items that need PMCM changes before approval." },
  "approvals-contracts": { title: "Contracts", description: "Conforme, MOA, NDA, and related contract files." },
  "approvals-quotations": { title: "Quotations", description: "Client-facing quotation and billing approval references." },
  "approvals-final-confirmation": { title: "Final confirmation", description: "Final client-facing readiness and confirmation status." },
  "messages-inbox": { title: "Inbox", description: "PMCM messages and client-visible notifications." },
  "messages-event-conversations": { title: "Event conversations", description: "Event-scoped PMCM updates and activity." },
  "messages-organizer-updates": { title: "Organizer updates", description: "Updates from the PMCM event team." },
  "messages-announcements": { title: "Announcements", description: "Broadcast-style notices for client review." },
  "messages-archived": { title: "Archived messages", description: "Older client-visible updates and audit notes." },
  "files-all": { title: "All files", description: "All client-visible files across active PMCM events." },
  "files-contracts": { title: "Contracts", description: "Conforme, MOA, NDA, and other contract files." },
  "files-quotations": { title: "Quotations", description: "Client-facing quotation files and references." },
  "files-invoices-receipts": { title: "Invoices / Receipts", description: "Invoices, billing statements, receipts, and payment proof." },
  "files-event-layouts": { title: "Event layouts", description: "Official layouts and client-safe floor plan files." },
  "files-uploaded": { title: "Uploaded files", description: "Client-submitted assets and requirements." },
  "files-shared": { title: "Shared files", description: "Files shared by PMCM for client reference." },
  "billing-overview": { title: "Billing & Payments", description: "Quotations, invoices, payment schedule, receipts, and balance." },
  "billing-quotations": { title: "Quotations", description: "Client-facing quotation and proposal billing references." },
  "billing-invoices": { title: "Invoices", description: "Billing statement and invoice records for the active event." },
  "billing-payment-schedule": { title: "Payment schedule", description: "Milestone due dates, payment status, and balances." },
  "billing-payment-reminders": { title: "Payment reminders", description: "Open payment milestones and upcoming reminders." },
  "billing-receipts": { title: "Receipts", description: "Recorded payment receipts and proof history." },
  "billing-balance": { title: "Balance", description: "Remaining balance and current payment status." },
};

function isPortalChromeView(portalView: ClientPortalView) {
  return (
    !portalView.startsWith("events-") &&
    !portalView.startsWith("dashboard-") &&
    !portalView.startsWith("files-") &&
    !portalView.startsWith("calendar-")
  );
}

export function sidebarActiveItemId(
  route: ClientDashboardRoute,
  eventScoped: boolean,
  portalView?: ClientPortalView,
) {
  if (eventScoped) return "my-events";
  if (portalView && isPortalChromeView(portalView)) return portalView;
  return activeNavItemId(route, false);
}

const PORTAL_HREFS: Partial<Record<ClientDashboardRoute, string>> = {
  home: "/dashboard",
  "shared-floorplans": "/dashboard/shared-floorplans",
  request: "/dashboard/request",
  events: "/dashboard/events",
  calendar: "/dashboard/calendar",
  approvals: "/dashboard/approvals",
  messages: "/dashboard/messages",
  files: "/dashboard/files",
  billing: "/dashboard/billing",
};

const EVENT_PATH_SEGMENT: Partial<Record<ClientDashboardRoute, string>> = {
  floorplan: "floor-plan",
  payments: "billing",
  files: "documents",
};

export function dashboardHref(route: ClientDashboardRoute, eventId?: string, portalView?: ClientPortalView) {
  if (!eventId && portalView) return CLIENT_PORTAL_VIEW_HREFS[portalView];
  if (!eventId) return PORTAL_HREFS[route] ?? "/dashboard/events";
  return `/dashboard/events/${eventId}/${EVENT_PATH_SEGMENT[route] ?? route}`;
}

export function clientEventCardOpenRoute(event: { archived: boolean }): ClientDashboardRoute {
  return event.archived ? "summary" : "overview";
}

export function clientEventWorkspaceAvailable(event: { archived: boolean } | undefined): boolean {
  return Boolean(event && !event.archived);
}

const LOADING_ROUTE_VARIANTS = {
  request: "request",
  events: "events",
  floorplan: "floorplan",
  messages: "messages",
  home: "home",
} as const;

type LoadingRouteVariant = keyof typeof LOADING_ROUTE_VARIANTS;

function isLoadingRouteVariant(route: ClientDashboardRoute): route is LoadingRouteVariant {
  return route in LOADING_ROUTE_VARIANTS;
}

export function dashboardLoadingVariant(route: ClientDashboardRoute) {
  if (isLoadingRouteVariant(route)) return LOADING_ROUTE_VARIANTS[route];
  return "event";
}

export function findClientSidebarLink(id: string): ClientSidebarLink | undefined {
  for (const item of CLIENT_SIDEBAR_ITEMS) {
    if (item.id === id) return item;
    const subItem = item.subItems?.find((candidate) => candidate.id === id);
    if (subItem) return subItem;
  }
  return undefined;
}

export function portalViewFromLink(item: ClientSidebarLink): ClientPortalView | undefined {
  return "icon" in item || item.eventScoped ? undefined : (item.id as ClientPortalView);
}

export function activeNavItemId(route: ClientDashboardRoute, eventScoped: boolean) {
  return (eventScoped ? EVENT_ROUTE_TO_NAV_ITEM[route] : PORTAL_ROUTE_TO_NAV_ITEM[route])
    ?? EVENT_ROUTE_TO_NAV_ITEM[route]
    ?? PORTAL_ROUTE_TO_NAV_ITEM[route]
    ?? "client-dashboard";
}
