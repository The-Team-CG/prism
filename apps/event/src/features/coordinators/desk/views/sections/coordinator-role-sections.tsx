"use client";
import { DateTimePicker } from "@prism/ui/components/date-time-picker";
import { formatPortalDateTime, formatPortalTime } from "@prism/ui/format-date";

import { AlertTriangle, CheckCircle2, CircleCheck, Plus, Radio, ShieldCheck } from "lucide-react";
import { useId, useRef } from "react";
import { Button } from "@prism/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { PrismListRow } from "@prism/ui/action-list";
import { PrismEmptyLine, PrismSection, PrismStatRow } from "@prism/ui/page-blocks";
import { label } from "@/features/pmcm-kit";
import {
  coordinatorAttendanceControlCopy,
  coordinatorAttendanceRecordLine,
  coordinatorIssueFormCopy,
  coordinatorTaskFormCopy,
} from "../../model/coordinator-view-copy";
import { recordedAttendanceLabel, type CoordinatorAttendanceChoice } from "../../model/coordinators-desk-rules";
import { isOpenIssue, isOpenTask, issueTone, openIssues } from "../../model/coordinator-shift";
import type { CoordinatorRole, PrismCoordinatorRoleView } from "@prism/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { FIELD_AREA, FIELD_INPUT, FIELD_LABEL, FORM_ALERT, FORM_SUBMIT } from "./coordinator-view-primitives";
import { LoadingState } from "@prism/ui/components/loading-state";
import {
  CoordinatorRoleActions,
  CoordinatorTaskQueue,
  type CoordinatorOperatorActionsModel,
  type CoordinatorReassignmentModel,
  type CoordinatorTaskActionsModel,
} from "./coordinator-operator-sections";

export type CoordinatorAttendanceFormModel = {
  status: string;
  choices: readonly { value: CoordinatorAttendanceChoice; label: string }[];
  canMark: boolean;
  windowOpen: boolean;
  markedAt: string | null;
  hasAssignment: boolean;
  replaced: boolean;
  isDisabled: (choice: CoordinatorAttendanceChoice) => boolean;
  pendingChoice: CoordinatorAttendanceChoice | null;
  pendingChoiceLabel: string | null;
  busy: boolean;
  error: string | null;
  mark: (choice: CoordinatorAttendanceChoice) => void;
  confirm: () => void;
  cancel: () => void;
};

const ATTENDANCE_CHOICE_BUTTON =
  "h-11 rounded-md border border-border bg-background text-sm font-semibold transition hover:border-primary/40 hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-55 data-[active=true]:border-primary data-[active=true]:bg-primary-soft data-[active=true]:text-primary";

/** The coordinator marks their own attendance: three choices while the window is open, the record once it closes. */
export function CoordinatorAttendanceControl({ attendanceForm }: { attendanceForm: CoordinatorAttendanceFormModel }) {
  const choiceGroupRef = useRef<HTMLDivElement>(null);
  const recordedLabel = recordedAttendanceLabel(attendanceForm.status);
  const copy = coordinatorAttendanceControlCopy({
    hasAssignment: attendanceForm.hasAssignment,
    replaced: attendanceForm.replaced,
    windowOpen: attendanceForm.windowOpen,
    recordedLabel,
    pendingChoiceLabel: attendanceForm.pendingChoiceLabel,
  });

  return (
    <div id="coordinator-attendance" className="scroll-mt-24">
      {copy.blockedReason || copy.closedReason ? (
        <p role="status" className="text-sm text-muted-foreground">{copy.blockedReason ?? copy.closedReason}</p>
      ) : (
        <>
          <div ref={choiceGroupRef} role="group" aria-label="Your attendance" className="grid gap-2 sm:grid-cols-3">
            {attendanceForm.choices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                disabled={attendanceForm.busy || attendanceForm.isDisabled(choice.value)}
                aria-pressed={attendanceForm.status === choice.value}
                data-active={attendanceForm.status === choice.value}
                onClick={() => attendanceForm.mark(choice.value)}
                className={ATTENDANCE_CHOICE_BUTTON}
              >
                {choice.label}
              </button>
            ))}
          </div>
          {recordedLabel ? (
            <p role="status" className="mt-2 text-sm text-muted-foreground">
              <span>{coordinatorAttendanceRecordLine(recordedLabel, attendanceForm.markedAt)}</span>
              {" · "}
              <button
                type="button"
                disabled={attendanceForm.busy}
                onClick={() => choiceGroupRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus()}
                className="font-semibold text-primary focus-visible:ring-2 focus-visible:ring-primary"
              >
                Change
              </button>
            </p>
          ) : null}
        </>
      )}
      {copy.confirmPrompt ? (
        <div className="mt-3 rounded-md border border-danger/25 bg-danger/8 px-3 py-3">
          <p className="text-xs font-semibold text-danger">{copy.confirmPrompt}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={attendanceForm.busy} onClick={attendanceForm.confirm} className={FORM_SUBMIT}>
              {copy.confirmLabel}
            </button>
            <button type="button" onClick={attendanceForm.cancel} className="h-11 rounded-md border border-border px-3 text-sm font-semibold">
              {copy.cancelLabel}
            </button>
          </div>
        </div>
      ) : null}
      {attendanceForm.error ? <p role="alert" className={`mt-3 ${FORM_ALERT}`}>{attendanceForm.error}</p> : null}
    </div>
  );
}

