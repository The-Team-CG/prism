import {
  BadgeCheck,
  CalendarDays,
  FileText,
  Home,
  MessageSquareText,
  WalletCards,
} from "lucide-react";

import type { ClientDashboardRoute, ClientPortalView, ClientSidebarLink, ClientSidebarNavItem, ClientSidebarSubItem, DetailTab } from "./client-dashboard-types";

export const CLIENT_SIDEBAR_ITEMS: ClientSidebarNavItem[] = [
  {
    id: "client-dashboard",
    label: "Dashboard",
    icon: Home,
    section: "Client Portal",
    route: "home",
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
  { id: "event-floorplan", label: "Floor Plan", route: "floorplan", requiresEvent: true, eventScoped: true },
  { id: "event-approvals", label: "Approvals", route: "approvals", requiresEvent: true, eventScoped: true },
  { id: "event-billing", label: "Billing", route: "billing", requiresEvent: true, eventScoped: true },
  { id: "event-files", label: "Documents", route: "documents", requiresEvent: true, eventScoped: true },
  { id: "event-messages", label: "Messages", route: "messages", requiresEvent: true, eventScoped: true },
];

export const PORTAL_ROUTE_TO_NAV_ITEM: Partial<Record<ClientDashboardRoute, string>> = {
  home: "client-dashboard",
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
  details: "event-details",
  progress: "event-progress",
  schedule: "event-schedule",
  guests: "event-guests",
  preferences: "event-preferences",
  briefing: "event-preferences",
  floorplan: "event-floorplan",
  proposal: "event-approvals",
  documents: "event-files",
  billing: "event-billing",
  payments: "event-billing",
  messages: "event-messages",
  approvals: "event-approvals",
  files: "event-files",
  changes: "event-change-requests",
  summary: "event-final-summary",
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
  "dashboard-overview": { title: "Dashboard", description: "Client account overview, active events, and PMCM updates." },
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
  "calendar-meetings": { title: "Meetings", description: "PMCM meeting placeholders and follow-up timing." },
  "calendar-deadlines": { title: "Deadlines", description: "Planning deadlines and PMCM follow-up windows." },
  "calendar-payment-due-dates": { title: "Payment due dates", description: "Payment milestones across active events." },
  "calendar-approval-deadlines": { title: "Approval deadlines", description: "Client review windows for proposals, layouts, and documents." },
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

export function sidebarActiveItemId(
  route: ClientDashboardRoute,
  eventScoped: boolean,
  portalView?: ClientPortalView,
) {
  if (eventScoped) return "my-events";
  if (
    portalView &&
    !portalView.startsWith("events-") &&
    !portalView.startsWith("dashboard-") &&
    !portalView.startsWith("files-") &&
    !portalView.startsWith("calendar-")
  ) {
    return portalView;
  }
  return activeNavItemId(route, false);
}

export function dashboardHref(route: ClientDashboardRoute, eventId?: string, portalView?: ClientPortalView) {
  if (!eventId && portalView) return CLIENT_PORTAL_VIEW_HREFS[portalView];
  if (route === "home") return "/dashboard";
  if (route === "request") return "/dashboard/request";
  if (route === "events") return "/dashboard/events";
  if (!eventId && ["calendar", "approvals", "messages", "files", "billing"].includes(route)) {
    return `/dashboard/${route}`;
  }
  if (!eventId) return "/dashboard/events";
  const section =
    route === "floorplan" ? "floor-plan"
    : route === "payments" ? "billing"
    : route === "files" ? "documents"
    : route;
  return `/dashboard/events/${eventId}/${section}`;
}

export function dashboardLoadingVariant(route: ClientDashboardRoute) {
  if (route === "request" || route === "events" || route === "floorplan" || route === "messages" || route === "home") {
    return route;
  }
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
