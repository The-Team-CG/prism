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
  in_review: "attention",
  client_submitted: "attention",
  issued: "attention",
  submitted: "attention",
  attention: "attention",
  awaiting: "attention",
  pending: "attention",
  open: "danger",
  blocked: "danger",
  at_risk: "danger",
  overdue: "danger",
  rejected: "danger",
  cancelled: "danger",
};

const TIER_CLASSES: Record<StatusTier, string> = {
  success: "bg-success/10 text-success ring-success/20",
  attention: "bg-attention/10 text-attention ring-attention/20",
  danger: "bg-danger/10 text-danger ring-danger/20",
  default: "bg-primary/10 text-primary ring-primary/15",
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
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-2xs font-bold capitalize ring-1",
        prismStatusClass(status),
        className,
      )}
    >
      {(label ?? status).replaceAll("_", " ")}
    </span>
  );
}