export type CoordinatorTaskFormModel = {
  title: string;
  setTitle: (value: string) => void;
  role: CoordinatorRole;
  setRole: (value: string) => void;
  priority: string;
  setPriority: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  dueAt: string;
  setDueAt: (value: string) => void;
  assignToMe: boolean;
  assignToMeRequired: boolean;
  setAssignToMe: (value: boolean) => void;
  roleOptions: CoordinatorRole[];
  routesAway: boolean;
  busy: boolean;
  error: string | null;
  /** Resolves true once the task is logged. */
  submit: () => Promise<boolean>;
};

export type CoordinatorIssueFormModel = {
  title: string;
  setTitle: (value: string) => void;
  severity: string;
  setSeverity: (value: string) => void;
  affectedArea: string;
  setAffectedArea: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  slaDueAt: string;
  setSlaDueAt: (value: string) => void;
  assignToMe: boolean;
  setAssignToMe: (value: boolean) => void;
  busy: boolean;
  error: string | null;
  /** Resolves true once the issue is reported. The quick report passes its own fields instead of the form's. */
  submit: (quick?: { title: string; severity: string; affectedArea: string; description: string }) => Promise<boolean>;
};

export function CoordinatorTaskFormFields({ taskForm, onDone }: { taskForm: CoordinatorTaskFormModel; onDone: () => void }) {
  const copy = coordinatorTaskFormCopy(taskForm.busy, taskForm.routesAway);
  const fieldId = useId();
  async function submit() {
    if (await taskForm.submit()) onDone();
  }
  return (
    <div className="space-y-3">
      <label className="grid gap-1.5">
        <span className={FIELD_LABEL}>Task title (required)</span>
        <input value={taskForm.title} onChange={(e) => taskForm.setTitle(e.target.value)} required placeholder="Stage cue check, ingress sweep" className={FIELD_INPUT} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor={`${fieldId}-role`} className={FIELD_LABEL}>Assigned role (required)</label>
          <Select value={taskForm.role} onValueChange={taskForm.setRole} required>
            <SelectTrigger id={`${fieldId}-role`} className="w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {taskForm.roleOptions.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${fieldId}-priority`} className={FIELD_LABEL}>Priority</label>
          <Select value={taskForm.priority} onValueChange={taskForm.setPriority}>
            <SelectTrigger id={`${fieldId}-priority`} className="w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <label className="grid gap-1.5">
        <span className={FIELD_LABEL}>Notes</span>
        <textarea value={taskForm.notes} onChange={(e) => taskForm.setNotes(e.target.value)} rows={3} className={FIELD_AREA} />
      </label>
      <label className="grid gap-1.5">
        <span className={FIELD_LABEL}>Due time</span>
        <DateTimePicker value={taskForm.dueAt} onValueChange={(next) => taskForm.setDueAt(next)} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={taskForm.assignToMe} disabled={taskForm.assignToMeRequired} onChange={(e) => taskForm.setAssignToMe(e.target.checked)} className="size-4" />
        <span className={FIELD_LABEL}>{taskForm.assignToMeRequired ? "Assign to my queue" : "Assign to me"}</span>
      </label>
      {taskForm.assignToMeRequired ? (
        <p className="text-xs text-muted-foreground">
          Your saved role is outside the current role catalog, so new tasks use General Coordinator and stay in your named queue until PMCM updates the assignment.
        </p>
      ) : null}
      {copy.routesAwayNotice ? <p className="rounded-md bg-attention/10 px-3 py-2 text-xs text-attention">{copy.routesAwayNotice}</p> : null}
      {taskForm.error ? <p role="alert" className={FORM_ALERT}>{taskForm.error}</p> : null}
      <button type="button" disabled={taskForm.busy || !taskForm.title.trim()} onClick={() => void submit()} className={FORM_SUBMIT}>
        {copy.submitLabel}
      </button>
    </div>
  );
}

