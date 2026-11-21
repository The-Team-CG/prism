import { unreadNavBadge } from "@prism/ui/chat";
import { unreadNoticeBadge } from "@prism/ui/notifications";
import { countNavBadge } from "@prism/ui/nav-badge";
import type { PrismMobileBar } from "@prism/ui";
import { PRISM_NAV_ICONS } from "@prism/ui/nav-icons";
import {
  BadgeCheck,
  Bell,
  ClipboardList,
  CalendarDays,
  FileText,
  HelpCircle,
  PackageCheck,
  User,
  UserRound,
  ShieldCheck,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { supplierSectionHref, type SupplierDashboardSection } from "../model/supplier-workspace-types";

export function supplierNavItems(input: {
  needsActionCount: number;
  quoteNeedingSubmission: number;
  handoffPending: number;
  messagesUnread?: number;
  noticesUnread?: number;
  /** Payouts PMCM sent since the supplier last opened Payments. */
  newPayouts?: number;
}) {
  const items = [
    { id: "dashboard", label: "Today", icon: Warehouse, badge: input.needsActionCount || undefined },
    { id: "requests", label: "Requests & quotes", shortLabel: "Requests", icon: PRISM_NAV_ICONS.Requests, badge: input.quoteNeedingSubmission || undefined },
    { id: "bookings", label: "Bookings", icon: BadgeCheck, badge: input.handoffPending || undefined },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "messages", label: "Messages", icon: PRISM_NAV_ICONS.Messages, ...unreadNavBadge(input.messagesUnread) },
    { id: "notifications", label: "Notifications", icon: Bell, ...unreadNoticeBadge(input.noticesUnread) },
    { id: "files", label: "Files", icon: PRISM_NAV_ICONS.Files },
    { id: "payments", label: "Payments", icon: Wallet, ...countNavBadge(input.newPayouts, "new payment") },
    { id: "profile", label: "Services & profile", icon: User },
  ] as Array<{ id: SupplierDashboardSection; label: string; shortLabel?: string; icon: LucideIcon; badge?: string | number; badgeLabel?: string }>;
  return items.map((item) => ({ ...item, href: supplierSectionHref(item.id) }));
}

/** Quotations are a view of Requests & quotes, so that sidebar item stays active on either. */
export function supplierActiveNavId(section: SupplierDashboardSection): SupplierDashboardSection {
  return section === "quotations" ? "requests" : section;
}

/** Account, privacy and help live in the account menu, out of the way of daily work. */
export function supplierAccountMenuItems(onNavigate: (section: SupplierDashboardSection) => void) {
  return [
    { id: "account", label: "Account", icon: UserRound, onSelect: () => onNavigate("account") },
    { id: "privacy", label: "Privacy", icon: ShieldCheck, onSelect: () => onNavigate("privacy") },
    { id: "support", label: "Help & support", icon: HelpCircle, onSelect: () => onNavigate("support") },
  ];
}

export function supplierCommandActions(input: {
  quoteNeedingSubmission: number;
  openRequestCount: number;
  handoffPending: number;
  readinessInfoCount: number | null;
  onNavigate: (section: SupplierDashboardSection) => void;
}) {
  const requestLabel = input.quoteNeedingSubmission
    ? `${input.quoteNeedingSubmission} quote(s) need submission`
    : `${input.openRequestCount} open request(s)`;
  const bookingLabel = input.handoffPending
    ? "Booking handoff needs action"
    : input.readinessInfoCount != null
      ? `${input.readinessInfoCount} readiness item(s) monitored`
      : "Handoff is clear";
  const bookingPending = Boolean(input.handoffPending);

  return [
    {
      id: "requests",
      label: requestLabel,
      description: "Submit or revise before the deadline.",
      icon: ClipboardList,
      status: input.quoteNeedingSubmission ? "pending" : "completed",
      onSelect: () => input.onNavigate("requests"),
    },
    {
      id: "bookings",
      label: bookingLabel,
      description: "Confirm assignment, readiness, and contract.",
      icon: PackageCheck,
      status: bookingPending ? "pending" : "confirmed",
      onSelect: () => input.onNavigate("bookings"),
    },
  ];
}

/**
 * The phone bar: the day's work and the calendar within thumb reach, messages and notifications in the top bar, and
 * payments, files and the profile under More.
 */
export const SUPPLIER_MOBILE_BAR: PrismMobileBar = {
  tabs: ["dashboard", "requests", "bookings", "calendar"],
  header: ["messages", "notifications"],
};
