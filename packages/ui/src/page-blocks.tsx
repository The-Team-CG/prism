"use client";

import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { Card } from "./components/ui/card";
import { cn } from "./utils";

/**
 * Page building blocks shared by every portal, so screens share one visual language:
 * a reading-width column, one lead block, one stat row, one section card and one empty line.
 * They carry no role or workflow rules.
 */

/** Reading-width column: keeps a row's title and its action close together on wide screens. */
export function PrismPageColumn({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-full max-w-5xl space-y-6", className)}>{children}</div>;
}

/**
 * The page's single lead: what this screen is about, in the strongest block on the page.
 * An ink panel with a large title, an optional big figure (a countdown, an amount) and a footer for
 * the one thing to do next. At most one per screen.
 */
export function PrismHero({
  label,
  title,
  meta,
  figure,
  children,
  backdrop,
  className,
}: {
  /** Plain line above the title, such as "Your next event". */
  label: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  figure?: { value: React.ReactNode; label: string };
  /** Footer under a hairline: the next step and its action. */
  children?: React.ReactNode;
  /** A picture behind the panel, such as the event's cover, darkened so the text stays readable. */
  backdrop?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative isolate overflow-hidden rounded-2xl bg-ink text-ink-foreground", className)}>
      {backdrop ? (
        <div aria-hidden className="absolute inset-0 -z-10">
          {backdrop}
          <div className="absolute inset-0 bg-linear-to-r from-ink via-ink/85 to-ink/45" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-sm text-ink-foreground/70">{label}</p>
          <h2 className="mt-1.5 text-2xl font-semibold leading-tight sm:text-3xl">{title}</h2>
          {meta ? <div className="mt-2 text-sm text-ink-foreground/70">{meta}</div> : null}
        </div>
        {figure ? (
          <p className="shrink-0 sm:text-right">
            <span className="block text-5xl font-semibold leading-none tabular-nums sm:text-6xl">{figure.value}</span>
            <span className="mt-1.5 block text-sm text-ink-foreground/70">{figure.label}</span>
          </p>
        ) : null}
      </div>
      {children ? <div className="border-t border-ink-foreground/10 px-5 py-4 sm:px-7">{children}</div> : null}
    </section>
  );
}

export type PrismStatTone = "neutral" | "attention" | "urgent";

export type PrismStat = {
  label: string;
  value: React.ReactNode;
  detail?: string;
  tone?: PrismStatTone;
  href?: string;
  /** Nothing to report (a zero, "none yet"). Empty stats are not shown. */
  empty?: boolean;
};

const STAT_TONE: Record<PrismStatTone, string> = {
  neutral: "text-foreground",
  attention: "text-attention",
  urgent: "text-danger",
};

/** One row of figures, without a box. Empty figures are left out; with none left, nothing renders. */
export function PrismStatRow({ stats, label, className }: { stats: PrismStat[]; label: string; className?: string }) {
  const shown = stats.filter((stat) => !stat.empty);
  if (shown.length === 0) return null;
  return (
    <dl aria-label={label} className={cn("flex flex-wrap gap-x-10 gap-y-4", className)}>
      {shown.map((stat) => {
        const body = (
          <>
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className={cn("mt-0.5 text-2xl font-semibold tabular-nums", STAT_TONE[stat.tone ?? "neutral"])}>{stat.value}</dd>
            {stat.detail ? <dd className="mt-0.5 text-xs text-muted-foreground">{stat.detail}</dd> : null}
          </>
        );
        return stat.href ? (
          <a key={stat.label} href={stat.href} className="block min-w-0 rounded-md outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring">{body}</a>
        ) : (
          <div key={stat.label} className="min-w-0">{body}</div>
        );
      })}
    </dl>
  );
}

/**
 * One section of a page. Every section uses the same heading size and padding.
 * `flush` lets a list or table run edge to edge; `bare` drops the card for content that is itself
 * a set of cards, so cards never nest.
 */
export function PrismSection({
  id,
  title,
  count,
  description,
  action,
  flush = false,
  bare = false,
  children,
  className,
}: {
  id: string;
  title: string;
  count?: number;
  description?: React.ReactNode;
  action?: React.ReactNode;
  flush?: boolean;
  bare?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const header = (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2", bare ? "pb-3" : "px-5 pb-4 pt-5")}>
      <div className="min-w-0">
        <h2 id={id} className="flex items-baseline gap-2 text-base font-semibold text-foreground">
          {title}
          {count !== undefined ? <span className="text-sm font-normal tabular-nums text-muted-foreground">{count}</span> : null}
        </h2>
        {description ? <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
  if (bare) {
    return (
      <section aria-labelledby={id} className={className}>
        {header}
        {children}
      </section>
    );
  }
  return (
    <section aria-labelledby={id} className={className}>
      <Card className="gap-0 overflow-hidden py-0">
        {header}
        <div className={flush ? "border-t border-border" : "px-5 pb-5"}>{children}</div>
      </Card>
    </section>
  );
}

/**
 * One card in a dashboard grid: icon, title and an aside on one row, then the body, then an optional footer pinned
 * to the bottom. It fills its grid cell, so cards side by side end on the same line and their actions line up.
 */
export function PrismPanel({
  id,
  title,
  icon: Icon,
  aside,
  footer,
  children,
  className,
  bodyClassName,
}: {
  id: string;
  title: string;
  icon?: LucideIcon;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("flex h-full min-w-0 flex-col rounded-xl border border-border bg-card shadow-xs", className)}>
      <header className="flex min-h-8 items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <h2 id={id} className="flex min-w-0 items-center gap-2.5 text-base font-semibold text-foreground">
          {Icon ? (
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <Icon aria-hidden="true" className="size-4" />
            </span>
          ) : null}
          <span className="truncate">{title}</span>
        </h2>
        {aside ? <div className="shrink-0 text-xs text-muted-foreground">{aside}</div> : null}
      </header>
      <div className={cn("flex-1 px-4 pb-4 pt-3 sm:px-5", bodyClassName)}>{children}</div>
      {footer ? <div className="border-t border-border px-4 py-3 sm:px-5">{footer}</div> : null}
    </section>
  );
}

/** A divider naming a group inside a flush section, such as the event a set of rows belongs to. */
export function PrismSectionGroupLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="bg-surface-raised px-5 py-2 text-xs font-medium text-muted-foreground">{children}</h3>;
}

/** "Nothing here yet" as one compact line with its way forward, instead of a tall empty box. */
export function PrismEmptyLine({ icon: Icon, children, action, className }: { icon?: LucideIcon; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground", className)}>
      {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
      <div className="min-w-0 flex-1 basis-56">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
