import type { ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import { cn } from "../utils";
import { dateTileParts } from "./event-card-model";
import type { AttentionLine, AttentionSeverity, CardLink } from "./event-card";

/**
 * Pictures for an event's overview, shared by every portal so PMCM and the client read the same page shapes:
 * a score ring, what is waiting at a glance, and dated work as calendar leaves.
 */

export type RingTone = "success" | "attention" | "danger" | "primary";

const RING_STROKE: Record<RingTone, string> = {
  success: "stroke-success",
  attention: "stroke-attention",
  danger: "stroke-danger",
  primary: "stroke-primary",
};

/** A share out of 100 as a ring, with the figure (or anything else) in its middle. `null` draws the empty ring. */
export function ProgressRing({ value, label, tone = "primary", size = 80, children }: {
  value: number | null;
  /** What the ring says, for screen readers: "Readiness 43%". */
  label: string;
  tone?: RingTone;
  size?: number;
  children?: ReactNode;
}) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const share = Math.min(100, Math.max(0, value ?? 0));
  return (
    <div role="img" aria-label={label} className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-muted" />
        {share > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - share / 100)}
            className={RING_STROKE[tone]}
          />
        ) : null}
      </svg>
      <span aria-hidden className="absolute inset-0 grid place-items-center text-center leading-none">{children}</span>
    </div>
  );
}

const TALLY: ReadonlyArray<{ severity: AttentionSeverity; label: string; tone: string }> = [
  { severity: "critical", label: "urgent", tone: "bg-danger" },
  { severity: "warning", label: "soon", tone: "bg-attention" },
  { severity: "attention", label: "to check", tone: "bg-info" },
  { severity: "info", label: "to plan", tone: "bg-muted-foreground/40" },
];

/** How many waiting lines carry each severity, most severe first, leaving out the ones with none. */
export function attentionTally(lines: Pick<AttentionLine, "severity">[]): Array<{ severity: AttentionSeverity; label: string; count: number }> {
  return TALLY.map(({ severity, label }) => ({ severity, label, count: lines.filter((line) => line.severity === severity).length })).filter((row) => row.count > 0);
}

/** What is waiting, as one bar split by severity with a counted legend, and how many have waited too long. */
export function AttentionSummary({ lines }: { lines: AttentionLine[] }) {
  const tally = attentionTally(lines);
  if (tally.length === 0) return null;
  const late = lines.filter((line) => line.late).length;
  const tone = (severity: AttentionSeverity) => TALLY.find((row) => row.severity === severity)?.tone;
  return (
    <div>
      <div role="img" aria-label={tally.map((row) => `${row.count} ${row.label}`).join(", ")} className="flex h-2 gap-0.5">
        {tally.map((row) => <span key={row.severity} className={cn("h-full rounded-full", tone(row.severity))} style={{ flexGrow: row.count }} />)}
      </div>
      <ul aria-hidden className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {tally.map((row) => (
          <li key={row.severity} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", tone(row.severity))} />
            <span className="font-semibold tabular-nums text-foreground">{row.count}</span>{row.label}
          </li>
        ))}
        {late ? <li className="ml-auto font-semibold text-danger">{late} waiting too long</li> : null}
      </ul>
    </div>
  );
}

/** One dated step; `date` is left out while the date is still to be set, and the leaf shows a clock instead. */
export type AgendaItem = { id: string; title: string; detail?: string; date?: string | null; href?: string };

/** Dated work, soonest first, each on a small calendar leaf so the dates read at a glance. */
export function AgendaList({ items, link: Link }: { items: AgendaItem[]; link: CardLink }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] divide-y divide-border">
      {items.map((item) => {
        const parts = item.date ? dateTileParts(item.date) : null;
        const body = (
          <>
            <span aria-hidden className="grid w-10 shrink-0 place-items-center rounded-lg bg-primary-soft py-1 leading-none text-primary">
              {parts ? (
                <>
                  <span className="text-[9px] font-semibold tracking-wide">{parts.month}</span>
                  <span className="pt-0.5 text-base font-bold tabular-nums">{parts.day}</span>
                </>
              ) : <CalendarClock className="my-1.5 size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
              {item.detail ? <span className="block truncate text-xs text-muted-foreground">{item.detail}</span> : null}
            </span>
          </>
        );
        const row = "flex items-center gap-3";
        return (
          <li key={item.id} className="min-w-0 py-2.5 first:pt-0 last:pb-0">
            {item.href ? <Link href={item.href} className={cn(row, "rounded-md hover:bg-surface-raised")}>{body}</Link> : <div className={row}>{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}
