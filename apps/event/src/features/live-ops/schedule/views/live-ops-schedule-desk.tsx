"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  COORDINATOR_ROLES,
  canonicalCoordinatorRole,
  type CoordinatorRole,
  type PrismCoordinatorAssignment,
  type PrismEventEodReport,
  type PrismEventHandoff,
  type PrismEventScheduleDay,
} from "@prism/types";
import { DatePicker } from "@prism/ui/components/date-picker";
import { useLiveOpsScheduleDeskViewModel } from "../view-models/use-live-ops-schedule-desk-view-model";

type LiveOpsScheduleDeskProps = {
  eventId: string;
  assignments: PrismCoordinatorAssignment[];
  canManageSchedule: boolean;
  canStartEventDay?: boolean;
  canReplyToReports: boolean;
  canSubmitReports: boolean;
};

export function LiveOpsScheduleDesk({
  eventId,
  assignments,
  canManageSchedule,
  canStartEventDay = false,
  canReplyToReports,
  canSubmitReports,
}: LiveOpsScheduleDeskProps) {
  const vm = useLiveOpsScheduleDeskViewModel(eventId);
  const days = vm.schedule?.days ?? [];

  return (
    <section aria-labelledby="event-day-records-heading" className="space-y-5 rounded-xl border border-border bg-card p-5">
      <ScheduleDeskHeader vm={vm} canStartEventDay={canStartEventDay} />

      {vm.status === "loading" && !vm.schedule ? <p role="status" className="text-sm text-muted-foreground">Loading schedule and reports…</p> : null}
      {vm.error ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-destructive">{vm.error}</p>
          <button type="button" onClick={() => void vm.reload()} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold">Retry</button>
        </div>
      ) : null}
      {vm.notice ? <p role="status" className="text-sm font-semibold text-success dark:text-emerald-300">{vm.notice}</p> : null}

      <ScheduleAuthoringSection days={days} vm={vm} canManageSchedule={canManageSchedule} />

      <section aria-labelledby="handoffs-heading" className="space-y-4 border-t border-border pt-4">
        <div>
          <h3 id="handoffs-heading" className="font-bold text-foreground">Shift handoffs</h3>
          <p className="text-sm text-muted-foreground">Record who received the shift and the items still outstanding.</p>
        </div>
        {days.length ? (
          <HandoffForm days={days} assignments={assignments} busy={vm.busy} onCreate={vm.createHandoff} />
        ) : (
          <p className="text-sm text-muted-foreground">Add a schedule day before recording a handoff.</p>
        )}
        {vm.handoffs.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {vm.handoffs.map((handoff) => (
              <HandoffRow key={handoff.id} handoff={handoff} days={days} assignments={assignments} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No shift handoffs have been recorded.</p>
        )}
      </section>

      <section aria-labelledby="eod-heading" className="space-y-4 border-t border-border pt-4">
        <div>
          <h3 id="eod-heading" className="font-bold text-foreground">End-of-day reports</h3>
          <p className="text-sm text-muted-foreground">Capture completed work, open issues, and risks to carry into tomorrow.</p>
        </div>
        {!canSubmitReports ? (
          <p className="text-sm text-muted-foreground">Assigned coordinators submit end-of-day reports. PMCM can review reports and reply below.</p>
        ) : days.length ? (
          <EodReportForm days={days} reports={vm.reports} busy={vm.busy} onSubmit={vm.submitReport} />
        ) : (
          <p className="text-sm text-muted-foreground">Add a schedule day before submitting an end-of-day report.</p>
        )}
        {vm.reports.length ? (
          <div className="space-y-3">
            {vm.reports.map((report) => (
              <EodReportCard
                key={report.id}
                report={report}
                day={days.find((candidate) => candidate.id === report.dayId)}
                busy={vm.busy}
                canReply={canReplyToReports}
                onReply={(value) => vm.replyToReport(report.id, value)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No end-of-day reports have been submitted.</p>
        )}
      </section>
    </section>
  );
}

function ScheduleDeskHeader({ vm, canStartEventDay }: { vm: ReturnType<typeof useLiveOpsScheduleDeskViewModel>; canStartEventDay: boolean }) {
  return (
      <header>
        <h2 id="event-day-records-heading" className="text-lg font-bold text-foreground">Event-day schedule and reports</h2>
        <p className="mt-1 text-sm text-muted-foreground">Author the run sheet, record shift handoffs, and submit end-of-day notes.</p>
        {canStartEventDay && vm.eventStatus && !['event_day', 'archived', 'cancelled', 'postponed', 'date_to_be_confirmed', 'completed', 'closure'].includes(vm.eventStatus) ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" disabled={vm.busy} onClick={() => void vm.startEventDay()} className={primaryButtonClass}>Start event day</button>
            <p className="text-sm text-muted-foreground">Requires signed conforme and an approved official floorplan.</p>
          </div>
        ) : null}
        {vm.eventStatus === 'event_day' ? <p className="mt-3 text-sm font-semibold text-success">Event day is active</p> : null}
      </header>
  );
}

function ScheduleDayForm({ busy, onCreate }: { busy: boolean; onCreate: (value: unknown) => Promise<boolean> }) {
  const [dayDate, setDayDate] = useState("");
  const [label, setLabel] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onCreate({ dayDate, label: label || undefined });
    if (saved) { setDayDate(""); setLabel(""); }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-end">
      <div className="grid gap-1.5">
        <span className="text-sm font-semibold text-foreground">Day date</span>
        <DatePicker aria-label="Day date" required value={dayDate} onValueChange={setDayDate} className={inputClass} />
      </div>
      <Field label="Day label (optional)">
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Setup, event day, strike…" className={inputClass} />
      </Field>
      <button type="submit" disabled={busy} className={primaryButtonClass}>Add day</button>
    </form>
  );
}

function ScheduleDayCard({
  day,
  canManageSchedule,
  busy,
  onCreateSegment,
  onUpdateSegmentStatus,
}: {
  day: PrismEventScheduleDay;
  canManageSchedule: boolean;
  busy: boolean;
  onCreateSegment: (dayId: string, value: { title: string; plannedStartAt: string; plannedEndAt: string; ownerRole: string; location?: string; sequence: number }) => Promise<boolean>;
  onUpdateSegmentStatus: (segmentId: string, action: string) => Promise<boolean>;
}) {
  return (
    <article className="space-y-3 rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-semibold text-foreground">{day.label || formatDate(day.dayDate)}</h4>
        <span className="text-sm text-muted-foreground">{formatDate(day.dayDate)} · {day.status}</span>
      </div>
      {day.segments.length ? (
        <ul className="space-y-2">
          {day.segments.map((segment) => {
            const actions = segment.status === "planned" ? ["start", "skip"] : segment.status === "active" ? ["stop", "skip"] : [];
            return (
              <li key={segment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 p-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{segment.title}</p>
                  <p className="text-sm text-muted-foreground">{formatTime(segment.plannedStartAt)}–{formatTime(segment.plannedEndAt)} · {segment.ownerRole}{segment.location ? ` · ${segment.location}` : ""}</p>
                  <p className="text-xs text-muted-foreground">Status: {segment.status}</p>
                </div>
                {canManageSchedule && actions.length ? (
                  <div className="flex gap-2">
                    {actions.map((action) => (
                      <button key={action} type="button" disabled={busy} onClick={() => void onUpdateSegmentStatus(segment.id, action)} className={secondaryButtonClass}>
                        {action === "start" ? "Start" : action === "stop" ? "Complete" : "Skip"}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : <p className="text-sm text-muted-foreground">No segments on this day.</p>}
      {canManageSchedule ? <ScheduleSegmentForm day={day} busy={busy} onCreate={onCreateSegment} /> : null}
    </article>
  );
}

function ScheduleSegmentForm({ day, busy, onCreate }: {
  day: PrismEventScheduleDay;
  busy: boolean;
  onCreate: (dayId: string, value: { title: string; plannedStartAt: string; plannedEndAt: string; ownerRole: string; location?: string; sequence: number }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [ownerRole, setOwnerRole] = useState<CoordinatorRole>(COORDINATOR_ROLES[0]);
  const [location, setLocation] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onCreate(day.id, {
      title,
      plannedStartAt: start,
      plannedEndAt: end,
      ownerRole,
      location: location || undefined,
      sequence: day.segments.length,
    });
    if (saved) { setTitle(""); setStart(""); setEnd(""); setLocation(""); }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2 xl:grid-cols-5">
      <Field label="Segment title"><input required value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} /></Field>
      <Field label="Starts"><input type="datetime-local" required value={start} onChange={(event) => setStart(event.target.value)} className={inputClass} /></Field>
      <Field label="Ends"><input type="datetime-local" required value={end} onChange={(event) => setEnd(event.target.value)} className={inputClass} /></Field>
      <Field label="Owner role">
        <select value={ownerRole} onChange={(event) => setOwnerRole(event.target.value as CoordinatorRole)} className={inputClass}>
          {COORDINATOR_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
      </Field>
      <div className="flex items-end gap-2">
        <Field label="Location" className="min-w-0 flex-1"><input value={location} onChange={(event) => setLocation(event.target.value)} className={inputClass} /></Field>
        <button type="submit" disabled={busy} className={primaryButtonClass}>Add</button>
      </div>
    </form>
  );
}

function HandoffForm({ days, assignments, busy, onCreate }: {
  days: PrismEventScheduleDay[];
  assignments: PrismCoordinatorAssignment[];
  busy: boolean;
  onCreate: (value: unknown) => Promise<boolean>;
}) {
  const [dayId, setDayId] = useState("");
  const [role, setRole] = useState<CoordinatorRole>(COORDINATOR_ROLES[0]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [items, setItems] = useState("");
  const candidates = useMemo(() => assignments.filter((assignment) =>
    canonicalCoordinatorRole(assignment.role) === role && !["declined", "cancelled", "replaced"].includes(assignment.status),
  ), [assignments, role]);
  const selectedDayId = days.some((day) => day.id === dayId) ? dayId : days[0]?.id ?? "";
  const selectedFromId = candidates.some((assignment) => assignment.id === fromId) ? fromId : candidates[0]?.id ?? "";
  const selectedToId = candidates.some((assignment) => assignment.id === toId && assignment.id !== selectedFromId)
    ? toId
    : candidates.find((assignment) => assignment.id !== selectedFromId)?.id ?? "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onCreate({
      dayId: selectedDayId,
      role,
      fromAssignmentId: selectedFromId,
      toAssignmentId: selectedToId,
      outstandingItems: splitLines(items),
    });
    if (saved) { setItems(""); setFromId(""); setToId(""); }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-2 xl:grid-cols-5">
      <Field label="Schedule day">
        <select value={selectedDayId} onChange={(event) => setDayId(event.target.value)} className={inputClass}>
          {days.map((day) => <option key={day.id} value={day.id}>{day.label || formatDate(day.dayDate)}</option>)}
        </select>
      </Field>
      <Field label="Role">
        <select value={role} onChange={(event) => { setRole(event.target.value as CoordinatorRole); setFromId(""); setToId(""); }} className={inputClass}>
          {COORDINATOR_ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </Field>
      <Field label="From coordinator">
        <select required value={selectedFromId} onChange={(event) => setFromId(event.target.value)} className={inputClass}>
          {candidates.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.coordinatorName}</option>)}
        </select>
      </Field>
      <Field label="To coordinator">
        <select required value={selectedToId} onChange={(event) => setToId(event.target.value)} className={inputClass}>
          {candidates.filter((assignment) => assignment.id !== selectedFromId).map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.coordinatorName}</option>)}
        </select>
      </Field>
      <Field label="Outstanding items (one per line)" className="sm:col-span-2 xl:col-span-4">
        <textarea rows={2} value={items} onChange={(event) => setItems(event.target.value)} className={inputClass} />
      </Field>
      <div className="flex items-end">
        <button type="submit" disabled={busy || candidates.length < 2 || !selectedDayId} className={primaryButtonClass}>Record handoff</button>
      </div>
      {candidates.length < 2 ? <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-5">Two current assignments with the same role are needed to record a handoff.</p> : null}
    </form>
  );
}

function EodReportForm({ days, reports, busy, onSubmit }: {
  days: PrismEventScheduleDay[];
  reports: PrismEventEodReport[];
  busy: boolean;
  onSubmit: (value: unknown) => Promise<boolean>;
}) {
  const [dayId, setDayId] = useState("");
  const reportableDays = days.filter((day) => {
    const report = reports.find((item) => item.dayId === day.id);
    return !report || report.canEdit;
  });
  const selectedDayId = reportableDays.some((day) => day.id === dayId) ? dayId : reportableDays[0]?.id ?? "";
  const existingReport = reports.find((report) => report.dayId === selectedDayId && report.canEdit);

  if (!reportableDays.length) {
    return <p role="status" className="text-sm text-muted-foreground">Every scheduled day already has a report. Only its original author can update it.</p>;
  }

  return (
    <div className="space-y-3">
      <Field label="Schedule day">
        <select value={selectedDayId} onChange={(event) => setDayId(event.target.value)} className={inputClass}>
          {reportableDays.map((day) => <option key={day.id} value={day.id}>{day.label || formatDate(day.dayDate)}</option>)}
        </select>
      </Field>
      {existingReport ? <p className="text-sm text-muted-foreground">Your report is saved. Changes here will update your report.</p> : null}
      <EodReportFields
        key={`${selectedDayId}:${existingReport?.submittedAt ?? "new"}`}
        dayId={selectedDayId}
        report={existingReport}
        busy={busy}
        onSubmit={onSubmit}
      />
    </div>
  );
}

function EodReportFields({ dayId, report, busy, onSubmit }: {
  dayId: string;
  report?: PrismEventEodReport;
  busy: boolean;
  onSubmit: (value: unknown) => Promise<boolean>;
}) {
  const [progress, setProgress] = useState(() => report?.progress.join("\n") ?? "");
  const [issues, setIssues] = useState(() => report?.issues.join("\n") ?? "");
  const [risks, setRisks] = useState(() => report?.risksForTomorrow.join("\n") ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSubmit({
      dayId,
      progress: splitLines(progress),
      issues: splitLines(issues),
      risksForTomorrow: splitLines(risks),
    });
    if (saved) { setProgress(""); setIssues(""); setRisks(""); }
  }

  const hasContent = Boolean(progress.trim() || issues.trim() || risks.trim());

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-2">
      <Field label="Progress (one item per line)"><textarea rows={3} value={progress} onChange={(event) => setProgress(event.target.value)} className={inputClass} /></Field>
      <Field label="Issues (one item per line)"><textarea rows={3} value={issues} onChange={(event) => setIssues(event.target.value)} className={inputClass} /></Field>
      <Field label="Risks for tomorrow (one item per line)" className="sm:col-span-2"><textarea rows={3} value={risks} onChange={(event) => setRisks(event.target.value)} className={inputClass} /></Field>
      <div className="sm:col-span-2">
        <p className="mb-2 text-xs text-muted-foreground">Include at least one progress item, issue, or risk.</p>
        <button type="submit" disabled={busy || !dayId || !hasContent} className={primaryButtonClass}>{report ? "Update end-of-day report" : "Submit end-of-day report"}</button>
      </div>
    </form>
  );
}

function HandoffRow({ handoff, days, assignments }: {
  handoff: PrismEventHandoff;
  days: PrismEventScheduleDay[];
  assignments: PrismCoordinatorAssignment[];
}) {
  const fromName = assignments.find((assignment) => assignment.id === handoff.fromAssignmentId)?.coordinatorName ?? "Coordinator";
  const toName = assignments.find((assignment) => assignment.id === handoff.toAssignmentId)?.coordinatorName ?? handoff.receivedBy;
  const dayLabel = days.find((day) => day.id === handoff.dayId)?.label ?? "Event day";
  return (
    <li className="space-y-1 p-3">
      <p className="font-semibold text-foreground">{dayLabel}: {fromName} → {toName} · {handoff.role}</p>
      <p className="text-sm text-muted-foreground">Recorded {formatDateTime(handoff.handedOffAt)}</p>
      {handoff.outstandingItems.length ? <p className="text-sm text-muted-foreground">Outstanding: {handoff.outstandingItems.join(" · ")}</p> : null}
    </li>
  );
}

function EodReportCard({ report, day, busy, canReply, onReply }: {
  report: PrismEventEodReport;
  day?: PrismEventScheduleDay;
  busy: boolean;
  canReply: boolean;
  onReply: (value: unknown) => Promise<boolean>;
}) {
  const [reply, setReply] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onReply({ body: reply })) setReply("");
  }
  const sections = [
    ["Progress", report.progress],
    ["Issues", report.issues],
    ["Risks for tomorrow", report.risksForTomorrow],
  ] as const;
  return (
    <article className="space-y-3 rounded-lg border border-border bg-background p-4">
      <header className="flex flex-wrap justify-between gap-2">
        <h4 className="font-semibold text-foreground">{day?.label || (day ? formatDate(day.dayDate) : "Event day report")}</h4>
        <p className="text-sm text-muted-foreground">{report.authoredByRole} · {formatDateTime(report.submittedAt)}</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        {sections.map(([label, items]) => (
          <div key={label}>
            <h5 className="text-sm font-semibold text-foreground">{label}</h5>
            {items.length ? <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">{items.map((item, index) => <li key={`${label}-${index}`}>{item}</li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">None reported.</p>}
          </div>
        ))}
      </div>
      {report.replies.length ? (
        <ul className="space-y-2 border-t border-border pt-3">
          {report.replies.map((item) => <li key={item.id} className="text-sm"><span className="font-semibold">{item.authorRole}:</span> <span className="text-muted-foreground">{item.body}</span></li>)}
        </ul>
      ) : null}
      {canReply ? (
        <form onSubmit={submit} className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row">
          <label className="sr-only" htmlFor={`reply-${report.id}`}>Reply to end-of-day report</label>
          <input id={`reply-${report.id}`} required value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply to this report" className={inputClass} />
          <button type="submit" disabled={busy} className={secondaryButtonClass}>Reply</button>
        </form>
      ) : null}
    </article>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`grid gap-1.5 ${className ?? ""}`}><span className="text-sm font-semibold text-foreground">{label}</span>{children}</label>;
}

function splitLines(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(parsed);
}

function formatTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(parsed);
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(parsed);
}

const inputClass = "min-h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const primaryButtonClass = "min-h-10 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass = "min-h-9 rounded-md border border-border bg-secondary px-3 py-1.5 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50";

function ScheduleAuthoringSection({ days, vm, canManageSchedule }: {
  days: PrismEventScheduleDay[];
  vm: ReturnType<typeof useLiveOpsScheduleDeskViewModel>;
  canManageSchedule: boolean;
}) {
  return (
      <section aria-labelledby="schedule-authoring-heading" className="space-y-4 border-t border-border pt-4">
        <div>
          <h3 id="schedule-authoring-heading" className="font-bold text-foreground">Schedule</h3>
          <p className="text-sm text-muted-foreground">
            {canManageSchedule ? "Add event days and segments, then track their status during the event." : "Only the designated Event Day System Operator can edit the schedule."}
          </p>
        </div>
        {canManageSchedule ? <ScheduleDayForm busy={vm.busy} onCreate={vm.createDay} /> : null}
        {days.length ? (
          <div className="space-y-4">
            {days.map((day) => (
              <ScheduleDayCard
                key={day.id}
                day={day}
                canManageSchedule={canManageSchedule}
                busy={vm.busy}
                onCreateSegment={vm.createSegment}
                onUpdateSegmentStatus={vm.updateSegmentStatus}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">No schedule days yet.</p>
        )}
      </section>

  );
}
