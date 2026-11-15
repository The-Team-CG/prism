"use client";

import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { PrismSection } from "@prism/ui/page-blocks";
import { formatPeso } from "@prism/ui/payment-track";
import { cn } from "@/app/components/ui/utils";
import type { AgingBucket, OutlookWeek } from "../model/finance-desk-analysis";

/** One hue, light to dark, as lateness grows. Validated against the card surface. */
const AGING_FILL: Record<AgingBucket["id"], string> = { "not-due": "#f3b8d2", "1-30": "#e06aa0", "31-60": "#c01867", "61+": "#8b0f48" };
/** Two series: money coming in from clients, money going out to suppliers. */
const MONEY_IN = "#1d7fb0";
const MONEY_OUT = "#c01867";

function compactPeso(value: number): string {
  if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `₱${Math.round(value / 1_000)}K`;
  return `₱${value}`;
}

function ViewToggle({ table, onChange }: { table: boolean; onChange: (table: boolean) => void }) {
  const Icon = table ? BarChart3 : Table2;
  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(!table)}>
      <Icon aria-hidden className="size-4" />{table ? "Chart" : "Table"}
    </Button>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: Array<Array<string>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">{head.map((cell, index) => <th key={cell} className={cn("py-2 pr-3 font-medium", index > 0 && "text-right")}>{cell}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row[0]} className="border-b border-border last:border-0">{row.map((cell, index) => <td key={index} className={cn("py-2 pr-3", index > 0 ? "text-right tabular-nums" : "text-foreground")}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function AgingBar({ bucket, max }: { bucket: AgingBucket; max: number }) {
  const width = max > 0 ? Math.max(bucket.amount > 0 ? 1.5 : 0, (bucket.amount / max) * 100) : 0;
  const payments = bucket.count === 1 ? "1 payment" : `${bucket.count} payments`;
  return (
    <li className="group grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3" title={`${bucket.label}: ${formatPeso(bucket.amount)} across ${payments}`}>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: AGING_FILL[bucket.id] }} />
        {bucket.label}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-5 min-w-0 flex-1">
          <span className="block h-full rounded-r-[4px] transition-opacity group-hover:opacity-80" style={{ width: `${width}%`, background: AGING_FILL[bucket.id] }} />
        </span>
        <span className="w-24 shrink-0 text-right text-xs tabular-nums text-foreground">
          {formatPeso(bucket.amount)}
          <span className="block text-muted-foreground">{payments}</span>
        </span>
      </span>
    </li>
  );
}

/** What clients owe, by how late it is. Each band names its amount, so the chart reads without hovering. */
export function AgingChart({ buckets }: { buckets: AgingBucket[] }) {
  const [table, setTable] = useState(false);
  const max = Math.max(...buckets.map((bucket) => bucket.amount));
  const total = buckets.reduce((sum, bucket) => sum + bucket.amount, 0);
  return (
    <PrismSection id="finance-aging" title="What clients owe" description={`${formatPeso(total)} outstanding, by lateness. Disputes left out.`} action={<ViewToggle table={table} onChange={setTable} />}>
      {table ? (
        <DataTable head={["Lateness", "Amount", "Payments"]} rows={buckets.map((bucket) => [bucket.label, formatPeso(bucket.amount), String(bucket.count)])} />
      ) : (
        <ul className="space-y-3" aria-label="Amount owed by clients, by lateness">{buckets.map((bucket) => <AgingBar key={bucket.id} bucket={bucket} max={max} />)}</ul>
      )}
    </PrismSection>
  );
}

const W = 640;
const H = 220;
const PAD = { left: 52, right: 8, top: 10, bottom: 30 };
const PLOT_H = H - PAD.top - PAD.bottom;

/** A bar with 4px rounded ends at the top, anchored square on the baseline. */
function barPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(4, height, width / 2);
  const bottom = y + height;
  return `M${x},${bottom}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${bottom}Z`;
}

function niceMax(value: number): number {
  if (value <= 0) return 100_000;
  const step = 10 ** Math.floor(Math.log10(value));
  const nice = [1, 2, 2.5, 5, 10].map((factor) => factor * step).find((candidate) => candidate >= value) ?? 10 * step;
  return nice;
}

