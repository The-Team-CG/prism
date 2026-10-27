import {
  Archive,
  Database,
  CalendarClock,
  CalendarDays,
  CircleUserRound,
  Contact,
  FileCheck2,
  FileSignature,
  Gamepad2,
  FileText,
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
export function loadingShellNavItems(inEventWorkspace: boolean): PrismNavItem[] {
  return eventPortalNavItems({ inEventWorkspace });
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
    { id: "event-planning", icon: FileCheck2, label: "Planning & decisions", section: eventSection },
    { id: "event-files", icon: FileText, label: "Files", section: eventSection },
    { id: "event-floorplans", icon: MapPinned, label: "Floorplans", section: eventSection, badge: optionalNavBadge(counts.draftCount) },
    { id: "event-suppliers", icon: Truck, label: "Suppliers", section: eventSection, badge: optionalNavBadge(counts.quoteCount) },
    { id: "event-staff", icon: UsersRound, label: "Team & roles", section: eventSection, badge: optionalNavBadge(counts.assignmentCount) },
    { id: "event-timeline", icon: Radio, label: "Live operations", section: eventSection },
    { id: "event-budget", icon: ReceiptText, label: "Billing", section: eventSection, badge: optionalNavBadge(counts.paymentCount) },
    { id: "event-report", icon: Archive, label: "Closure", section: eventSection, badge: optionalNavBadge(counts.closeoutCount) },
    { id: "event-games", icon: Gamepad2, label: "Registration & games", section: eventSection },
    { id: "event-messages", icon: MessageSquareText, label: "Messages", section: eventSection },
  ];
}

/**
 * PMCM navigation has two modes. On the all-events desk it lists PMCM's global work. Inside one event's
 * route it becomes that event's workspace, with All events and Inbox as the explicit way back.
 */
export function eventPortalNavItems({
  inEventWorkspace,
  eventName,
  inquiryCount,
  commandInboxCount,
  assignmentCount,
  quoteCount,
  draftCount,
  paymentCount,
  closeoutCount,
}: {
  inEventWorkspace: boolean;
  eventName?: string;
  inquiryCount?: number;
  commandInboxCount?: number | string;
  assignmentCount?: number;
  quoteCount?: number;
  draftCount?: number;
  paymentCount?: number;
  closeoutCount?: number;
}): PrismNavItem[] {
  const inbox: PrismNavItem = { id: "dashboard", icon: Inbox, label: "Inbox", section: "PMCM", badge: optionalNavBadge(commandInboxCount) };
  if (inEventWorkspace) {
    return [
      ...eventWorkspaceNavItems(eventWorkspaceSectionLabel(eventName), { assignmentCount, quoteCount, draftCount, paymentCount, closeoutCount }),
      { id: "events-list", icon: CalendarDays, label: "All events", section: "PMCM" },
      inbox,
    ];
  }
  return [
    inbox,
    { id: "inquiries", icon: FileSignature, label: "Inquiries", section: "PMCM", badge: optionalNavBadge(inquiryCount) },
    { id: "clients", icon: CircleUserRound, label: "Clients", section: "PMCM" },
    { id: "events-list", icon: CalendarDays, label: "Events", section: "PMCM" },
    { id: "calendar", icon: CalendarClock, label: "Calendar", section: "PMCM" },
    { id: "suppliers", icon: Tags, label: "Suppliers", section: "Network" },
    { id: "team", icon: Contact, label: "Team", section: "Network" },
    { id: "audit", icon: ShieldCheck, label: "Audit", section: "Administration" },
    { id: "privacy", icon: Database, label: "Privacy", section: "Administration" },
    { id: "settings", icon: Settings, label: "Settings", section: "Administration" },
  ];
}
