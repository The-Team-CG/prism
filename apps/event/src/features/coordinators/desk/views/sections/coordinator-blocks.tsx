"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/app/components/ui/utils";

/**
 * Nothing here yet, as one card: an icon, what is missing and why, and the way forward under the text, so the button
 * lines up with the words rather than the icon.
 */
export function CoordinatorEmpty({ icon: Icon, title, children, action, className }: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-3xl lg:max-w-none gap-3 rounded-xl border border-border bg-card px-4 py-4 sm:px-5", className)}>
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span>
      <div className="grid min-w-0 gap-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}

/** A list of rows in one card, so related things on a page share one surface instead of each having its own. */
export function RowGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="max-w-3xl lg:max-w-none overflow-hidden rounded-xl border border-border bg-card">
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

const ROW_TONE = { neutral: "bg-muted text-muted-foreground", attention: "bg-attention-soft text-attention", urgent: "bg-danger-soft text-danger" } as const;

/** One row in a RowGroup: icon, title, a detail line, and a chevron when it opens something. */
export function NavRow({ icon: Icon, title, detail, tone = "neutral", trailing, onClick }: {
  icon: LucideIcon;
  title: string;
  detail?: ReactNode;
  tone?: "neutral" | "attention" | "urgent";
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-lg", ROW_TONE[tone])}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        {detail ? <span className="block truncate text-xs text-muted-foreground">{detail}</span> : null}
      </span>
      {trailing}
    </>
  );
  const className = "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left sm:px-5";
  return onClick ? <button type="button" onClick={onClick} className={cn(className, "hover:bg-surface-raised")}>{body}</button> : <div className={className}>{body}</div>;
}
