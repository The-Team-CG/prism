import { unreadNavBadge } from "@prism/ui/chat";
import {
  Archive,
  Banknote,
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
import { isBeforePrismEventDay, type PrismLifecycleStage } from "@prism/types";
import { optionalNavBadge } from "../model/event-dashboard-nav-copy";

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

const PREPARE = "Prepare";
const EVENT_DAY = "Event day & after";

/**
 * Event tabs in the order the work happens. Preparation comes first; event-day and closure tabs are grouped
 * after it, and closure counts stay hidden until the event day so planning-stage events do not look overdue.
 */
function eventWorkspaceNavItems(
  stage: PrismLifecycleStage | undefined,
  counts: {
    assignmentCount?: number;
    quoteCount?: number;
    draftCount?: number;
    paymentCount?: number;
    closeoutCount?: number;
    /** The account's unread messages across every conversation; shown on Messages in an event. */
    unreadMessages?: number;
  },
): PrismNavItem[] {
  const preEvent = !stage || isBeforePrismEventDay(stage);
  return [
    { id: "event-overview", icon: LayoutGrid, label: "Overview", section: PREPARE },
    { id: "event-planning", icon: FileCheck2, label: "Planning & decisions", section: PREPARE },
    { id: "event-floorplans", icon: MapPinned, label: "Floorplans", section: PREPARE, badge: optionalNavBadge(counts.draftCount) },
    { id: "event-suppliers", icon: Truck, label: "Suppliers", section: PREPARE, badge: optionalNavBadge(counts.quoteCount) },
    { id: "event-staff", icon: UsersRound, label: "Team & roles", section: PREPARE, badge: optionalNavBadge(counts.assignmentCount) },
    { id: "event-budget", icon: ReceiptText, label: "Billing", section: PREPARE, badge: optionalNavBadge(counts.paymentCount) },
    { id: "event-files", icon: FileText, label: "Files", section: PREPARE },
    { id: "event-messages", icon: MessageSquareText, label: "Messages", section: PREPARE, ...unreadNavBadge(counts.unreadMessages) },
    { id: "event-games", icon: Gamepad2, label: "Registration & games", section: EVENT_DAY },
    { id: "event-timeline", icon: Radio, label: "Live operations", section: EVENT_DAY },
    { id: "event-report", icon: Archive, label: "Closure", section: EVENT_DAY, badge: preEvent ? undefined : optionalNavBadge(counts.closeoutCount) },
  ];
}

/**
 * PMCM navigation has two modes. On the all-events desk it lists PMCM's global work. Inside one event's
 * route it becomes that event's workspace, with All events and Inbox as the explicit way back.
 */
export function eventPortalNavItems({
  inEventWorkspace,
  eventStage,
  disabledModules = [],
  inquiryCount,
  commandInboxCount,
  assignmentCount,
  quoteCount,
  draftCount,
  paymentCount,
  closeoutCount,
  unreadMessages,
}: {
  inEventWorkspace: boolean;
  eventStage?: PrismLifecycleStage;
  /** FR-24: modules PMCM switched off for the selected event. */
  disabledModules?: readonly string[];
  inquiryCount?: number;
  commandInboxCount?: number | string;
  assignmentCount?: number;
  quoteCount?: number;
  draftCount?: number;
  paymentCount?: number;
  closeoutCount?: number;
  unreadMessages?: number;
}): PrismNavItem[] {
  const inbox: PrismNavItem = { id: "dashboard", icon: Inbox, label: "Inbox", section: "PMCM", badge: optionalNavBadge(commandInboxCount) };
  if (inEventWorkspace) {
    return [
      ...eventWorkspaceNavItems(eventStage, { assignmentCount, quoteCount, draftCount, paymentCount, closeoutCount, unreadMessages })
        .filter((item) => item.id !== "event-floorplans" || !disabledModules.includes("floorplans")),
      { id: "events-list", icon: CalendarDays, label: "All events", section: "Back to" },
      { ...inbox, section: "Back to" },
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
    { id: "finance-receipts", icon: Banknote, label: "Receipts", section: "Finance" },
    { id: "audit", icon: ShieldCheck, label: "Audit", section: "Administration" },
    { id: "privacy", icon: Database, label: "Privacy", section: "Administration" },
    { id: "settings", icon: Settings, label: "Settings", section: "Administration" },
  ];
}
