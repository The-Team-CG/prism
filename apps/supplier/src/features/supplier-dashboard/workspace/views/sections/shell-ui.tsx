"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card shadow-sm ${className}`}>{children}</div>;
}
export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`border-b border-border px-6 py-4 ${className}`}>{children}</div>;
}
export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}
export function SectionAccent({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">{children}</p>;
}

export function StatCell({
  label, value, sub, icon: Icon, accent = false,
}: { label: string; value: string | number; sub?: string; icon: LucideIcon; accent?: boolean }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${accent ? "bg-(--prism-signal) text-white" : "bg-muted text-(--prism-signal)"}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none text-foreground">{value}</p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p>
        {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