/** The full issue form, behind "More details" in the quick report. */
export function CoordinatorIssueFormFields({ issueForm, onDone }: { issueForm: CoordinatorIssueFormModel; onDone: () => void }) {
  const copy = coordinatorIssueFormCopy(issueForm.busy);
  const fieldId = useId();
  async function submit() {
    if (await issueForm.submit()) onDone();
  }
  return (
    <div className="space-y-3">
      <label className="grid gap-1.5">
        <span className={FIELD_LABEL}>Issue title (required)</span>
        <input value={issueForm.title} onChange={(e) => issueForm.setTitle(e.target.value)} required placeholder="Supplier late, walk-in queue overflow" className={FIELD_INPUT} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor={`${fieldId}-severity`} className={FIELD_LABEL}>Severity</label>
          <Select value={issueForm.severity} onValueChange={issueForm.setSeverity}>
            <SelectTrigger id={`${fieldId}-severity`} className="w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="grid gap-1.5">
          <span className={FIELD_LABEL}>Affected area</span>
          <input value={issueForm.affectedArea} onChange={(e) => issueForm.setAffectedArea(e.target.value)} placeholder="e.g. Main Hall, Registration Desk" className={FIELD_INPUT} />
        </label>
      </div>
      <label className="grid gap-1.5">
        <span className={FIELD_LABEL}>What happened</span>
        <textarea value={issueForm.description} onChange={(e) => issueForm.setDescription(e.target.value)} rows={3} className={FIELD_AREA} />
      </label>
      <label className="grid gap-1.5">
        <span className={FIELD_LABEL}>Needs fixing by</span>
        <DateTimePicker value={issueForm.slaDueAt} onValueChange={(next) => issueForm.setSlaDueAt(next)} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={issueForm.assignToMe} onChange={(e) => issueForm.setAssignToMe(e.target.checked)} className="size-4" />
        <span className={FIELD_LABEL}>I&apos;ll handle it</span>
      </label>
      {issueForm.error ? <p role="alert" className={FORM_ALERT}>{issueForm.error}</p> : null}
      <button type="button" disabled={issueForm.busy || !issueForm.title.trim()} onClick={() => void submit()} className={FORM_SUBMIT}>
        {copy.submitLabel}
      </button>
    </div>
  );
}

type CoordinatorRoleDataProps = {
  section?: "tasks" | "issues";
  roleViewLoading: boolean;
  roleViewError: string | null;
  roleView: PrismCoordinatorRoleView | null;
  registrationRole: boolean;
  taskForm: CoordinatorTaskFormModel;
  reassignment: CoordinatorReassignmentModel;
  taskActions: CoordinatorTaskActionsModel;
  operatorActions: CoordinatorOperatorActionsModel;
  /** Opens the issue form; the Issues page offers it beside the open issues. */
  onReportIssue?: () => void;
  /** Opens the Log a task panel; Tasks offers it from a tablet up, More on a phone. */
  onLogTask?: () => void;
};

