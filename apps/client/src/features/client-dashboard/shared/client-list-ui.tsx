"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Card } from "@prism/ui/components/card";
import { PrismEmptyLine } from "@prism/ui/page-blocks";
import { isZeroFigure } from "@prism/ui/figures";
import { cn } from "@/app/components/ui/utils";

/**
 * Shared list language for the client portal, matching the PMCM inbox: a figure strip on top, then
 * aligned rows with an area icon, a two-line body, a due/status column and one action. Colour marks
 * only what needs the client; everything else stays grey.
 */
export type ClientRowTone = "urgent" | "attention" | "done" | "neutral";

const BAR: Record<ClientRowTone, string> = {
  urgent: "border-l-danger",
  attention: "border-l-attention",
  done: "border-l-transparent",
  neutral: "border-l-transparent",
};

const ICON: Record<ClientRowTone, string> = {
  urgent: "bg-danger-soft text-danger",
  attention: "bg-attention-soft text-attention",
  done: "bg-success-soft text-success",
  neutral: "bg-muted text-muted-foreground",
};

const STATUS: Record<ClientRowTone, string> = {
  urgent: "font-semibold text-danger",
  attention: "font-medium text-attention",
  done: "text-success",
  neutral: "text-muted-foreground",
};

/** `empty` marks a figure with nothing to report (a zero, "none yet"), so a stat row can leave it out. */
export type ClientFigure = { label: string; value: ReactNode; detail?: string; tone?: ClientRowTone; href?: string; empty?: boolean };

export function ClientFigureStrip({ figures, label }: { figures: ClientFigure[]; label: string }) {
  if (figures.length === 0) return null;
  const columns = figures.length >= 4 ? "sm:grid-cols-4" : figures.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <Card className="gap-0 overflow-hidden py-0">
    <dl aria-label={label} className={cn("grid grid-cols-2 sm:divide-x sm:divide-border", columns)}>
      {figures.map((figure) => {
        const body = (
          <>
            <dt className="text-xs text-muted-foreground">{figure.label}</dt>
            <dd className={cn("mt-0.5 truncate text-xl font-semibold tabular-nums text-foreground", figure.tone && figure.tone !== "neutral" && STATUS[figure.tone], (figure.empty || isZeroFigure(figure.value)) && "text-muted-foreground/60")}>{figure.value}</dd>
            {figure.detail ? <dd className="truncate text-xs text-muted-foreground">{figure.detail}</dd> : null}
          </>
        );
        return figure.href ? (
          <Link key={figure.label} href={figure.href} className="block min-w-0 px-4 py-3 transition-colors hover:bg-surface-raised">{body}</Link>
        ) : (
          <div key={figure.label} className="min-w-0 px-4 py-3">{body}</div>
        );
      })}
    </dl>
    </Card>
  );
}

export function ClientListSection({
  id,
  title,
  count,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <Card className="gap-0 overflow-hidden py-0">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id={id} className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {title}
              {count !== undefined ? <span className="text-sm font-normal tabular-nums text-muted-foreground">{count}</span> : null}
            </h2>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {action}
        </header>
        <ul className="divide-y divide-border">{children}</ul>
      </Card>
    </section>
  );
}

/**
 * One aligned row. The title is the row's link (the whole row is clickable); `status` sits in a fixed
 * column so rows line up, and `action` names what opening the row does.
 */
export function ClientListRow({
  icon: Icon,
  tone = "neutral",
  title,
  meta,
  tag,
  status,
  statusTitle,
  action,
  href,
  onOpen,
}: {
  icon: LucideIcon;
  tone?: ClientRowTone;
  title: string;
  meta?: ReactNode;
  tag?: string;
  status?: ReactNode;
  statusTitle?: string;
  action?: string;
  href?: string;
  onOpen?: () => void;
}) {
  return (
    <li
      className={cn(
        "relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-1 border-l-[3px] py-3 pl-3 pr-4 transition-colors sm:grid-cols-[2rem_minmax(0,1fr)_10rem_9.5rem] sm:items-center",
        BAR[tone],
        (href || onOpen) && "hover:bg-surface-raised has-[a:focus-visible]:bg-surface-raised has-[button:focus-visible]:bg-surface-raised",
      )}
    >
      <span aria-hidden className={cn("grid size-8 place-items-center rounded-md", ICON[tone])}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <RowTitle title={title} href={href} onOpen={onOpen} />
          {tag ? <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-xs font-medium", ICON[tone === "neutral" ? "neutral" : tone])}>{tag}</span> : null}
        </p>
        {meta ? <p className="truncate text-xs text-muted-foreground">{meta}</p> : null}
      </div>
      <p title={statusTitle} className={cn("col-start-2 whitespace-nowrap text-xs tabular-nums sm:col-start-auto sm:text-center sm:text-sm", STATUS[tone])}>{status}</p>
      <span className="hidden items-center justify-end gap-1 whitespace-nowrap text-sm text-muted-foreground sm:flex">
        {action && (href || onOpen) ? (
          <>
            {action}
            <ChevronRight className="size-4" aria-hidden />
          </>
        ) : null}
      </span>
    </li>
  );
}

function RowTitle({ title, href, onOpen }: { title: string; href?: string; onOpen?: () => void }) {
  if (href) {
    return (
      <Link href={href} onClick={onOpen} className="truncate outline-none after:absolute after:inset-0">
        {title}
      </Link>
    );
  }
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className="truncate text-left outline-none after:absolute after:inset-0">
        {title}
      </button>
    );
  }
  return <span className="truncate">{title}</span>;
}

/** Nothing here yet: one compact card holding the message and, when there is one, the way forward. */
export function ClientListEmpty({ icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <Card className="px-5 py-5">
      <PrismEmptyLine icon={icon} action={action}>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <span className="mt-0.5 block">{description}</span>
      </PrismEmptyLine>
    </Card>
  );
}
