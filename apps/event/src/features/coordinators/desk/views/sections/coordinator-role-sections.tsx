"use client";

import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  LayoutGrid,
  Radio,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useId } from "react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { label } from "@/features/pmcm-kit";
import {
  coordinatorAttendanceControlCopy,
  coordinatorIssueFormCopy,
  coordinatorTaskFormCopy,
} from "../../model/coordinator-view-copy";
import type { CoordinatorAttendanceChoice } from "../../model/coordinators-desk-rules";
import { liveOpsPillClass } from "@/features/live-ops/workspace/model/live-ops-workspace-rules";
import type { CoordinatorRole, PrismCoordinatorAssignment, PrismCoordinatorRoleView } from "@prism/types";
import { CCard, CCardBody, CCardHeader, FIELD_AREA, FIELD_INPUT, FIELD_LABEL, FORM_ALERT, FORM_SUBMIT } from "./coordinator-view-primitives";
import {
  CoordinatorRoleActions,
  CoordinatorTaskQueue,
  type CoordinatorOperatorActionsModel,
  type CoordinatorReassignmentModel,
  type CoordinatorTaskActionsModel,
} from "./coordinator-operator-sections";

type CompactRecordItem = {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  status?: string;
  icon?: LucideIcon;
  onSelect?: () => void;
};

