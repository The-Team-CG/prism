"use client";

import { CalendarCheck, CalendarClock, ChevronRight, History, ShieldCheck } from "lucide-react";
import type { PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
import { prismCalendarDateKey } from "@prism/types";
import { PrismListRow } from "@prism/ui/action-list";
import { formatPortalDate } from "@prism/ui/format-date";
import { PrismEmptyLine, PrismSection, PrismStatRow } from "@prism/ui/page-blocks";
import { coordinatorAssignmentHistory, type AssignmentHistoryRow } from "../../model/coordinator-assignment-history";
import { CoordinatorAssignmentActions } from "./coordinator-view-sections";

function rowMeta(row: AssignmentHistoryRow): string {
  const reason = row.assignment.withdrawalReason || row.assignment.replacementReason;
  return [row.dateKey ? formatPortalDate(row.dateKey) : "Date to be confirmed", row.assignment.role, reason || null].filter(Boolean).join(" · ");
}

function AssignmentRow({ row, onOpen }: { row: AssignmentHistoryRow; onOpen?: () => void }) {
  return (
    <PrismListRow
      icon={row.tone === "attention" ? CalendarClock : CalendarCheck}
      tone={row.tone}
      title={row.eventName}
      meta={rowMeta(row)}
      metaTitle={rowMeta(row)}
      status={row.outcome}
      action={onOpen ? "Open" : undefined}
      onOpen={onOpen}
    />
  );
}

/** One year of past events, folded; the latest year opens. */
function PastYear({ year, rows, open, canOpen, onOpen }: { year: string; rows: AssignmentHistoryRow[]; open: boolean; canOpen: (row: AssignmentHistoryRow) => boolean; onOpen: (eventId: string) => void }) {
  return (
    <details open={open} className="group border-t border-border first:border-t-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-semibold text-foreground hover:bg-surface-raised [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
        {year}
        <span className="font-normal tabular-nums text-muted-foreground">{rows.length} {rows.length === 1 ? "event" : "events"}</span>
      </summary>
      <ul className="divide-y divide-border border-t border-border">
        {rows.map((row) => <AssignmentRow key={row.assignment.id} row={row} onOpen={canOpen(row) ? () => onOpen(row.assignment.eventId) : undefined} />)}
      </ul>
    </details>
  );
}

/**
 * Assignments: the open event's assignment with its decisions, the coordinator's record with PMCM, what is coming up
 * and every past event by year. Rows open their event on My shift.
 */
export function CoordinatorAssignmentsPage({ event, assignment, assignments, events, busy, onAcknowledge, onDecline, onWithdraw, onOpenEvent }: {
  event?: PrismEvent;
  assignment?: PrismCoordinatorAssignment;
  assignments: PrismCoordinatorAssignment[];
  events: PrismEvent[];
  busy: boolean;
  onAcknowledge: () => void;
  onDecline: (reason?: string) => void;
  onWithdraw: () => void;
  onOpenEvent: (eventId: string) => void;
}) {
  const history = coordinatorAssignmentHistory(assignments, events, prismCalendarDateKey());
  const known = new Set(events.map((item) => item.id));
  const canOpen = (row: AssignmentHistoryRow) => known.has(row.assignment.eventId) && row.outcome !== "Replaced" && row.outcome !== "Declined" && row.outcome !== "Cancelled by PMCM";
  const { record } = history;
  return (
    <div className="grid gap-6">
      {event && assignment ? (
        <PrismSection
          id="coordinator-this-assignment"
          title={event.eventName}
          description={`${formatPortalDate(event.eventDate)} · ${assignment.role} · ${assignment.status === "acknowledged" ? "You confirmed this assignment." : "PMCM is waiting for your answer."}`}
          action={<CoordinatorAssignmentActions status={assignment.status} busy={busy} onAcknowledge={onAcknowledge} onDecline={onDecline} onWithdraw={onWithdraw} />}
        >
          <p className="text-sm text-muted-foreground">
            Withdrawing within 48 hours of the event is an emergency change: PMCM has to find a replacement, so call them as well.
          </p>
        </PrismSection>
      ) : null}
      <PrismStatRow
        label="Your record with PMCM"
        stats={[
          { label: "Events worked", value: record.worked },
          { label: "Coming up", value: record.upcoming },
          { label: "Present", value: record.present, empty: record.present === 0 },
          { label: "Late arrivals", value: record.late, tone: "attention", empty: record.late === 0 },
          { label: "Absences", value: record.absent, tone: "urgent", empty: record.absent === 0 },
        ]}
      />
      <PrismSection id="coordinator-upcoming" title="Coming up" count={history.upcoming.length} description="Soonest first. Confirm each one so PMCM can plan around you." flush>
        {history.upcoming.length ? (
          <ul className="divide-y divide-border">
            {history.upcoming.map((row) => <AssignmentRow key={row.assignment.id} row={row} onOpen={canOpen(row) ? () => onOpenEvent(row.assignment.eventId) : undefined} />)}
          </ul>
        ) : (
          <PrismEmptyLine icon={CalendarClock} className="px-5 py-4">No upcoming assignments. PMCM will assign you to events here.</PrismEmptyLine>
        )}
      </PrismSection>
      <PrismSection id="coordinator-past" title="Past events" count={history.past.reduce((sum, year) => sum + year.rows.length, 0)} description="How each event went for you, newest first." flush>
        {history.past.length ? (
          history.past.map((year, index) => <PastYear key={year.year} year={year.year} rows={year.rows} open={index === 0} canOpen={canOpen} onOpen={onOpenEvent} />)
        ) : (
          <PrismEmptyLine icon={History} className="px-5 py-4">No past events yet.</PrismEmptyLine>
        )}
      </PrismSection>
      <PrismEmptyLine icon={ShieldCheck}>
        This portal shows only your work: tasks, issues, the run sheet and attendance. Billing, costs, audit records and PMCM&apos;s private supplier notes are never shown here, and guest details only to the registration coordinator.
      </PrismEmptyLine>
    </div>
  );
}
