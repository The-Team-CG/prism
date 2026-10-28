"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { PrismAuditLog, PrismEvent } from "@prism/types";
import { StatusBadge } from "@/app/components/ui/status-badge";

export const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export function formatLabel(value?: string) {
  if (!value) return "Pending";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace(/\bPmcm\b/g, "Event Team");
}

export function portalStatusLabel(status: PrismEvent["clientPortalStatus"]) {
  return status === "unlocked" ? "Conforme signed" : "Portal locked";
}

export function portalBadgeStatus(status: PrismEvent["clientPortalStatus"]) {
  return status === "unlocked" ? "approved" : "locked";
}

export function clientActivityTitle(action: string) {
  if (/local fixture seed/i.test(action)) return "Event workspace prepared";
  return action
    .replaceAll("_", " ")
    .replace(/\bPMCM Admin\b/gi, "Event team")
    .replace(/\bPMCM\b/gi, "Event team")
    .replace(/\bAdmin\b/gi, "team");
}

export function clientActivityActor(actor: string) {
  return /pmcm|admin/i.test(actor) ? "Event team" : actor;
}

export function actorInitials(actor: string) {
  const clean = clientActivityActor(actor);
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function groupByDay(items: PrismAuditLog[]) {
  const groups: Map<string, PrismAuditLog[]> = new Map();
  for (const item of items) {
    const day = item.createdAt?.split("T")[0] ?? item.createdAt ?? "Unknown";
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(item);
  }
  return groups;
}

export function formatDayLabel(day: string) {
  try {
    const date = new Date(day);
    if (Number.isNaN(date.getTime())) return day;
    return new Intl.DateTimeFormat("en-PH", { month: "long", day: "numeric", year: "numeric" }).format(date);
  } catch {
    return day;
  }
}

/* ── Shared primitives ─────────────────────────────────────── */

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 rounded-lg border border-border bg-card ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border px-4 py-4 sm:px-6">{children}</div>;
}

export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-4 py-5 sm:px-6 ${className}`}>{children}</div>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground">{children}</p>
  );
}

export function InfoGrid({ items }: { items: Array<{ label: string; value: React.ReactNode; icon?: LucideIcon }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-muted/40 p-4">
          <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
          <p className="mt-1.5 text-sm font-bold text-foreground">{item.value ?? "—"}</p>
        </div>
      ))}
    </div>
  );
}

export function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 not-last:border-b not-last:border-border text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

