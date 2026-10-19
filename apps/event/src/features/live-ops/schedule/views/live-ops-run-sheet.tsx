"use client";

import type { PrismEventRunSheet } from "@prism/types";
import { useRunSheetViewModel } from "../view-models/use-run-sheet-view-model";
import {
  RUN_SHEET_KIND_LABELS,
  formatRunSheetDate,
  formatRunSheetTime,
  type RunSheetTimeline,
  type RunSheetTimelineRow,
} from "../model/run-sheet-timeline";

const words = (value: string) => value.replaceAll("_", " ");

export type LiveOpsRunSheetViewProps = {
  runSheet: PrismEventRunSheet | null;
  timeline: RunSheetTimeline | null;
  unavailable: boolean;
  loading: boolean;
  error: string | null;
  now: Date;
  selectedDayId?: string;
  printable?: boolean;
  onSelectDay(dayId: string): void;
  onReload(): void;
  onPrint?(): void;
};

/** Event-scoped, role-projected run sheet. The API decides which entries this actor may see. */
export function LiveOpsRunSheet({ eventId, printable = false }: { eventId: string; printable?: boolean }) {
  const vm = useRunSheetViewModel(eventId);
  return (
    <LiveOpsRunSheetView
      runSheet={vm.runSheet}
      timeline={vm.timeline}
      unavailable={vm.unavailable}
      loading={vm.loading}
      error={vm.error}
      now={vm.now}
      selectedDayId={vm.selectedDayId}
      printable={printable}
      onSelectDay={vm.selectDay}
      onReload={() => void vm.reload()}
      onPrint={printable ? () => window.print() : undefined}
    />
  );
}

export function LiveOpsRunSheetView(props: LiveOpsRunSheetViewProps) {
  const { runSheet, timeline } = props;
  return (
    <section
      aria-labelledby="run-sheet-heading"
      className={`space-y-4 ${props.printable ? "prism-print-region rounded-xl border border-border bg-card p-5 print:border-0 print:p-0" : ""}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="run-sheet-heading" className="text-lg font-bold text-foreground">Event day run sheet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {runSheet ? `${runSheet.day.label || runSheet.day.dayDate} · ${runSheet.day.dayDate}` : "Time-ordered program, supplier windows, task deadlines and open issues."}
          </p>
          {runSheet?.scope === "coordinator" ? (
            <p className="mt-1 text-xs text-muted-foreground">Showing what your assignment allows. Finance, private supplier notes and audit records are not included.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {runSheet && runSheet.days.length > 1 ? (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Day</span>
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={props.selectedDayId ?? runSheet.day.id}
                onChange={(event) => props.onSelectDay(event.target.value)}
              >
                {runSheet.days.map((day) => (
                  <option key={day.id} value={day.id}>{day.label ? `${day.label} (${day.dayDate})` : day.dayDate}</option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="button" onClick={props.onReload} disabled={props.loading} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold">
            Refresh
          </button>
          {props.onPrint ? (
            <button type="button" onClick={props.onPrint} disabled={!runSheet} className="rounded-md bg-foreground px-3 py-1.5 text-sm font-semibold text-background">
              Print run sheet
            </button>
          ) : null}
        </div>
      </header>

      {props.loading && !runSheet && !props.unavailable ? <p role="status" className="text-sm text-muted-foreground">Loading run sheet…</p> : null}
      {props.error ? <p role="alert" className="text-sm text-destructive">{props.error}</p> : null}
      {props.unavailable ? <p className="text-sm text-muted-foreground">No run sheet is available until the event schedule is authored.</p> : null}

      {runSheet && timeline ? (
        <>
          {!runSheet.supplierWindowsVisible ? (
            <p className="text-xs text-muted-foreground">Supplier ingress and egress windows are not shared with this role.</p>
          ) : null}
          {timeline.rows.length ? (
            <RunSheetRows timeline={timeline} now={props.now} />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing is scheduled for this day yet.</p>
          )}
          <p className="text-xs text-muted-foreground">Generated {formatRunSheetDate(runSheet.generatedAt)} {formatRunSheetTime(runSheet.generatedAt)}</p>
        </>
      ) : null}
    </section>
  );
}

function RunSheetRows({ timeline, now }: { timeline: RunSheetTimeline; now: Date }) {
  const marker = (
    <li key="now-marker" role="separator" aria-label="Now" className="flex items-center gap-2 py-1 text-xs font-semibold text-(--prism-signal) print:hidden">
      <span className="h-px flex-1 bg-current" />
      <span>Now {formatRunSheetTime(now.toISOString())}</span>
      <span className="h-px flex-1 bg-current" />
    </li>
  );
  const items = timeline.rows.flatMap((row, index) => [
    ...(index === timeline.nowIndex ? [marker] : []),
    <RunSheetRow key={row.id} row={row} />,
  ]);
  if (timeline.nowIndex === timeline.rows.length) items.push(marker);
  return <ol aria-label="Run sheet entries" className="divide-y divide-border">{items}</ol>;
}

function RunSheetRow({ row }: { row: RunSheetTimelineRow }) {
  const flags = [
    row.overdue ? "Overdue" : null,
    row.carriedOver ? `Carried over from ${formatRunSheetDate(row.at)}` : null,
  ].filter(Boolean);
  return (
    <li
      data-kind={row.kind}
      data-overdue={row.overdue ? "true" : undefined}
      className={`grid grid-cols-[5.5rem_1fr_auto] gap-3 py-2 text-sm break-inside-avoid ${row.overdue ? "border-l-2 border-destructive pl-2" : ""} ${row.past && !row.overdue ? "text-muted-foreground" : ""}`}
    >
      <time dateTime={row.at} className="font-semibold tabular-nums">
        {formatRunSheetTime(row.at)}
        {row.endAt ? <span className="block text-xs font-normal text-muted-foreground">to {formatRunSheetTime(row.endAt)}</span> : null}
      </time>
      <div>
        <p className="font-semibold text-foreground">{row.title}</p>
        <p className="text-xs text-muted-foreground">
          {[RUN_SHEET_KIND_LABELS[row.kind], row.ownerLabel, row.location].filter(Boolean).join(" · ")}
        </p>
        {flags.length ? <p className={`text-xs ${row.overdue ? "text-destructive" : "text-muted-foreground"}`}>{flags.join(" · ")}</p> : null}
      </div>
      <div className="text-right text-xs">
        <span className="text-foreground">{words(row.status)}</span>
        {row.severity ? <span className="block text-muted-foreground">{words(row.severity)}</span> : null}
      </div>
    </li>
  );
}
