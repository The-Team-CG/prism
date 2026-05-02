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
  success: "bg-(--prism-success)/10 text-(--prism-success) ring-(--prism-success)/20",
  attention: "bg-(--prism-amber)/10 text-(--prism-amber) ring-(--prism-amber)/20",
  danger: "bg-(--prism-danger)/10 text-(--prism-danger) ring-(--prism-danger)/20",
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
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1",
        prismStatusClass(status),
        className,
      )}
    >
      {(label ?? status).replaceAll("_", " ")}
    </span>
  );
}
