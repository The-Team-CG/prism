"use client";

import type { LucideIcon } from "lucide-react";

/** Flat surface: one hairline border on the page ground, no resting shadow. */
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-lg border border-border bg-card ${className}`}>{children}</div>;
}
export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`border-b border-border px-4 py-4 sm:px-6 ${className}`}>{children}</div>;
}
export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-4 py-5 sm:px-6 ${className}`}>{children}</div>;
}
/** Small context label above a record title: sentence case, muted, never a tracked uppercase eyebrow. */
export function SectionAccent({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** A KPI is a label over a figure; the icon prop is kept for call-site compatibility but not drawn. */
export function StatCell({
  label, value, sub,
}: { label: string; value: string | number; sub?: string; icon?: LucideIcon; accent?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-tight tabular-nums text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
