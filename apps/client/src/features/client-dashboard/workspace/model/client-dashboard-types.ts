import type { LucideIcon } from "lucide-react";
import type { PrismUser } from "@prism/types";

export type ClientSession = PrismUser & { signedInAt: string };

export type DetailTab =
  | "overview"
  | "briefing"
  | "proposal"
  | "floorplan"
  | "billing"
  | "documents"
  | "activity";

export type ClientDashboardRoute =
  | "home"
  | "shared-floorplans"
  | "request"
  | "events"
  | "calendar"
  | "approvals"
  | "files"
  | "overview"
  | "actions"
  | "details"
  | "progress"
  | "schedule"
  | "guests"
  | "preferences"
  | "briefing"
  | "proposal"
  | "floorplan"
  | "documents"
  | "billing"
  | "payments"
  | "messages"
  | "changes"
  | "privacy"
  | "notifications"
  | "summary";

export type ClientPortalView =
  | "dashboard-overview"
  | "dashboard-upcoming-events"
  | "dashboard-pending-approvals"
  | "dashboard-payment-reminders"
  | "events-all"
  | "events-upcoming"
  | "events-in-planning"
  | "events-completed"
  | "events-cancelled"
  | "events-draft-requests"
  | "calendar-event-dates"
  | "calendar-meetings"
  | "calendar-deadlines"
  | "calendar-payment-due-dates"
  | "calendar-approval-deadlines"
  | "approvals-pending"
  | "approvals-approved"
  | "approvals-needs-revision"
  | "approvals-contracts"
  | "approvals-quotations"
  | "approvals-final-confirmation"
  | "files-all"
  | "files-contracts"
  | "files-quotations"
  | "files-invoices-receipts"
  | "files-event-layouts"
  | "billing-overview"
  | "billing-statements"
  | "billing-payment-schedule"
  | "billing-payment-reminders"
  | "billing-receipts"
  | "billing-balance";

export type ClientSidebarSubItem = {
  id: string;
  label: string;
  route: ClientDashboardRoute;
  requiresEvent?: boolean;
  eventScoped?: boolean;
};

export type ClientSidebarNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  section: string;
  route: ClientDashboardRoute;
  requiresEvent?: boolean;
  eventScoped?: boolean;
  subItems?: ClientSidebarSubItem[];
};

export type ClientSidebarLink = ClientSidebarNavItem | ClientSidebarSubItem;

export type ClientSidebarRenderSubItem = ClientSidebarSubItem & { disabled?: boolean };

export type ClientSidebarRenderItem = Omit<ClientSidebarNavItem, "subItems"> & {
  disabled?: boolean;
  subItems?: ClientSidebarRenderSubItem[];
};
