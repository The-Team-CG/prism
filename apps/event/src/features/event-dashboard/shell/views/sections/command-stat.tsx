"use client";

import type { LucideIcon } from "lucide-react";


export function CommandStat({
  label,
  value,
  icon: Icon,
  accent = "text-(--prism-signal)",
  onClick,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: string;
  onClick?: () => void;
}) {
  const inner = (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm transition hover:shadow-md">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl bg-muted ${accent}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none text-foreground">{value}</p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p>
      </div>
    </div>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {inner}
      </button>
    );
  }
  return inner;
}

