"use client";

import { cn } from "./utils";

type StatusTier = "success" | "attention" | "danger" | "default";

const STATUS_MAP: Record<string, StatusTier> = {
  approved: "success",
  paid: "success",
  ready: "success",
  done: "success",
  resolved: "success",
  confirmed: "success",
  verified: "success",
  active: "success",
  completed: "success",
  acknowledged: "success",
  selected: "success",
  locked: "success",
  complete: "success",
  revision_requested: "attention",
  changes_requested: "attention",
  needs_update: "attention",
  missing: "attention",
  in_review: "attention",
  client_submitted: "attention",
  issued: "attention",
  submitted: "default",
  attention: "attention",
  awaiting: "default",
  pending: "default",
  open: "default",
  in_progress: "default",
  blocked: "danger",
  at_risk: "danger",
  overdue: "danger",
  rejected: "danger",
  cancelled: "default",
};

const TIER_CLASSES: Record<StatusTier, string> = {
  success: "text-success",
  attention: "text-attention",
  danger: "text-danger",
  default: "text-muted-foreground",
};

export function prismStatusClass(status: string): string {
  return TIER_CLASSES[STATUS_MAP[status] ?? "default"];
}

export interface PrismStatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function PrismStatusBadge({ status, label, className }: PrismStatusBadgeProps) {
  const display = (label ?? status).replaceAll("_", " ");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        prismStatusClass(status),
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {display.charAt(0).toUpperCase() + display.slice(1)}
    </span>
  );
}
