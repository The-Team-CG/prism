"use client";

import Link from "next/link";
import type { PrismEventRunSheet, PrismRunSheetGuestOperations } from "@prism/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { useRunSheetViewModel } from "../view-models/use-run-sheet-view-model";
import { LoadingState } from "@prism/ui/components/loading-state";
import {
  RUN_SHEET_KIND_LABELS,
  formatRunSheetDate,
  formatRunSheetTime,
  type RunSheetTimeline,
  type RunSheetTimelineRow,
} from "../model/run-sheet-timeline";

const words = (value: string) => {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export type LiveOpsRunSheetViewProps = {
  runSheet: PrismEventRunSheet | null;
  timeline: RunSheetTimeline | null;
  unavailable: boolean;
  loading: boolean;
  error: string | null;
  now: Date;
  selectedDayId?: string;
  printable?: boolean;
  /** Where the schedule is authored; offered when no run sheet exists yet. */
  scheduleHref?: string;
  /** The calendar this run sheet is one day of; offered as a way back. */
  calendarHref?: string;
  onSelectDay(dayId: string): void;
  onReload(): void;
  onPrint?(): void;
};

/** Event-scoped, role-projected run sheet. The API decides which entries this actor may see. */
export function LiveOpsRunSheet({ eventId, printable = false, scheduleHref, calendarHref, dayId }: { eventId: string; printable?: boolean; scheduleHref?: string; calendarHref?: string; dayId?: string }) {
  const vm = useRunSheetViewModel(eventId, dayId);
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
      scheduleHref={scheduleHref}
      calendarHref={calendarHref}
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
      className={`space-y-4 ${props.printable ? "prism-print-region rounded-lg border border-border bg-card p-5 print:border-0 print:p-0" : ""}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="run-sheet-heading" className="text-lg font-semibold text-foreground">Event day run sheet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {runSheet ? [runSheet.day.label, formatRunSheetDate(runSheet.day.dayDate)].filter(Boolean).join(" · ") : "Time-ordered program, supplier windows, task deadlines and open issues."}
          </p>
          {runSheet?.scope === "coordinator" ? (
            <p className="mt-1 text-xs text-muted-foreground">Showing what your assignment allows. Finance, private supplier notes and audit records are not included.</p>
          ) : null}
        </div>
        <RunSheetControls props={props} />
      </header>

      <RunSheetMessages props={props} />

      {runSheet && timeline ? <RunSheetBody runSheet={runSheet} timeline={timeline} now={props.now} /> : null}
    </section>
  );
}

function RunSheetControls({ props }: { props: LiveOpsRunSheetViewProps }) {
  const { runSheet } = props;
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {props.calendarHref ? (
        <Link href={props.calendarHref} className="inline-flex min-h-9 items-center rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-foreground no-underline">
          Back to calendar
        </Link>
      ) : null}
      {runSheet && runSheet.days.length > 1 ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Day</span>
          <Select value={props.selectedDayId ?? runSheet.day.id} onValueChange={props.onSelectDay}>
            <SelectTrigger aria-label="Run sheet day" className="h-auto min-w-48 bg-background px-2 py-1.5 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {runSheet.days.map((day) => (
                <SelectItem key={day.id} value={day.id}>{day.label ? `${day.label} (${day.dayDate})` : day.dayDate}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}
      {runSheet || props.error ? (
        <button type="button" onClick={props.onReload} disabled={props.loading} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold">
          Refresh
        </button>
      ) : null}
      {props.onPrint && runSheet ? (
        <button type="button" onClick={props.onPrint} className="rounded-md bg-foreground px-3 py-1.5 text-sm font-semibold text-background">
          Print run sheet
        </button>
      ) : null}
    </div>
  );
}

function RunSheetMessages({ props }: { props: LiveOpsRunSheetViewProps }) {
  return (
    <>
      {props.loading && !props.runSheet && !props.unavailable ? <LoadingState label="Loading run sheet…" /> : null}
      {props.error ? <p role="alert" className="text-sm text-destructive">{props.error}</p> : null}
      {props.unavailable ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-4">
          <p className="text-sm text-muted-foreground">No run sheet is available until the event schedule is authored.</p>
          {props.scheduleHref ? (
            <Link href={props.scheduleHref} className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm font-semibold text-foreground no-underline">
              Author the schedule in live operations
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function RunSheetBody({ runSheet, timeline, now }: { runSheet: PrismEventRunSheet; timeline: RunSheetTimeline; now: Date }) {
  return (
    <>
      {runSheet.guestOperations ? <GuestOperationsPanel guestOperations={runSheet.guestOperations} /> : (
        <p className="text-xs text-muted-foreground">Guest operations are not shared with this role.</p>
      )}
      {!runSheet.supplierWindowsVisible ? (
        <p className="text-xs text-muted-foreground">Supplier ingress and egress windows are not shared with this role.</p>
      ) : null}
      {timeline.rows.length ? (
        <RunSheetRows timeline={timeline} now={now} />
      ) : (
        <p className="text-sm text-muted-foreground">Nothing is scheduled for this day yet.</p>
      )}
      <p className="text-xs text-muted-foreground">Generated {formatRunSheetDate(runSheet.generatedAt)} {formatRunSheetTime(runSheet.generatedAt)}</p>
    </>
  );
}

/** Untimed planned guest work: registration setup, headcount, roster verification, walk-in policy and desk staffing. */
function GuestOperationsPanel({ guestOperations }: { guestOperations: PrismRunSheetGuestOperations }) {
  const { registrationPlatform, walkIn, rosterVerification, registrationStaff } = guestOperations;
  return (
    <section aria-labelledby="run-sheet-guest-operations" className="space-y-2 rounded-lg border border-border p-4 text-sm">
      <h3 id="run-sheet-guest-operations" className="font-semibold text-foreground">Guest operations</h3>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Registration</dt>
          <dd className="text-foreground">
            {registrationPlatform
              ? `${words(registrationPlatform.platformType)} · ${words(registrationPlatform.status)} · setup ${words(registrationPlatform.setupConfirmationStatus)} · expected ${registrationPlatform.expectedPaxMin}–${registrationPlatform.expectedPaxMax} guests`
              : "No registration platform configured"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Walk-ins</dt>
          <dd className="text-foreground">
            {walkIn
              ? walkIn.policy === "threshold" && walkIn.threshold !== null
                ? `At threshold of ${walkIn.threshold}`
                : words(walkIn.policy)
              : "Not recorded"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Roster verification</dt>
          <dd className="text-foreground">
            {rosterVerification.verified} verified · {rosterVerification.pending} pending
            {rosterVerification.flagged ? ` · ${rosterVerification.flagged} flagged for verification` : ""}
          </dd>
        </div>
      </dl>
      <div>
        <p className="text-xs text-muted-foreground">Registration and usher staff</p>
        {registrationStaff.length ? (
          <ul className="mt-1 space-y-0.5">
            {registrationStaff.map((staff) => (
              <li key={`${staff.coordinatorName}:${staff.role}`} className="text-foreground">
                {[staff.coordinatorName, staff.role, words(staff.status)].join(" · ")}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No registration or usher staff are assigned.</p>
        )}
      </div>
    </section>
  );
}

function RunSheetRows({ timeline, now }: { timeline: RunSheetTimeline; now: Date }) {
  const marker = (
    <li key="now-marker" role="separator" aria-label="Now" className="flex items-center gap-2 py-1 text-xs font-semibold text-primary print:hidden">
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

function runSheetRowFlags(row: RunSheetTimelineRow) {
  return [
    row.overdue ? "Overdue" : null,
    row.carriedOver ? `Carried over from ${formatRunSheetDate(row.at)}` : null,
  ].filter(Boolean);
}

function runSheetRowClassName(row: RunSheetTimelineRow) {
  return `grid grid-cols-[5.5rem_1fr_auto] gap-3 py-2 text-sm break-inside-avoid ${row.overdue ? "border-l-2 border-destructive pl-2" : ""} ${row.past && !row.overdue ? "text-muted-foreground" : ""}`;
}

function RunSheetRow({ row }: { row: RunSheetTimelineRow }) {
  const flags = runSheetRowFlags(row);
  return (
    <li
      data-kind={row.kind}
      data-overdue={row.overdue ? "true" : undefined}
      className={runSheetRowClassName(row)}
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
