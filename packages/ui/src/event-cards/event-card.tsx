import type { ComponentType, MouseEvent, ReactNode } from "react";
import { AlertTriangle, CircleDot, Clock3, type LucideIcon } from "lucide-react";
import { PRISM_LIFECYCLE_STAGES, PRISM_LIFECYCLE_STAGE_LABELS, type PrismLifecycleStage } from "@prism/types";
import { formatPeso } from "../payment-track";
import { portalHref } from "../portal-path";
import { cn } from "../utils";
import { dateTileParts, eventCountdown, stagePosition, type CountdownTone } from "./event-card-model";

/** A link the portal renders: its router's Link for in-app pages, or a plain anchor. */
export type CardLink = ComponentType<{ href: string; className?: string; children: ReactNode }>;

const PlainLink: CardLink = ({ href, className, children }) => <a href={portalHref(href)} className={className}>{children}</a>;

/** The event day as a calendar leaf: month, day, weekday. */
export function DateTile({ date, muted = false }: { date: string; muted?: boolean }) {
  const parts = dateTileParts(date);
  if (!parts) return <span aria-hidden className="size-13 shrink-0 rounded-xl bg-muted" />;
  return (
    <span aria-hidden className={cn("grid w-13 shrink-0 place-items-center rounded-xl py-1.5 leading-none", muted ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary")}>
      <span className="text-[10px] font-semibold tracking-wide">{parts.month}</span>
      <span className="py-0.5 text-xl font-bold tabular-nums">{parts.day}</span>
      <span className="text-[10px] font-semibold tracking-wide">{parts.weekday}</span>
    </span>
  );
}

const COUNTDOWN_TONE: Record<CountdownTone, string> = {
  today: "bg-primary text-primary-foreground",
  soon: "bg-attention-soft text-attention",
  later: "bg-muted text-foreground",
  past: "bg-muted text-muted-foreground",
};

/** "in 7 days", "Today", "3 days ago", coloured by how close it is. */
export function CountdownPill({ date, todayKey, label }: { date: string; todayKey: string; label?: string }) {
  const countdown = eventCountdown(date, todayKey);
  if (!countdown && !label) return null;
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", COUNTDOWN_TONE[countdown?.tone ?? "later"])}>
      {label ?? countdown?.label}
    </span>
  );
}

/** Where the event is in its life, inquiry to closure, as six segments with the current one named. */
export function StageTrack({ stage, label }: { stage: PrismLifecycleStage; label?: string }) {
  const position = stagePosition(stage);
  return (
    <div>
      <div role="img" aria-label={`Stage ${position} of ${PRISM_LIFECYCLE_STAGES.length}: ${PRISM_LIFECYCLE_STAGE_LABELS[stage]}`} className="grid grid-cols-6 gap-1">
        {PRISM_LIFECYCLE_STAGES.map((step, index) => (
          <span key={step} className={cn("h-1.5 rounded-full", index + 1 < position ? "bg-primary" : index + 1 === position ? "bg-primary/45" : "bg-muted")} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-[11px] text-muted-foreground">
        <span>Stage {position} of {PRISM_LIFECYCLE_STAGES.length}</span>
        <span className="font-semibold text-foreground">{label ?? PRISM_LIFECYCLE_STAGE_LABELS[stage]}</span>
      </div>
    </div>
  );
}

export type AttentionSeverity = "critical" | "warning" | "attention" | "info";
/** One thing waiting on an event: what it is, and optionally which one ("XPERTO Registration, due Nov 3"). */
export type AttentionLine = { id: string; severity: AttentionSeverity; text: string; detail?: string; href?: string };

const SEVERITY_LOOK: Record<AttentionSeverity, { icon: LucideIcon; tone: string }> = {
  critical: { icon: AlertTriangle, tone: "bg-danger-soft text-danger" },
  warning: { icon: Clock3, tone: "bg-attention-soft text-attention" },
  attention: { icon: CircleDot, tone: "bg-info-soft text-info" },
  info: { icon: CircleDot, tone: "bg-muted text-muted-foreground" },
};

/** What is waiting on an event, most urgent first. Each line opens the work when it has somewhere to go. */
export function AttentionList({ lines, more = 0, link: Link = PlainLink }: { lines: AttentionLine[]; more?: number; link?: CardLink }) {
  if (lines.length === 0) return null;
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
      {lines.map((line) => {
        const look = SEVERITY_LOOK[line.severity];
        const Icon = look.icon;
        const text = (
          <span className="min-w-0">
            {line.text}
            {line.detail ? <span className="block truncate text-muted-foreground">{line.detail}</span> : null}
          </span>
        );
        return (
          <li key={line.id} className="flex items-start gap-2 text-xs">
            <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-full", look.tone)}><Icon className="size-3" /></span>
            {line.href ? <Link href={line.href} className="relative z-10 min-w-0 pt-0.5 text-foreground hover:underline">{text}</Link> : <span className="min-w-0 pt-0.5 text-foreground">{text}</span>}
          </li>
        );
      })}
      {more > 0 ? <li className="pl-7 text-xs text-muted-foreground">+{more} more</li> : null}
    </ul>
  );
}

/** Steps done out of all, as segments with a caption: "1 of 4 steps", and the step that is next. */
export function StepProgress({ done, total, current }: { done: number; total: number; current?: string }) {
  if (total <= 0) return null;
  return (
    <div>
      <div role="img" aria-label={`${done} of ${total} steps done`} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {Array.from({ length: total }, (_, index) => <span key={index} className={cn("h-1.5 rounded-full", index < done ? "bg-success" : "bg-muted")} />)}
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{done} of {total} steps</span>
        {current ? <span className="font-semibold text-foreground">{current}</span> : null}
      </div>
    </div>
  );
}

/** Money in and still to come for one event: verified, being checked, and the rest. */
export function MoneyBar({ billed, paid, checking = 0, verb = "paid" }: { billed: number; paid: number; checking?: number; verb?: string }) {
  if (billed <= 0) return <span className="text-xs text-muted-foreground">No billing yet</span>;
  const verified = Math.max(0, paid - checking);
  const percent = (value: number) => `${Math.min(100, Math.max(0, (value / billed) * 100))}%`;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5 text-xs text-muted-foreground">
      <span className="shrink-0 tabular-nums">{formatPeso(paid)} of {formatPeso(billed)} {verb}</span>
      <span role="img" aria-label={`${formatPeso(paid)} of ${formatPeso(billed)} ${verb}${checking ? `, ${formatPeso(checking)} still being checked` : ""}`} className="flex h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-muted">
        <span className="bg-success" style={{ width: percent(verified) }} />
        <span className="bg-success/40" style={{ width: percent(checking) }} />
      </span>
    </span>
  );
}

/**
 * One event as a card: a red edge when something is waiting on the reader. The title link covers the whole card;
 * links and buttons inside it sit above that cover.
 */
export function EventCard({ urgent = false, compact = false, className, children }: { urgent?: boolean; compact?: boolean; className?: string; children: ReactNode }) {
  return (
    <article className={cn(
      "relative grid min-w-0 grid-cols-[minmax(0,1fr)] content-start overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md",
      compact ? "gap-2 p-3.5" : "gap-3 p-4",
      urgent ? "border-danger/40 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-danger" : "border-border",
      className,
    )}>
      {children}
    </article>
  );
}

/** A plain left click runs the portal's own navigation; a new-tab or modified click is left to the browser. */
function onPlainClick(onNavigate: () => void) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate();
  };
}

