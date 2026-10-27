"use client";

import { cn } from "./utils";

type StatusTier = "success" | "pending" | "danger" | "default";

const STATUS_MAP: Record<string, StatusTier> = {
  approved: "success",
  paid: "success",
  resolved: "success",
  confirmed: "success",
  verified: "success",
  active: "success",
  completed: "success",
  in_review: "pending",
  client_submitted: "pending",
  issued: "pending",
  submitted: "pending",
  awaiting: "pending",
  pending: "pending",
  open: "danger",
  at_risk: "danger",
  overdue: "danger",
  rejected: "danger",
  cancelled: "danger",
};

const TIER_CLASSES: Record<StatusTier, string> = {
  success: "bg-success/10 text-success ring-success/20",
  pending: "bg-attention/10 text-attention ring-attention/20",
  danger:  "bg-danger/10 text-danger ring-danger/20",
  default: "bg-primary/10 text-primary ring-primary/15",
};

export function statusClass(status: string): string {
  const tier = STATUS_MAP[status] ?? "default";
  return TIER_CLASSES[tier];
}

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const display = (label ?? status).replaceAll("_", " ");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-2xs font-bold capitalize ring-1",
        statusClass(status),
        className,
      )}
    >
      {display}
    </span>
  );
}
