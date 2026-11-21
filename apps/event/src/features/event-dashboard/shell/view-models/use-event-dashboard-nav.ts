import { unreadNavBadge } from "@prism/ui/chat";
import { unreadNoticeBadge } from "@prism/ui/notifications";
import {
  Archive,
  Banknote,
  Bell,
  QrCode,
  Landmark,
  Database,
  CircleUserRound,
  Contact,
  FileSignature,
  Gamepad2,
  FileText,
  Inbox,
  LayoutGrid,
  MapPinned,
  MessageSquareText,
  Radio,
  Settings,
  ShieldCheck,
  Truck,
  UsersRound,
} from "lucide-react";
import type { PrismMobileBar, PrismNavItem } from "@prism/ui";
import { PRISM_NAV_ICONS } from "@prism/ui/nav-icons";
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

/**
 * PMCM's phone bar. On the desk: the inbox, events, inquiries and the calendar, with notifications in the top bar and
 * the network, finance and administration under More. Inside an event: what PMCM checks on the move, with the event's
 * messages in the top bar and the rest of the workspace, plus the way back, under More.
 */
export function pmcmMobileBar(inEventWorkspace: boolean): PrismMobileBar {
  return inEventWorkspace
    ? { tabs: ["event-overview", "event-planning", "event-suppliers", "event-timeline"], header: ["event-messages"] }
    : { tabs: ["dashboard", "events-list", "inquiries", "calendar"], header: ["notifications"] };
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
    /** Unread messages in the open event's conversations; shown on that event's Messages item. */
    unreadMessages?: number;
  },
): PrismNavItem[] {
  const preEvent = !stage || isBeforePrismEventDay(stage);
  return [
    { id: "event-overview", icon: LayoutGrid, label: "Overview", section: PREPARE },
    { id: "event-planning", icon: PRISM_NAV_ICONS.Planning, label: "Planning & decisions", shortLabel: "Planning", section: PREPARE },
    { id: "event-floorplans", icon: MapPinned, label: "Floorplans", section: PREPARE, badge: optionalNavBadge(counts.draftCount) },
    { id: "event-suppliers", icon: Truck, label: "Suppliers", section: PREPARE, badge: optionalNavBadge(counts.quoteCount) },
    { id: "event-staff", icon: UsersRound, label: "Team & roles", section: PREPARE, badge: optionalNavBadge(counts.assignmentCount) },
    { id: "event-budget", icon: PRISM_NAV_ICONS.Billing, label: "Billing", section: PREPARE, badge: optionalNavBadge(counts.paymentCount) },
    { id: "event-files", icon: FileText, label: "Files", section: PREPARE },
    { id: "event-messages", icon: MessageSquareText, label: "Messages", section: PREPARE, ...unreadNavBadge(counts.unreadMessages) },
    { id: "event-games", icon: Gamepad2, label: "Registration & games", section: EVENT_DAY },
    { id: "event-timeline", icon: Radio, label: "Live operations", shortLabel: "Live", section: EVENT_DAY },
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
  financeCount,
  assignmentCount,
  quoteCount,
  draftCount,
  paymentCount,
  closeoutCount,
  unreadMessages,
  unreadNotices,
}: {
  inEventWorkspace: boolean;
  eventStage?: PrismLifecycleStage;
  /** FR-24: modules PMCM switched off for the selected event. */
  disabledModules?: readonly string[];
  inquiryCount?: number;
  commandInboxCount?: number | string;
  /** Money work waiting on PMCM across events: overdue, to verify or apply, disputes, late payouts. */
  financeCount?: number;
  assignmentCount?: number;
  quoteCount?: number;
  draftCount?: number;
  paymentCount?: number;
  closeoutCount?: number;
  /** Unread messages in the open event's conversations. */
  unreadMessages?: number;
  /** Notifications the account has not opened, across every event. */
  unreadNotices?: number;
}): PrismNavItem[] {
  const inbox: PrismNavItem = { id: "dashboard", icon: Inbox, label: "Inbox", section: "PMCM", badge: optionalNavBadge(commandInboxCount) };
  if (inEventWorkspace) {
    return [
      ...eventWorkspaceNavItems(eventStage, { assignmentCount, quoteCount, draftCount, paymentCount, closeoutCount, unreadMessages })
        .filter((item) => item.id !== "event-floorplans" || !disabledModules.includes("floorplans")),
      { id: "events-list", icon: PRISM_NAV_ICONS["All events"], label: "All events", section: "Back to" },
      { ...inbox, section: "Back to" },
    ];
  }
  return [
    inbox,
    { id: "inquiries", icon: FileSignature, label: "Inquiries", section: "PMCM", badge: optionalNavBadge(inquiryCount) },
    { id: "clients", icon: CircleUserRound, label: "Clients", section: "PMCM" },
    { id: "events-list", icon: PRISM_NAV_ICONS.Events, label: "Events", section: "PMCM" },
    { id: "calendar", icon: PRISM_NAV_ICONS.Calendar, label: "Calendar", section: "PMCM" },
    { id: "notifications", icon: Bell, label: "Notifications", section: "PMCM", ...unreadNoticeBadge(unreadNotices) },
    { id: "suppliers", icon: PRISM_NAV_ICONS.Suppliers, label: "Suppliers", section: "Network" },
    { id: "team", icon: Contact, label: "Team", section: "Network" },
    { id: "finance", icon: Landmark, label: "Finance", section: "Finance", badge: optionalNavBadge(financeCount) },
    { id: "finance-receipts", icon: Banknote, label: "Receipts", section: "Finance" },
    { id: "finance-payment-details", icon: QrCode, label: "Payment details", section: "Finance" },
    { id: "audit", icon: ShieldCheck, label: "Audit", section: "Administration" },
    { id: "privacy", icon: Database, label: "Privacy", section: "Administration" },
    { id: "settings", icon: Settings, label: "Settings", section: "Administration" },
  ];
}