function CompactRecordList({ items, emptyText = "No records available." }: { items: CompactRecordItem[]; emptyText?: string }) {
  if (!items.length) {
    return (
      <p className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }
  return (
    <div className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <CompactRecordRow key={item.id} item={item} />
      ))}
    </div>
  );
}
function CompactRecordRow({ item }: { item: CompactRecordItem }) {
  const Icon = item.icon;
  const content = (
    <span className="flex w-full items-start gap-3 text-left">
      {Icon ? (
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-black text-foreground">{item.title}</span>
          {/* PA-291: the shared StatusBadge STATUS_MAP has no entry for in_progress,
              done, or blocked. Keep its shared markup and add the live-ops color
              classes for those statuses. */}
          {item.status ? (
            <StatusBadge status={item.status} className={liveOpsPillClass(item.status)} />
          ) : null}
        </span>
        {item.description ? <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</span> : null}
        {item.meta ? <span className="mt-0.5 block text-3xs font-bold uppercase tracking-widest text-muted-foreground">{item.meta}</span> : null}
      </span>
    </span>
  );
  const cls = "border-l-2 border-l-transparent px-3 py-3 transition hover:bg-muted/50";
  if (item.onSelect) {
    return (
      <button type="button" onClick={item.onSelect} className={cls}>
        {content}
      </button>
    );
  }
  return <div className={cls}>{content}</div>;
}


export function CoordinatorRoleBadgeCard({
  assignment,
  busy,
  roleName,
  attendanceStatus,
  onAcknowledge,
  attendanceForm,
}: {
  assignment?: { status: string } | null;
  busy: boolean;
  roleName: string;
  attendanceStatus: string;
  onAcknowledge: () => void;
  attendanceForm: CoordinatorAttendanceFormModel;
}) {
  return (
    <CCard>
      <CCardHeader>
        <div className="flex items-center gap-2">
          <BadgeCheck className="size-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Your assignment and attendance</h3>
        </div>
      </CCardHeader>
      <CCardBody id="coordinator-attendance" className="scroll-mt-24">
        {assignment ? (
          <CoordinatorAssignedBadge
            assignmentStatus={assignment.status}
            busy={busy}
            roleName={roleName}
            attendanceStatus={attendanceStatus}
            onAcknowledge={onAcknowledge}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No coordinator assignment is available yet.</p>
        )}
        {/* EP-11-S03 AC1: the coordinator marks their own attendance here. */}
        <CoordinatorAttendanceControl attendanceForm={attendanceForm} />
      </CCardBody>
    </CCard>
  );
}

export type CoordinatorAttendanceFormModel = {
  status: string;
  choices: readonly { value: CoordinatorAttendanceChoice; label: string }[];
  canMark: boolean;
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
  "h-11 rounded-md border border-border bg-background text-sm font-bold transition hover:border-primary/40 hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-55 data-[active=true]:border-primary/45 data-[active=true]:bg-secondary";

function CoordinatorAttendanceControl({
  attendanceForm,
}: {
  attendanceForm: CoordinatorAttendanceFormModel;
}) {
  const copy = coordinatorAttendanceControlCopy({
    hasAssignment: attendanceForm.hasAssignment,
    replaced: attendanceForm.replaced,
    pendingChoiceLabel: attendanceForm.pendingChoiceLabel,
  });

  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="text-sm font-semibold text-foreground">{copy.heading}</p>
      {copy.blockedReason ? (
        <p className="mt-2 text-sm text-muted-foreground">{copy.blockedReason}</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {attendanceForm.choices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              disabled={attendanceForm.busy || attendanceForm.isDisabled(choice.value)}
              data-active={attendanceForm.status === choice.value}
              onClick={() => attendanceForm.mark(choice.value)}
              className={ATTENDANCE_CHOICE_BUTTON}
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
      {copy.confirmPrompt ? (
        <div className="mt-3 rounded-md border border-danger/25 bg-danger/8 px-3 py-3">
          <p className="text-xs font-bold text-danger">{copy.confirmPrompt}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={attendanceForm.busy}
              onClick={attendanceForm.confirm}
              className={FORM_SUBMIT}
            >
              {copy.confirmLabel}
            </button>
            <button
              type="button"
              onClick={attendanceForm.cancel}
              className="h-11 rounded-md border border-border px-3 text-sm font-bold"
            >
              {copy.cancelLabel}
            </button>
          </div>
        </div>
      ) : null}
      {attendanceForm.error ? (
        <p role="alert" className={`mt-3 ${FORM_ALERT}`}>
          {attendanceForm.error}
        </p>
      ) : null}
    </div>
  );
}

function CoordinatorAssignedBadge({
  assignmentStatus,
  busy,
  roleName,
  attendanceStatus,
  onAcknowledge,
}: {
  assignmentStatus: string;
  busy: boolean;
  roleName: string;
  attendanceStatus: string;
  onAcknowledge: () => void;
}) {
  const acknowledged = assignmentStatus === "acknowledged";
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-lg font-semibold text-foreground">{roleName}</p>
        <p className="text-sm text-muted-foreground">Attendance: {label(attendanceStatus)}</p>
      </div>
      {acknowledged ? (
        <p className="mt-2 text-sm text-success">Assignment confirmed with PMCM.</p>
      ) : (
        <Button disabled={busy} onClick={() => onAcknowledge()} className="mt-3 min-h-11 font-semibold">
          <CheckCircle2 className="size-4" /> Confirm assignment
        </Button>
      )}
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
  submit: () => void;
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
  submit: () => void;
};

function CoordinatorTaskForm({ taskForm }: { taskForm: CoordinatorTaskFormModel }) {
  const copy = coordinatorTaskFormCopy(taskForm.busy, taskForm.routesAway);
  const fieldId = useId();
  return (
    <CCard>
      <CCardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Log an event-day task</h3>
        </div>
      </CCardHeader>
      <CCardBody className="space-y-3">
        <label className="grid gap-1.5">
          <span className={FIELD_LABEL}>Task title (required)</span>
          <input
            value={taskForm.title}
            onChange={(e) => taskForm.setTitle(e.target.value)}
            required
            placeholder="Stage cue check, ingress sweep"
            className={FIELD_INPUT}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor={`${fieldId}-role`} className={FIELD_LABEL}>Assigned role (required)</label>
            <select
              id={`${fieldId}-role`}
              value={taskForm.role}
              onChange={(e) => taskForm.setRole(e.target.value)}
              required
              className={FIELD_INPUT}
            >
              {taskForm.roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${fieldId}-priority`} className={FIELD_LABEL}>Priority</label>
            <select
              id={`${fieldId}-priority`}
              value={taskForm.priority}
              onChange={(e) => taskForm.setPriority(e.target.value)}
              className={FIELD_INPUT}
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <label className="grid gap-1.5">
          <span className={FIELD_LABEL}>Notes</span>
          <textarea
            value={taskForm.notes}
            onChange={(e) => taskForm.setNotes(e.target.value)}
            rows={2}
            className={FIELD_AREA}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={FIELD_LABEL}>Due time</span>
          <input
            type="datetime-local"
            value={taskForm.dueAt}
            onChange={(e) => taskForm.setDueAt(e.target.value)}
            className={FIELD_INPUT}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={taskForm.assignToMe}
            disabled={taskForm.assignToMeRequired}
            onChange={(e) => taskForm.setAssignToMe(e.target.checked)}
            className="size-4"
          />
          <span className={FIELD_LABEL}>{taskForm.assignToMeRequired ? "Assign to my queue" : "Assign to me"}</span>
        </label>
        {taskForm.assignToMeRequired ? (
          <p className="text-xs text-muted-foreground">
            Your saved role is outside the current role catalog, so new tasks use General Coordinator and stay in your named queue until PMCM updates the assignment.
          </p>
        ) : null}
        {copy.routesAwayNotice ? (
          <p className="rounded-md bg-attention/10 px-3 py-2 text-xs text-attention">
            {copy.routesAwayNotice}
          </p>
        ) : null}
        {taskForm.error ? (
          <p role="alert" className={FORM_ALERT}>
            {taskForm.error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={taskForm.busy || !taskForm.title.trim()}
          onClick={taskForm.submit}
          className={FORM_SUBMIT}
        >
          {copy.submitLabel}
        </button>
      </CCardBody>
    </CCard>
  );
}

function CoordinatorIssueForm({ issueForm }: { issueForm: CoordinatorIssueFormModel }) {
  const copy = coordinatorIssueFormCopy(issueForm.busy);
  const fieldId = useId();
  return (
    <CCard>
      <CCardHeader>
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Log an urgent issue</h3>
        </div>
      </CCardHeader>
      <CCardBody className="space-y-3">
        <label className="grid gap-1.5">
          <span className={FIELD_LABEL}>Issue title (required)</span>
          <input
            value={issueForm.title}
            onChange={(e) => issueForm.setTitle(e.target.value)}
            required
            placeholder="Supplier late, walk-in queue overflow"
            className={FIELD_INPUT}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor={`${fieldId}-severity`} className={FIELD_LABEL}>Severity</label>
            <select
              id={`${fieldId}-severity`}
              value={issueForm.severity}
              onChange={(e) => issueForm.setSeverity(e.target.value)}
              className={FIELD_INPUT}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <label className="grid gap-1.5">
            <span className={FIELD_LABEL}>Affected area</span>
            <input
              value={issueForm.affectedArea}
              onChange={(e) => issueForm.setAffectedArea(e.target.value)}
              placeholder="e.g. Main Hall, Registration Desk"
              className={FIELD_INPUT}
            />
          </label>
        </div>
        <label className="grid gap-1.5">
          <span className={FIELD_LABEL}>Description</span>
          <textarea
            value={issueForm.description}
            onChange={(e) => issueForm.setDescription(e.target.value)}
            rows={2}
            className={FIELD_AREA}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={FIELD_LABEL}>SLA due time</span>
          <input
            type="datetime-local"
            value={issueForm.slaDueAt}
            onChange={(e) => issueForm.setSlaDueAt(e.target.value)}
            className={FIELD_INPUT}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={issueForm.assignToMe}
            onChange={(e) => issueForm.setAssignToMe(e.target.checked)}
            className="size-4"
          />
          <span className={FIELD_LABEL}>Assign to me</span>
        </label>
        {issueForm.error ? (
          <p role="alert" className={FORM_ALERT}>
            {issueForm.error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={issueForm.busy || !issueForm.title.trim()}
          onClick={issueForm.submit}
          className={FORM_SUBMIT}
        >
          {copy.submitLabel}
        </button>
      </CCardBody>
    </CCard>
  );
}

type CoordinatorRoleDataProps = {
  section?: "tasks" | "issues";
  roleViewLoading: boolean;
  roleViewError: string | null;
  roleView: PrismCoordinatorRoleView | null;
  registrationRole: boolean;
  taskForm: CoordinatorTaskFormModel;
  issueForm: CoordinatorIssueFormModel;
  reassignment: CoordinatorReassignmentModel;
  taskActions: CoordinatorTaskActionsModel;
  operatorActions: CoordinatorOperatorActionsModel;
};
export function CoordinatorRoleData({
  section = "tasks",
  roleViewLoading,
  roleViewError,
  roleView,
  registrationRole,
  taskForm,
  issueForm,
  reassignment,
  taskActions,
  operatorActions,
}: CoordinatorRoleDataProps) {
  if (roleViewLoading) return <CoordinatorRoleLoadingCard />;
  if (roleViewError) return <CoordinatorRoleErrorCard message={roleViewError} />;
  if (!roleView) return null;
  return (
    <CoordinatorRoleQueueAndLive
      section={section}
      roleView={roleView}
      registrationRole={registrationRole}
      taskForm={taskForm}
      issueForm={issueForm}
      reassignment={reassignment}
      taskActions={taskActions}
      operatorActions={operatorActions}
    />
  );
}

function CoordinatorRoleLoadingCard() {
  return (
    <CCard>
      <CCardBody className="flex items-center gap-3">
        <ShieldCheck className="size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-bold text-foreground">Loading role-safe data</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Assignment-safe tasks, supplier signals, attendance counts, and urgent issues are loading.
          </p>
        </div>
      </CCardBody>
    </CCard>
  );
}

function CoordinatorRoleErrorCard({ message }: { message: string }) {
  return (
    <CCard>
      <CCardBody className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-attention" />
        <div>
          <p className="text-sm font-bold text-foreground">Role-safe data unavailable</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {message}. Refresh the coordinator portal or ask PMCM to confirm this assignment.
          </p>
        </div>
      </CCardBody>
    </CCard>
  );
}

function CoordinatorRoleQueueAndLive({
  section,
  roleView,
  registrationRole,
  taskForm,
  issueForm,
  reassignment,
  taskActions,
  operatorActions,
}: {
  section: "tasks" | "issues";
  roleView: PrismCoordinatorRoleView;
  registrationRole: boolean;
  taskForm: CoordinatorTaskFormModel;
  issueForm: CoordinatorIssueFormModel;
  reassignment: CoordinatorReassignmentModel;
  taskActions: CoordinatorTaskActionsModel;
  operatorActions: CoordinatorOperatorActionsModel;
}) {
  return (
    <div className="space-y-4">
      {section === "tasks" ? (
        <>
          <CoordinatorTaskQueue roleView={roleView} taskActions={taskActions} />
          <details className="rounded-lg border border-border bg-card">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Log a task</summary>
          <CoordinatorTaskForm taskForm={taskForm} />
          </details>
          <details className="rounded-lg border border-border bg-card">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Event briefing</summary>
          <CoordinatorBriefingCard roleView={roleView} />
          </details>
          <details className="rounded-lg border border-border bg-card">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">On-site controls</summary>
          <CoordinatorRoleActions roleView={roleView} reassignment={reassignment} operatorActions={operatorActions} />
          </details>
        </>
      ) : (
        <>
          <CoordinatorRoleLiveData roleView={roleView} registrationRole={registrationRole} />
          <details className="rounded-lg border border-border bg-card">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Report an issue</summary>
          <CoordinatorIssueForm issueForm={issueForm} />
          </details>
        </>
      )}
    </div>
  );
}

function CoordinatorBriefingCard({ roleView }: { roleView: PrismCoordinatorRoleView }) {
  return (
    <CCard>
      <CCardHeader>
        <div className="flex items-center gap-2">
          <LayoutGrid className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Floor and stage briefing</h3>
        </div>
      </CCardHeader>
      <CCardBody className="space-y-2">
        {roleView.briefing ? (
          <>
            <p className="text-sm font-semibold text-foreground">{roleView.briefing.venue || "Venue briefing pending"}</p>
            <p className="text-sm text-muted-foreground">
              {roleView.briefing.guestCount} guests · {roleView.briefing.budgetRange || "Budget range pending"}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">{roleView.briefing.notes || "No briefing notes supplied."}</p>
            {roleView.briefing.serviceRequirements.length ? (
              <p className="text-xs font-semibold text-muted-foreground">
                Services: {roleView.briefing.serviceRequirements.join(", ")}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">PMCM has not submitted the event briefing yet.</p>
        )}
      </CCardBody>
    </CCard>
  );
}

function CoordinatorRoleLiveData({ roleView, registrationRole }: { roleView: PrismCoordinatorRoleView; registrationRole: boolean }) {
  const checkInCopy = registrationRole
    ? `${roleView.guestAttendanceCount} checked in, including walk-ins flagged for PMCM review.`
    : `${roleView.guestAttendanceCount} checked in. Guest-level records are hidden for this role.`;
  return (
    <CCard>
      <CCardHeader>
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Role-safe live data</h3>
        </div>
      </CCardHeader>
      <CCardBody id="coordinator-live-data" className="scroll-mt-24 space-y-3">
        <div className="rounded-xl bg-muted/40 p-4">
          <p className="text-sm font-bold text-foreground">Registration check-ins</p>
          <p className="mt-1 text-sm text-muted-foreground">{checkInCopy}</p>
        </div>
        <CompactRecordList
          emptyText="No urgent issue assigned to this role."
          items={roleView.urgentIssues.map((issue) => ({
            id: issue.id,
            title: issue.title,
            description: `${label(issue.status)} — ${issue.ownerRole || "Unassigned"}`,
            meta: issue.slaDueAt ? `Due ${new Date(issue.slaDueAt).toLocaleString("en-PH")}` : undefined,
            status: issue.slaStatus ?? issue.status,
            icon: Radio,
          }))}
        />
      </CCardBody>
    </CCard>
  );
}

export function CoordinatorAssignmentHistory({ assignments }: { assignments: PrismCoordinatorAssignment[] }) {
  return (
    <CCard>
      <CCardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Assignment history</h3>
        </div>
      </CCardHeader>
      <CCardBody>
        <CompactRecordList
          emptyText="No coordinator assignments found."
          items={assignments.map((item) => ({
            id: item.id,
            title: item.eventDate ? `${item.eventDate} · ${item.role}` : item.role,
            description: item.coordinatorName,
            meta: item.withdrawalReason || item.replacementReason || undefined,
            status: item.status,
            icon: CalendarClock,
          }))}
        />
      </CCardBody>
    </CCard>
  );
}