const TITLE_STYLE = "block font-semibold leading-snug text-foreground outline-none after:absolute after:inset-0 focus-visible:underline";

/**
 * The card's heading row: date tile, title (the card's link) with its details, and the countdown. `onNavigate` lets a
 * portal open the event through its own state (it still renders a real link for new tabs).
 */
export function EventCardHeader({ date, title, href, details, aside, link: Link = PlainLink, onNavigate, muted = false }: {
  date: string;
  title: string;
  href: string;
  details?: ReactNode;
  aside?: ReactNode;
  link?: CardLink;
  onNavigate?: () => void;
  muted?: boolean;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
      <DateTile date={date} muted={muted} />
      <div className="min-w-0">
        {onNavigate
          ? <a href={portalHref(href)} onClick={onPlainClick(onNavigate)} className={TITLE_STYLE}>{title}</a>
          : <Link href={href} className={TITLE_STYLE}>{title}</Link>}
        {details ? <div className="mt-0.5 text-xs text-muted-foreground">{details}</div> : null}
      </div>
      {aside}
    </div>
  );
}

/** The card's last row, under a hairline: money, and how to open it. */
export function EventCardFooter({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-3 border-t border-border pt-2.5 text-xs">{children}</div>;
}

/** Cards in a responsive grid: one column on a phone, two or three on wider screens. */
export function EventCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-3">{children}</div>;
}
