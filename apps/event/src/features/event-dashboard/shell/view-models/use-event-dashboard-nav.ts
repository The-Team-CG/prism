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
  const eventSection = eventName ? "Current event" : "Event workspace";
  return [
    { id: "dashboard", icon: Home, label: "Dashboard", section: "PMCM" },
    { id: "inquiries", icon: FileSignature, label: "Inquiries", section: "PMCM", badge: inquiryCount || undefined },
    { id: "clients", icon: CircleUserRound, label: "Clients", section: "PMCM" },
    { id: "events-list", icon: CalendarDays, label: "Events", section: "PMCM" },
    { id: "calendar", icon: CalendarClock, label: "Calendar", section: "PMCM" },
    { id: "tasks", icon: ClipboardCheck, label: "Tasks", section: "PMCM", badge: taskCount || undefined },
    { id: "command-inbox", icon: Inbox, label: "Command Inbox", section: "PMCM", badge: commandInboxCount || undefined },
    ...(hasEvent
      ? [
          { id: "event-overview", icon: LayoutGrid, label: "Overview", section: eventSection },
          { id: "event-planning", icon: FileCheck2, label: "Briefing", section: eventSection },
          { id: "event-files", icon: MapPinned, label: "Floorplans", section: eventSection, badge: draftCount || undefined },
          { id: "event-suppliers", icon: Truck, label: "Suppliers", section: eventSection, badge: quoteCount || undefined },
          { id: "event-staff", icon: UsersRound, label: "Coordinators", section: eventSection, badge: assignmentCount || undefined },
          { id: "event-timeline", icon: Radio, label: "Live Ops", section: eventSection },
          { id: "event-budget", icon: ReceiptText, label: "Billing", section: eventSection, badge: paymentCount || undefined },
          { id: "event-report", icon: Archive, label: "Closure", section: eventSection, badge: closeoutCount || undefined },
          { id: "event-messages", icon: MessageSquareText, label: "Activity", section: eventSection },
        ]
      : []),
    { id: "suppliers", icon: Tags, label: "Supplier Directory", section: "Management" },
    { id: "audit", icon: ShieldCheck, label: "Audit Trail", section: "System" },
    { id: "settings", icon: Settings, label: "Settings", section: "System" },
  ];
}
