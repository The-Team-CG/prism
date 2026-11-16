"use client";

import type { ComponentType, ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Card } from "./components/ui/card";
import { PrismEmptyLine } from "./page-blocks";
import { isZeroFigure } from "./figures";
import { portalHref } from "./portal-path";
import { cn } from "./utils";

/**
 * The work list every portal shares (the PMCM Inbox, the client home, the supplier's Today): aligned rows with an
 * area icon, a two-line body, a due/status column and one action, and a group row for several of the same kind.
 * Colour marks only what needs the reader; everything else stays grey.
 */
export type PrismListTone = "urgent" | "attention" | "done" | "neutral";

/** A link the portal renders: its router's Link for in-app pages, or a plain anchor. */
export type PrismListLink = ComponentType<{ href: string; className?: string; onClick?: () => void; children: ReactNode }>;

const PlainLink: PrismListLink = ({ href, className, onClick, children }) => <a href={portalHref(href)} className={className} onClick={onClick}>{children}</a>;

const BAR: Record<PrismListTone, string> = {
  urgent: "border-l-danger",
  attention: "border-l-attention",
  done: "border-l-transparent",
  neutral: "border-l-transparent",
};

const TILE: Record<PrismListTone, string> = {
  urgent: "bg-danger-soft text-danger",
  attention: "bg-attention-soft text-attention",
  done: "bg-success-soft text-success",
  neutral: "bg-muted text-muted-foreground",
};

const STATUS: Record<PrismListTone, string> = {
  urgent: "font-semibold text-danger",
  attention: "font-medium text-attention",
  done: "text-success",
  neutral: "text-muted-foreground",
};

const ROW_GRID = "grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-1 py-3 pl-3 pr-4 sm:grid-cols-[2rem_minmax(0,1fr)_10rem_11rem] sm:items-center";

function Tile({ icon: Icon, tone }: { icon: LucideIcon; tone: PrismListTone }) {
  return (
    <span aria-hidden className={cn("grid size-8 place-items-center rounded-md", TILE[tone])}>
      <Icon className="size-4" />
    </span>
  );
}

function Tag({ tone, children }: { tone: PrismListTone; children: ReactNode }) {
  return <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-xs font-medium", TILE[tone])}>{children}</span>;
}

function RowTitle({ title, href, onOpen, link: Link }: { title: string; href?: string; onOpen?: () => void; link: PrismListLink }) {
  if (href) return <Link href={href} onClick={onOpen} className="truncate outline-none after:absolute after:inset-0">{title}</Link>;
  if (onOpen) return <button type="button" onClick={onOpen} className="truncate text-left outline-none after:absolute after:inset-0">{title}</button>;
  return <span className="truncate">{title}</span>;
}

/**
 * One aligned row. The title is the row's link (the whole row is clickable); `status` sits in a fixed column so
 * rows line up, coloured by `statusTone` (the row's tone by default), and `action` names what opening the row does.
 */
export function PrismListRow({
  icon,
  tone = "neutral",
  title,
  meta,
  metaTitle,
  tag,
  status,
  statusTone,
  statusTitle,
  action,
  href,
  onOpen,
  link = PlainLink,
  testId,
}: {
  icon: LucideIcon;
  tone?: PrismListTone;
  title: string;
  meta?: ReactNode;
  /** The full detail when `meta` is cut short. */
  metaTitle?: string;
  tag?: string;
  status?: ReactNode;
  statusTone?: PrismListTone;
  statusTitle?: string;
  action?: string;
  href?: string;
  onOpen?: () => void;
  link?: PrismListLink;
  testId?: string;
}) {
  const opens = Boolean(href || onOpen);
  return (
    <li
      data-testid={testId}
      className={cn(
        "relative border-l-[3px] transition-colors",
        ROW_GRID,
        BAR[tone],
        opens && "hover:bg-surface-raised has-[a:focus-visible]:bg-surface-raised has-[button:focus-visible]:bg-surface-raised",
      )}
    >
      <Tile icon={icon} tone={tone} />
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <RowTitle title={title} href={href} onOpen={onOpen} link={link} />
          {tag ? <Tag tone={tone}>{tag}</Tag> : null}
        </p>
        {meta ? <p title={metaTitle} className="truncate text-xs text-muted-foreground">{meta}</p> : null}
      </div>
      <p title={statusTitle} className={cn("col-start-2 whitespace-nowrap text-xs tabular-nums sm:col-start-auto sm:text-sm", STATUS[statusTone ?? tone])}>{status}</p>
      <span className="col-start-2 flex items-center gap-1 whitespace-nowrap text-sm font-medium text-primary sm:col-start-auto sm:justify-end">
        {action && opens ? <>{action}<ChevronRight className="size-4" aria-hidden /></> : null}
      </span>
    </li>
  );
}

/** Several rows of the same kind as one row that opens to show them: "3 × Quote request open". */
export function PrismListCluster({ icon, tone = "neutral", title, meta, tag, testId, children }: {
  icon: LucideIcon;
  tone?: PrismListTone;
  title: string;
  meta?: ReactNode;
  tag?: string;
  testId?: string;
  /** The rows inside, as `PrismListRow`s. */
  children: ReactNode;
}) {
  return (
    <li data-testid={testId} className={cn("border-l-[3px]", BAR[tone])}>
      <details className="group">
        <summary className="grid cursor-pointer list-none grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 py-3 pl-3 pr-4 hover:bg-surface-raised">
          <Tile icon={icon} tone={tone} />
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {title}
              {tag ? <Tag tone={tone}>{tag}</Tag> : null}
            </span>
            {meta ? <span className="block truncate text-xs text-muted-foreground">{meta}</span> : null}
          </span>
          <span className="flex items-center gap-1 text-sm font-medium text-primary">
            <span className="group-open:hidden">Show all</span>
            <span className="hidden group-open:inline">Hide</span>
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
          </span>
        </summary>
        <ul className="divide-y divide-border border-t border-border bg-muted/20">{children}</ul>
      </details>
    </li>
  );
}

/** A titled card holding rows. */
export function PrismListSection({ id, title, count, description, action, children }: {
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

/** `empty` marks a figure with nothing to report (a zero, "none yet"), so the strip shows it faded. */
export type PrismListFigure = { label: string; value: ReactNode; detail?: string; tone?: PrismListTone; href?: string; empty?: boolean };

/** A row of figures above a list, each optionally a link. */
export function PrismFigureStrip({ figures, label, link: Link = PlainLink }: { figures: PrismListFigure[]; label: string; link?: PrismListLink }) {
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

/** Nothing here yet: one compact card holding the message and, when there is one, the way forward. */
export function PrismListEmpty({ icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <Card className="px-5 py-5">
      <PrismEmptyLine icon={icon} action={action}>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <span className="mt-0.5 block">{description}</span>
      </PrismEmptyLine>
    </Card>
  );
}
