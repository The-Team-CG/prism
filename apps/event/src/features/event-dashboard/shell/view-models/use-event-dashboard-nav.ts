import {
  Archive,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  CircleUserRound,
  FileCheck2,
  FileSignature,
  Home,
  Inbox,
  LayoutGrid,
  MapPinned,
  MessageSquareText,
  Radio,
  ReceiptText,
  Settings,
  ShieldCheck,
  Tags,
  Truck,
  UsersRound,
} from "lucide-react";
import { type PrismNavItem } from "@prism/ui";
import { eventWorkspaceSectionLabel, optionalNavBadge } from "../model/event-dashboard-nav-copy";

/**
 * Static PMCM dashboard nav configuration, extracted from
 * use-event-dashboard-shell-view-model.ts (see
 * docs/reviews/2026-09-01-fe-be-architecture-alignment.md, finding F3).
 * These are plain functions over their params — no React/Next dependency,
 * no hooks — kept separate from the VM's routing/data-loading concerns.
 */
export function loadingShellNavItems(hasEvent: boolean): PrismNavItem[] {
  return eventPortalNavItems({ hasEvent });
}

function eventWorkspaceNavItems(
  eventSection: string,
  counts: {
    assignmentCount?: number;
    quoteCount?: number;
    draftCount?: number;
    paymentCount?: number;
    closeoutCount?: number;
  },
): PrismNavItem[] {
  return [
    { id: "event-overview", icon: LayoutGrid, label: "Overview", section: eventSection },
    { id: "event-planning", icon: FileCheck2, label: "Briefing", section: eventSection },
    { id: "event-files", icon: MapPinned, label: "Floorplans", section: eventSection, badge: optionalNavBadge(counts.draftCount) },
    { id: "event-suppliers", icon: Truck, label: "Suppliers", section: eventSection, badge: optionalNavBadge(counts.quoteCount) },
    { id: "event-staff", icon: UsersRound, label: "Coordinators", section: eventSection, badge: optionalNavBadge(counts.assignmentCount) },
    { id: "event-timeline", icon: Radio, label: "Live Ops", section: eventSection },
    { id: "event-budget", icon: ReceiptText, label: "Billing", section: eventSection, badge: optionalNavBadge(counts.paymentCount) },
    { id: "event-report", icon: Archive, label: "Closure", section: eventSection, badge: optionalNavBadge(counts.closeoutCount) },
    { id: "event-messages", icon: MessageSquareText, label: "Activity", section: eventSection },
  ];
}

export function eventPortalNavItems({
  hasEvent,
  eventName,
  inquiryCount,
  taskCount,
  commandInboxCount,
  assignmentCount,
  quoteCount,
  draftCount,
  paymentCount,
  closeoutCount,
}: {
  hasEvent: boolean;
  eventName?: string;
  inquiryCount?: number;
  taskCount?: number;
  commandInboxCount?: number | string;
  assignmentCount?: number;
  quoteCount?: number;
  draftCount?: number;
  paymentCount?: number;
  closeoutCount?: number;
}): PrismNavItem[] {
  const eventSection = eventWorkspaceSectionLabel(eventName);
  const eventItems = hasEvent
    ? eventWorkspaceNavItems(eventSection, { assignmentCount, quoteCount, draftCount, paymentCount, closeoutCount })
    : [];
  return [
    { id: "dashboard", icon: Home, label: "Dashboard", section: "PMCM" },
    { id: "inquiries", icon: FileSignature, label: "Inquiries", section: "PMCM", badge: optionalNavBadge(inquiryCount) },
    { id: "clients", icon: CircleUserRound, label: "Clients", section: "PMCM" },
    { id: "events-list", icon: CalendarDays, label: "Events", section: "PMCM" },
    { id: "calendar", icon: CalendarClock, label: "Calendar", section: "PMCM" },
    { id: "tasks", icon: ClipboardCheck, label: "Tasks", section: "PMCM", badge: optionalNavBadge(taskCount) },
    { id: "command-inbox", icon: Inbox, label: "Command Inbox", section: "PMCM", badge: optionalNavBadge(commandInboxCount) },
    ...eventItems,
    { id: "suppliers", icon: Tags, label: "Supplier Directory", section: "Management" },
    { id: "audit", icon: ShieldCheck, label: "Audit Trail", section: "System" },
    { id: "settings", icon: Settings, label: "Settings", section: "System" },
  ];
}