export function CoordinatorRoleData({ section = "tasks", roleViewLoading, roleViewError, roleView, ...rest }: CoordinatorRoleDataProps) {
  if (roleViewLoading && !roleView) return <CoordinatorRoleLoading />;
  if (roleViewError) return <CoordinatorRoleError message={roleViewError} />;
  if (!roleView) return null;
  return section === "tasks" ? <CoordinatorTasksPage roleView={roleView} {...rest} /> : <CoordinatorIssuesPage roleView={roleView} registrationRole={rest.registrationRole} onReportIssue={rest.onReportIssue} />;
}

export function CoordinatorRoleLoading() {
  return (
    <PrismEmptyLine icon={ShieldCheck} className="rounded-xl border border-border bg-card px-5 py-4">
      <LoadingState label="Loading your tasks, issues and check-ins" />
    </PrismEmptyLine>
  );
}

export function CoordinatorRoleError({ message }: { message: string }) {
  return (
    <PrismEmptyLine icon={AlertTriangle} className="rounded-xl border border-border bg-card px-5 py-4">
      <p className="font-semibold text-foreground">Your event data could not be loaded</p>
      <p>{message}. Refresh the page, or ask PMCM to confirm this assignment.</p>
    </PrismEmptyLine>
  );
}

/** The Log a task form in a side panel, opened from Tasks or from More. It closes once the task is saved. */
export function CoordinatorTaskSheet({ taskForm, open, onOpenChange, side = "right" }: { taskForm: CoordinatorTaskFormModel; open: boolean; onOpenChange: (open: boolean) => void; side?: "right" | "bottom" }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={side === "bottom" ? "max-h-[92dvh] overflow-y-auto rounded-t-2xl" : "w-full overflow-y-auto sm:max-w-lg"}>
        <SheetHeader>
          <SheetTitle>Log a task</SheetTitle>
          <SheetDescription>Something that needs doing on the day. It goes to the queue of the role you choose.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6"><CoordinatorTaskFormFields taskForm={taskForm} onDone={() => onOpenChange(false)} /></div>
      </SheetContent>
    </Sheet>
  );
}

/** Tasks: just the work, grouped by where it stands. The operator's team controls follow. */
function CoordinatorTasksPage({ roleView, reassignment, taskActions, operatorActions, onLogTask }: Omit<CoordinatorRoleDataProps, "section" | "roleViewLoading" | "roleViewError" | "roleView"> & { roleView: PrismCoordinatorRoleView }) {
  const open = roleView.tasks.filter(isOpenTask).length;
  return (
    <div className="grid gap-6">
      <PrismSection
        id="coordinator-tasks"
        title="Your tasks"
        count={open}
        description={<span className="hidden sm:inline">Blocked first, then what you have started, then what is next.</span>}
        action={onLogTask ? <Button type="button" size="sm" className="hidden md:inline-flex" onClick={onLogTask}><Plus className="size-4" aria-hidden />Log a task</Button> : undefined}
        flush
      >
        <CoordinatorTaskQueue roleView={roleView} taskActions={taskActions} />
      </PrismSection>
      {roleView.isDesignatedOperator ? (
        <PrismSection bare id="coordinator-team-checks" title="Team controls" description="As the event day operator: reassign tasks and update colleagues' attendance.">
          <div className="grid gap-4"><CoordinatorRoleActions roleView={roleView} reassignment={reassignment} operatorActions={operatorActions} /></div>
        </PrismSection>
      ) : null}
    </div>
  );
}

