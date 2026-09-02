import {
  BadgeCheck,
  ClipboardList,
  CalendarDays,
  FileCheck2,
  FileText,
  HelpCircle,
  LogOut,
  MessageSquare,
  PackageCheck,
  User,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { SupplierDashboardSection } from "../model/supplier-workspace-types";

export function supplierNavItems(input: {
  needsActionCount: number;
  openRequestCount: number;
  handoffPending: number;
}) {
  return [
    { id: "dashboard", label: "Dashboard", icon: Warehouse, badge: input.needsActionCount || undefined },
    { id: "requests", label: "Requests", icon: ClipboardList, badge: input.openRequestCount || undefined },
    { id: "bookings", label: "Bookings", icon: BadgeCheck, badge: input.handoffPending || undefined },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "quotations", label: "Quotations", icon: FileText },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "files", label: "Files", icon: FileCheck2 },
    { id: "payments", label: "Payments", icon: Wallet },
    { id: "profile", label: "Services / Profile", icon: User },
    { id: "support", label: "Support", icon: HelpCircle },
  ] as Array<{ id: SupplierDashboardSection; label: string; icon: LucideIcon; badge?: number }>;
}

export function supplierCommandActions(input: {
  quoteNeedingSubmission: number;
  openRequestCount: number;
  handoffPending: number;
  readinessInfoCount: number | null;
  readinessNeedsActionCount: number;
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
  const bookingPending = Boolean(input.handoffPending || input.readinessNeedsActionCount);

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

export function supplierMobileActions(
  section: SupplierDashboardSection,
  onNavigate: (section: SupplierDashboardSection) => void,
  onSignOut: () => void,
) {
  return [
    { id: "requests", label: "Requests", icon: ClipboardList, active: section === "requests", onSelect: () => onNavigate("requests") },
    { id: "bookings", label: "Bookings", icon: BadgeCheck, active: section === "bookings", onSelect: () => onNavigate("bookings") },
    { id: "logout", label: "Sign out", icon: LogOut, onSelect: onSignOut },
  ];
}