/** Beside the hovered week, never over its bars: to the right of it, or to the left for the later weeks. */
function OutlookTooltip({ week, edge, flip }: { week: OutlookWeek; edge: number; flip: boolean }) {
  const net = week.moneyIn - week.moneyOut;
  return (
    <div role="status" className={cn("pointer-events-none absolute top-0 z-10 w-48 rounded-md border border-border bg-popover p-2 text-xs shadow-md", flip ? "-translate-x-full" : "")} style={{ left: `${edge}%` }}>
      <p className="font-semibold text-foreground">{week.start ? `Week of ${week.label === "This week" ? "today" : week.label}` : "Already late"}</p>
      <p className="mt-1 flex items-center justify-between gap-2 text-muted-foreground"><span className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-sm" style={{ background: MONEY_IN }} />From clients</span><span className="tabular-nums text-foreground">{formatPeso(week.moneyIn)}</span></p>
      <p className="flex items-center justify-between gap-2 text-muted-foreground"><span className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-sm" style={{ background: MONEY_OUT }} />To suppliers</span><span className="tabular-nums text-foreground">{formatPeso(week.moneyOut)}</span></p>
      <p className="mt-1 flex justify-between gap-2 border-t border-border pt-1 text-muted-foreground"><span>Net</span><span className="font-medium tabular-nums text-foreground">{net < 0 ? "−" : ""}{formatPeso(Math.abs(net))}</span></p>
    </div>
  );
}

function OutlookPlot({ weeks }: { weeks: OutlookWeek[] }) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(...weeks.flatMap((week) => [week.moneyIn, week.moneyOut])));
  const column = (W - PAD.left - PAD.right) / weeks.length;
  const bar = Math.min(18, (column - 14) / 2);
  const y = (value: number) => PAD.top + PLOT_H - (value / top) * PLOT_H;
  return (
    <div className="overflow-x-auto">
      <div className="relative min-w-[34rem]" onMouseLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Money due in from clients and out to suppliers, by week">
          {[0, 0.5, 1].map((share) => (
            <g key={share}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(top * share)} y2={y(top * share)} stroke="var(--border)" strokeDasharray={share === 0 ? undefined : "2 3"} />
              <text x={PAD.left - 8} y={y(top * share)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">{compactPeso(top * share)}</text>
            </g>
          ))}
          <line x1={PAD.left + column} x2={PAD.left + column} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--border)" />
          {weeks.map((week, index) => {
            const x = PAD.left + column * index + column / 2;
            const dim = active !== null && active !== index;
            return (
              <g key={week.id} opacity={dim ? 0.45 : 1}>
                {week.moneyIn > 0 ? <path d={barPath(x - bar - 1, y(week.moneyIn), bar, PAD.top + PLOT_H - y(week.moneyIn))} fill={MONEY_IN} /> : null}
                {week.moneyOut > 0 ? <path d={barPath(x + 1, y(week.moneyOut), bar, PAD.top + PLOT_H - y(week.moneyOut))} fill={MONEY_OUT} /> : null}
                <text x={x} y={H - 10} textAnchor="middle" className={cn("text-[11px]", index === 0 ? "fill-danger" : "fill-muted-foreground")}>{week.label}</text>
                <rect
                  x={PAD.left + column * index} y={PAD.top} width={column} height={PLOT_H + 20} fill="transparent" tabIndex={0}
                  aria-label={`${week.label}: ${formatPeso(week.moneyIn)} from clients, ${formatPeso(week.moneyOut)} to suppliers`}
                  className="outline-none focus-visible:stroke-ring" onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
        {active !== null ? <OutlookTooltip week={weeks[active]} flip={active >= weeks.length / 2} edge={((PAD.left + column * (active >= weeks.length / 2 ? active : active + 1)) / W) * 100} /> : null}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm" style={{ background: MONEY_IN }} />Due in from clients</span>
      <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm" style={{ background: MONEY_OUT }} />Due out to suppliers</span>
    </div>
  );
}

/** The next eight weeks of money due in and out, plus whatever is already late, so PMCM can see a tight week coming. */
export function CashOutlookChart({ weeks }: { weeks: OutlookWeek[] }) {
  const [table, setTable] = useState(false);
  return (
    <PrismSection id="finance-outlook" title="Cash outlook" description="Due in and out over eight weeks, late money first." action={<ViewToggle table={table} onChange={setTable} />}>
      {table ? (
        <DataTable
          head={["Week", "From clients", "To suppliers", "Net"]}
          rows={weeks.map((week) => [week.label, formatPeso(week.moneyIn), formatPeso(week.moneyOut), `${week.moneyIn < week.moneyOut ? "−" : ""}${formatPeso(Math.abs(week.moneyIn - week.moneyOut))}`])}
        />
      ) : (
        <>
          <Legend />
          <OutlookPlot weeks={weeks} />
        </>
      )}
    </PrismSection>
  );
}