/** Venue, guests, services and notes. The budget stays with PMCM: coordinators do not see cost data. */
export function CoordinatorBriefing({ roleView }: { roleView: PrismCoordinatorRoleView }) {
  const briefing = roleView.briefing;
  if (!briefing) return <p className="text-sm text-muted-foreground">PMCM has not shared the event briefing yet.</p>;
  const facts = [
    { label: "Venue", value: briefing.venue || "Not confirmed yet" },
    { label: "Guests", value: briefing.guestCount ? `${briefing.guestCount} expected` : "Not confirmed yet" },
    { label: "Services", value: briefing.serviceRequirements.length ? briefing.serviceRequirements.join(", ") : "None listed" },
  ];
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid gap-2">
        {facts.map((fact) => (
          <div key={fact.label} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="font-medium text-foreground">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {briefing.notes ? <p className="whitespace-pre-wrap leading-6 text-muted-foreground">{briefing.notes}</p> : null}
    </div>
  );
}

type Issue = PrismCoordinatorRoleView["urgentIssues"][number];

function issueStatus(issue: Issue) {
  if (!isOpenIssue(issue)) return { status: issue.resolvedAt ? `Resolved ${formatPortalTime(issue.resolvedAt, "")}`.trim() : "Resolved" };
  if (!issue.slaDueAt) return { status: "No deadline" };
  if (issue.slaStatus === "overdue") return { status: "Overdue", detail: `was due ${formatPortalDateTime(issue.slaDueAt)}` };
  return { status: `Due ${formatPortalTime(issue.slaDueAt, "")}`.trim(), detail: formatPortalDateTime(issue.slaDueAt) };
}

function IssueRow({ issue }: { issue: Issue }) {
  const tone = issueTone(issue);
  const status = issueStatus(issue);
  const meta = [`${label(issue.severity)} severity`, issue.affectedArea, issue.ownerName || issue.ownerRole || "Unassigned"].filter(Boolean).join(" · ");
  return (
    <PrismListRow
      icon={tone === "done" ? CircleCheck : Radio}
      tone={tone}
      title={issue.title}
      meta={meta}
      metaTitle={meta}
      detail={isOpenIssue(issue) ? issue.description || undefined : issue.resolution || undefined}
      status={status.status}
      statusDetail={status.detail}
    />
  );
}

function CoordinatorIssuesPage({ roleView, registrationRole, onReportIssue }: { roleView: PrismCoordinatorRoleView; registrationRole: boolean; onReportIssue?: () => void }) {
  const open = openIssues(roleView.urgentIssues);
  const resolved = roleView.urgentIssues.filter((issue) => !isOpenIssue(issue));
  const overdue = open.filter((issue) => issue.slaStatus === "overdue").length;
  const checkIns = roleView.guestAttendanceCount;
  return (
    <div className="grid gap-6">
      <PrismStatRow
        label="Issues on this event"
        stats={[
          { label: "Open issues", value: open.length, tone: open.length ? "attention" : "neutral" },
          { label: "Overdue", value: overdue, tone: "urgent", empty: overdue === 0 },
          { label: "Resolved", value: resolved.length, empty: resolved.length === 0 },
          { label: "Guests checked in", value: checkIns, detail: checkIns === 0 ? "No check-ins recorded." : registrationRole ? "Includes walk-ins flagged for PMCM review." : "Guest names are hidden for your role." },
        ]}
      />
      <PrismSection
        id="coordinator-open-issues"
        title="Open issues"
        count={open.length}
        description="Most serious first. PMCM sees every issue reported here."
        action={onReportIssue ? <Button type="button" size="sm" variant="outline" onClick={onReportIssue}><Radio className="size-4" aria-hidden />Report an issue</Button> : undefined}
        flush
      >
        {open.length ? (
          <ul className="divide-y divide-border">{open.map((issue) => <IssueRow key={issue.id} issue={issue} />)}</ul>
        ) : (
          <PrismEmptyLine icon={CheckCircle2} className="px-5 py-4">No open issues. Report one whenever something goes wrong on the day.</PrismEmptyLine>
        )}
      </PrismSection>
      {resolved.length ? (
        <PrismSection id="coordinator-resolved-issues" title="Resolved" count={resolved.length} flush>
          <ul className="divide-y divide-border">{resolved.map((issue) => <IssueRow key={issue.id} issue={issue} />)}</ul>
        </PrismSection>
      ) : null}
    </div>
  );
}
