"use client";

import { CalendarClock, CheckCircle2, ClipboardList, Radio } from "lucide-react";
import type { PrismCoordinatorAssignment, PrismCoordinatorRoleView, PrismEvent } from "@prism/types";
import { prismCalendarDateKey } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { PrismListRow } from "@prism/ui/action-list";
import { EventCover } from "@prism/ui/event-cards";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import { PrismEmptyLine, PrismHero, PrismSection, PrismStatRow } from "@prism/ui/page-blocks";
import { useEventCoverUrl } from "@/features/pmcm-overview";
import { eventCountdown, isOpenTask, openIssues, shiftNextUp, type ShiftItem } from "../../model/coordinator-shift";
import { coordinatorAttendanceSummary } from "../../model/coordinator-view-copy";
import { recordedAttendanceLabel } from "../../model/coordinators-desk-rules";
import { CoordinatorAttendanceControl, CoordinatorRoleError, CoordinatorRoleLoading, type CoordinatorAttendanceFormModel } from "./coordinator-role-sections";

export type CoordinatorShiftView = "tasks" | "issues" | "run-sheet" | "registration";

function heroLabel(countdown: ReturnType<typeof eventCountdown>) {
  if (!countdown) return "Your event";
  return countdown.value === "Today" ? "Today's event" : "Your next event";
}

/** The event this shift is for, over its cover: the countdown, your role and whether PMCM has your confirmation. */
function ShiftLead({ event, assignment, roleName, busy, onAcknowledge }: {
  event: PrismEvent;
  assignment?: PrismCoordinatorAssignment;
  roleName: string;
  busy: boolean;
  onAcknowledge: () => void;
}) {
  const coverUrl = useEventCoverUrl(event.id, event.coverObjectId);
  const countdown = eventCountdown(event.eventDate, prismCalendarDateKey());
  const confirmed = assignment?.status === "acknowledged";
  const attendance = assignment?.attendanceStatus ?? "pending";
  return (
    <PrismHero
      label={heroLabel(countdown)}
      title={event.eventName}
      meta={<p>{[formatPortalDate(event.eventDate), event.venue, `Client: ${event.clientName}`].filter(Boolean).join(" · ")}</p>}
      figure={countdown}
      backdrop={<EventCover eventType={event.eventType} imageUrl={coverUrl} tag={false} className="h-full" />}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-foreground/70">Your role</p>
          <p className="text-base font-semibold">{roleName}</p>
        </div>
        {assignment && !confirmed ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink-foreground/80">PMCM is waiting for you to confirm.</p>
            <Button disabled={busy} onClick={() => onAcknowledge()} className="min-h-11 font-semibold">Confirm assignment</Button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-ink-foreground/80">
            {assignment ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : null}
            {assignment ? `Confirmed with PMCM · ${coordinatorAttendanceSummary(attendance, recordedAttendanceLabel(attendance) ?? attendance)}` : "No assignment on this event."}
          </p>
        )}
      </div>
    </PrismHero>
  );
}

function NextUpRow({ item, onNavigate }: { item: ShiftItem; onNavigate: (view: CoordinatorShiftView) => void }) {
  return (
    <PrismListRow
      icon={item.kind === "issue" ? Radio : ClipboardList}
      tone={item.tone}
      title={item.title}
      meta={item.detail}
      metaTitle={item.detail}
      status={item.due ? formatPortalDateTime(item.due) : "No deadline"}
      statusTone={item.tone === "urgent" ? "urgent" : "neutral"}
      action={item.kind === "issue" ? "Open issues" : "Open tasks"}
      onOpen={() => onNavigate(item.kind === "issue" ? "issues" : "tasks")}
    />
  );
}

function ShiftWork({ roleView, registrationRole, onNavigate }: { roleView: PrismCoordinatorRoleView; registrationRole: boolean; onNavigate: (view: CoordinatorShiftView) => void }) {
  const tasks = roleView.tasks.filter(isOpenTask);
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const issues = openIssues(roleView.urgentIssues);
  const urgent = issues.filter((issue) => issue.slaStatus === "overdue" || issue.severity === "critical").length;
  const suppliers = roleView.supplierStatuses.filter((supplier) => supplier.eventDayStatus).length;
  const next = shiftNextUp(roleView);
  const waiting = tasks.length + issues.length;
  return (
    <>
      <PrismStatRow
        label="Your shift"
        stats={[
          { label: "Open tasks", value: tasks.length, detail: blocked ? `${blocked} blocked` : undefined, tone: blocked ? "urgent" : "neutral" },
          { label: "Open issues", value: issues.length, detail: urgent ? `${urgent} urgent` : undefined, tone: urgent ? "urgent" : issues.length ? "attention" : "neutral" },
          { label: "Guests checked in", value: roleView.guestAttendanceCount, detail: registrationRole ? "Open Registration for the list" : undefined, empty: roleView.guestAttendanceCount === 0 && !registrationRole },
          { label: "Supplier updates", value: suppliers, detail: `of ${roleView.supplierStatuses.length} suppliers`, empty: roleView.supplierStatuses.length === 0 },
        ]}
      />
      <PrismSection
        id="coordinator-next-up"
        title="Waiting on you"
        count={waiting}
        description={waiting > next.length ? `The ${next.length} most pressing. Tasks and Issues have the rest.` : "Issues first, then tasks by deadline."}
        action={<Button type="button" size="sm" variant="outline" onClick={() => onNavigate("run-sheet")}><CalendarClock className="size-4" aria-hidden />Run sheet</Button>}
        flush
      >
        {next.length ? (
          <ul className="divide-y divide-border">{next.map((item) => <NextUpRow key={`${item.kind}-${item.id}`} item={item} onNavigate={onNavigate} />)}</ul>
        ) : (
          <PrismEmptyLine icon={CheckCircle2} className="px-5 py-4">Nothing is waiting on you. Tasks assigned to your role and open issues on this event show up here.</PrismEmptyLine>
        )}
      </PrismSection>
    </>
  );
}

/**
 * My shift: the event, then the one thing a coordinator does on arrival (mark attendance), then what is waiting on
 * them. Every figure and row opens the view that holds its detail.
 */
export function CoordinatorShiftPage({ event, assignment, roleName, busy, roleView, roleViewLoading, roleViewError, registrationRole, attendanceForm, onAcknowledge, onNavigate }: {
  event: PrismEvent;
  assignment?: PrismCoordinatorAssignment;
  roleName: string;
  busy: boolean;
  roleView: PrismCoordinatorRoleView | null;
  roleViewLoading: boolean;
  roleViewError: string | null;
  registrationRole: boolean;
  attendanceForm: CoordinatorAttendanceFormModel;
  onAcknowledge: () => void;
  onNavigate: (view: CoordinatorShiftView) => void;
}) {
  return (
    <div className="grid gap-6">
      <ShiftLead event={event} assignment={assignment} roleName={roleName} busy={busy} onAcknowledge={onAcknowledge} />
      {assignment ? (
        <PrismSection id="coordinator-attendance-title" title="Your attendance" description="Mark it when you arrive. PMCM sees it straight away.">
          <CoordinatorAttendanceControl attendanceForm={attendanceForm} />
        </PrismSection>
      ) : null}
      {roleViewError ? <CoordinatorRoleError message={roleViewError} /> : null}
      {!roleViewError && roleView ? <ShiftWork roleView={roleView} registrationRole={registrationRole} onNavigate={onNavigate} /> : null}
      {!roleViewError && !roleView && roleViewLoading ? <CoordinatorRoleLoading /> : null}
    </div>
  );
}
