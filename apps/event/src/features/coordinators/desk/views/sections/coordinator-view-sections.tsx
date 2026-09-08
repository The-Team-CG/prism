"use client";

import {
  AlertTriangle,
  BadgeCheck,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  LayoutGrid,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Truck,
  UserCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { label } from "@/features/pmcm-kit";
import {
  COORDINATOR_TIMELINE,
  coordinatorAcknowledgeCopy,
  coordinatorAssignmentDetail,
  coordinatorAttendanceControlCopy,
  coordinatorGreetingCopy,
  coordinatorIssueActionCopy,
  coordinatorIssueFormCopy,
  coordinatorTaskActionCopy,
  coordinatorTaskFormCopy,
} from "../../model/coordinator-view-copy";
import type { CoordinatorAttendanceChoice } from "../../model/coordinators-desk-rules";
import { liveOpsPillClass } from "@/features/live-ops/workspace/model/live-ops-workspace-rules";
import type { PrismCoordinatorRoleView } from "@prism/types";
import type { PrismCoordinatorAssignment } from "@prism/types";

type StatusSummaryItem = {
  id: string;
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  status?: string;
  detail?: string;
};

function StatusSummary({ items }: { items: StatusSummaryItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <StatusSummaryCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function StatusSummaryCard({ item }: { item: StatusSummaryItem }) {
  const Icon = item.icon;
  return (
    <div className="rounded-lg border border-border bg-background/80 p-3.5">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-black text-foreground">
            <span className="min-w-0 truncate">{item.value}</span>
            {item.status ? <StatusBadge status={item.status} /> : null}
          </div>
          {item.detail ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.detail}</p> : null}
        </div>
      </div>
    </div>
  );
}

type EventDayAction = {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  status?: string;
  active?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
};

function EventDayActionGroup({ actions }: { actions: EventDayAction[] }) {
  if (!actions.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {actions.map((action) => (
        <EventDayActionButton key={action.id} action={action} />
      ))}
    </div>
  );
}

function EventDayActionButton({ action }: { action: EventDayAction }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      disabled={action.disabled}
      data-active={action.active}
      onClick={action.onSelect}
      className="min-h-24 rounded-lg border border-border bg-background/75 p-4 text-left transition hover:border-primary/30 hover:bg-secondary/35 disabled:cursor-not-allowed disabled:opacity-55 data-[active=true]:border-primary/45 data-[active=true]:bg-secondary"
    >
      <span className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-foreground">{action.label}</span>
            {action.status ? <StatusBadge status={action.status} /> : null}
          </span>
          {action.description ? <span className="mt-1 block text-xs leading-5 text-muted-foreground">{action.description}</span> : null}
        </span>
      </span>
    </button>
  );
}

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
        {item.meta ? <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.meta}</span> : null}
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

function CCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card shadow-sm ${className}`}>{children}</div>;
}

function CCardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border px-5 py-4">{children}</div>;
}

function CCardBody({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={`px-5 py-4 ${className}`}>
      {children}
    </div>
  );
}

function SectionAccent({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">{children}</p>;
}

export type CoordinatorWorkspaceModel = {
  activeDraft?: { status: string } | null;
  assignment?: { role?: string; attendanceStatus?: string; status: string } | null;
  busy: boolean;
  event?: { eventName: string; clientName: string; eventDate: string };
  registrationRole: boolean;
  roleDataStatus: string;
  roleView: PrismCoordinatorRoleView | null;
  roleViewError: string | null;
  roleViewLoading: boolean;
  sessionName: string;
  acknowledge: () => void;
  decline: (reason?: string) => void;
  withdraw: () => void;
  scrollTo: (id: string) => void;
  taskForm: CoordinatorTaskFormModel;
  issueForm: CoordinatorIssueFormModel;
  reassignment: CoordinatorReassignmentModel;
};

export type CoordinatorReassignmentModel = {
  busy: boolean;
  error: string | null;
  request: (taskId: string) => void;
};

export function CoordinatorGreetingBanner({
  event,
  assignment,
  busy,
  roleName,
  attendanceStatus,
  sessionName,
  onAcknowledge,
  onDecline,
  onWithdraw,
}: {
  event?: { eventName: string; clientName: string; eventDate: string };
  assignment?: { status: string } | null;
  busy: boolean;
  roleName: string;
  attendanceStatus: string;
  sessionName: string;
  onAcknowledge: () => void;
  onDecline: (reason?: string) => void;
  onWithdraw: () => void;
}) {
  const greeting = coordinatorGreetingCopy(event);
  const showAcknowledge = Boolean(assignment && assignment.status !== "acknowledged" && assignment.status !== "declined");
  const showAcknowledged = assignment?.status === "acknowledged";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-(--prism-signal) to-[#8b0f48] px-6 py-7 text-white shadow-lg">
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white/70">P.R.I.S.M Coordinator Portal</p>
          <h1 className="mt-1 text-2xl font-black leading-tight">{greeting.title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">{greeting.description}</p>
          {showAcknowledge ? (
            <Button
              className="mt-5 rounded-lg bg-white font-bold text-(--prism-signal) hover:bg-white/90"
              onClick={onAcknowledge}
              disabled={busy}
            >
              <BadgeCheck className="size-4" /> Acknowledge role
            </Button>
          ) : null}
          {showAcknowledged ? (
            <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur-sm">
              <CheckCircle2 className="size-4" /> Role acknowledged
            </div>
          ) : null}
          {assignment && assignment.status !== "acknowledged" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {assignment.status !== "declined" ? (
                <Button
                  variant="outline"
                  className="rounded-lg border-white/50 bg-transparent font-bold text-white hover:bg-white/10"
                  onClick={() => onDecline(window.prompt("Why are you declining this assignment?")?.trim())}
                  disabled={busy}
                >
                  Decline
                </Button>
              ) : null}
              <Button
                variant="outline"
                className="rounded-lg border-white/50 bg-transparent font-bold text-white hover:bg-white/10"
                onClick={onWithdraw}
                disabled={busy}
              >
                Withdraw
              </Button>
            </div>
          ) : null}
        </div>
        {assignment ? (
          <div className="hidden shrink-0 flex-col items-center rounded-xl bg-white/15 px-5 py-4 text-center backdrop-blur-sm sm:flex">
            <Avatar className="mb-2 size-10 border-2 border-white/40">
              <AvatarFallback className="bg-white/20 text-sm font-black text-white">
                {sessionName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-black leading-tight">{roleName}</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
              {label(attendanceStatus)}
            </span>
          </div>
        ) : null}
      </div>
      <span className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/6" />
      <span className="pointer-events-none absolute -bottom-16 -right-8 size-64 rounded-full bg-white/4" />
    </div>
  );
}

export function CoordinatorBoundaryNotice() {
  return (
    <CCard>
      <CCardBody className="flex items-start gap-3">
        <LockKeyhole className="mt-0.5 size-5 shrink-0 text-(--prism-amber)" />
        <div>
          <p className="text-sm font-bold text-foreground">Coordinator information boundary</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            This portal excludes billing, audit trail, internal cost data, and private supplier review notes.
            Registration details are limited to the assigned registration role only.
          </p>
        </div>
      </CCardBody>
    </CCard>
  );
}

export function CoordinatorStatusSummary({
  activeDraft,
  roleViewLoading,
  roleView,
  roleDataStatus,
  registrationRole,
  attendanceStatus,
  assignment,
}: Pick<
  CoordinatorWorkspaceModel,
  "activeDraft" | "roleViewLoading" | "roleView" | "roleDataStatus" | "registrationRole" | "assignment"
> & { attendanceStatus: string }) {
  return (
    <StatusSummary
      items={[
        {
          id: "floorplan",
          label: "Official floorplan",
          value: activeDraft ? "Ready" : "Pending",
          icon: LayoutGrid,
          status: activeDraft?.status ?? "pending",
        },
        {
          id: "suppliers",
          label: "Supplier setup",
          value: roleViewLoading ? "Loading" : roleView?.supplierStatuses.length ?? 0,
          icon: Truck,
          status: roleDataStatus,
          detail: "Readiness signals only.",
        },
        {
          id: "attendance",
          label: "Guest attendance",
          value: roleViewLoading ? "—" : roleView?.guestAttendanceCount ?? 0,
          icon: UsersRound,
          status: roleDataStatus,
          detail: registrationRole ? "Registration role: check-in context visible." : "Aggregate count only.",
        },
        {
          id: "assignment",
          label: "Your attendance",
          value: label(attendanceStatus),
          icon: ShieldCheck,
          status: attendanceStatus,
          detail: coordinatorAssignmentDetail(assignment ?? undefined, label),
        },
      ]}
    />
  );
}

export function CoordinatorEventDayActions({
  assignment,
  busy,
  roleViewLoading,
  roleViewError,
  roleView,
  attendanceStatus,
  onAcknowledge,
  scrollTo,
}: Pick<
  CoordinatorWorkspaceModel,
  "assignment" | "busy" | "roleViewLoading" | "roleViewError" | "roleView" | "scrollTo"
> & { attendanceStatus: string; onAcknowledge: () => void }) {
  const ack = coordinatorAcknowledgeCopy(assignment?.status);
  const taskCopy = coordinatorTaskActionCopy(roleViewLoading, roleViewError, roleView?.tasks.length ?? 0);
  const issueCopy = coordinatorIssueActionCopy(roleViewLoading, roleViewError, roleView?.urgentIssues.length ?? 0);

  return (
    <CCard>
      <CCardHeader>
        <SectionAccent>Event-day actions</SectionAccent>
        <h2 className="mt-1 text-base font-bold text-foreground">{assignment?.role ?? "Coordinator"} run controls</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Large actions stay readable on phones during ingress, supplier calls, and issue escalation.
        </p>
      </CCardHeader>
      <CCardBody>
        <EventDayActionGroup
          actions={[
            {
              id: "acknowledge",
              label: ack.label,
              description: ack.description,
              icon: BadgeCheck,
              status: assignment?.status ?? "pending",
              active: ack.active,
              disabled: busy || !assignment || assignment.status === "acknowledged",
              onSelect: onAcknowledge,
            },
            {
              id: "queue",
              label: "Run role queue",
              description: taskCopy.description,
              icon: ClipboardList,
              status: taskCopy.status,
              onSelect: () => scrollTo("coordinator-role-queue"),
            },
            {
              id: "issues",
              label: "Review urgent issues",
              description: issueCopy.description,
              icon: BellRing,
              status: issueCopy.status,
              onSelect: () => scrollTo("coordinator-live-data"),
            },
            {
              id: "attendance",
              label: "Attendance state",
              description: assignment
                ? `Current attendance is ${label(attendanceStatus)}.`
                : "No assignment state available.",
              icon: UserCheck,
              status: attendanceStatus,
            },
          ]}
        />
      </CCardBody>
    </CCard>
  );
}

export function CoordinatorTimelineCard() {
  return (
    <CCard>
      <CCardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-(--prism-signal)" />
          <h3 className="text-sm font-bold text-foreground">Critical timeline</h3>
        </div>
      </CCardHeader>
      <CCardBody id="coordinator-timeline" className="scroll-mt-24 space-y-3">
        {COORDINATOR_TIMELINE.map(([time, title, detail]) => (
          <div key={time} className="flex items-start gap-4 rounded-xl bg-muted/40 p-3.5">
            <span className="w-12 shrink-0 text-sm font-black tabular-nums text-foreground">{time}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">{title}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p>
            </div>
          </div>
        ))}
      </CCardBody>
    </CCard>
  );
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
          <BadgeCheck className="size-4 text-(--prism-signal)" />
          <h3 className="text-sm font-bold text-foreground">Role badge</h3>
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
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{copy.heading}</p>
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
        <div className="mt-3 rounded-md border border-(--prism-danger)/25 bg-(--prism-danger)/8 px-3 py-3">
          <p className="text-xs font-bold text-(--prism-danger)">{copy.confirmPrompt}</p>
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
      <div className="rounded-xl bg-muted/50 p-5 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">Assigned role</p>
        <p className="mt-2 text-2xl font-black text-foreground">{roleName}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Badge
            variant="outline"
            className="rounded-full border-(--prism-success)/25 bg-(--prism-success)/8 px-3 py-1 text-(--prism-success)"
          >
            Role-safe view
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {label(attendanceStatus)}
          </Badge>
        </div>
      </div>
      {acknowledged ? (
        <p className="mt-4 text-center text-sm font-semibold text-(--prism-success)">PMCM has your definite yes.</p>
      ) : (
        <Button disabled={busy} onClick={onAcknowledge} className="mt-4 w-full rounded-xl font-bold">
          <CheckCircle2 className="size-4" /> Acknowledge role
        </Button>
      )}
    </div>
  );
}

export type CoordinatorTaskFormModel = {
  title: string;
  setTitle: (value: string) => void;
  role: string;
  setRole: (value: string) => void;
  priority: string;
  setPriority: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  dueAt: string;
  setDueAt: (value: string) => void;
  assignToMe: boolean;
  setAssignToMe: (value: boolean) => void;
  roleOptions: string[];
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

const FIELD_LABEL = "text-xs font-bold text-muted-foreground";
const FIELD_INPUT = "h-11 rounded-md border border-border bg-white px-3 text-sm";
const FIELD_AREA = "rounded-md border border-border bg-white px-3 py-2 text-sm";
const FORM_SUBMIT =
  "h-11 rounded-md bg-(--prism-ink) px-3 text-sm font-bold text-sidebar-foreground disabled:opacity-60";
const FORM_ALERT =
  "rounded-md bg-(--prism-danger)/10 px-3 py-2 text-xs font-bold text-(--prism-danger)";

function CoordinatorTaskForm({ taskForm }: { taskForm: CoordinatorTaskFormModel }) {
  const copy = coordinatorTaskFormCopy(taskForm.busy, taskForm.routesAway);
  return (
    <CCard>
      <CCardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-(--prism-signal)" />
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
          <label className="grid gap-1.5">
            <span className={FIELD_LABEL}>Assigned role (required)</span>
            <select
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
          </label>
          <label className="grid gap-1.5">
            <span className={FIELD_LABEL}>Priority</span>
            <select
              value={taskForm.priority}
              onChange={(e) => taskForm.setPriority(e.target.value)}
              className={FIELD_INPUT}
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
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
            onChange={(e) => taskForm.setAssignToMe(e.target.checked)}
            className="size-4"
          />
          <span className={FIELD_LABEL}>Assign to me</span>
        </label>
        {copy.routesAwayNotice ? (
          <p className="rounded-md bg-(--prism-amber)/10 px-3 py-2 text-xs text-(--prism-amber)">
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
  return (
    <CCard>
      <CCardHeader>
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-(--prism-signal)" />
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
          <label className="grid gap-1.5">
            <span className={FIELD_LABEL}>Severity</span>
            <select
              value={issueForm.severity}
              onChange={(e) => issueForm.setSeverity(e.target.value)}
              className={FIELD_INPUT}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
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

export function CoordinatorRoleData({
  roleViewLoading,
  roleViewError,
  roleView,
  registrationRole,
  taskForm,
  issueForm,
  reassignment,
}: Pick<
  CoordinatorWorkspaceModel,
  "roleViewLoading" | "roleViewError" | "roleView" | "registrationRole" | "taskForm" | "issueForm" | "reassignment"
>) {
  if (roleViewLoading) return <CoordinatorRoleLoadingCard />;
  if (roleViewError) return <CoordinatorRoleErrorCard message={roleViewError} />;
  if (!roleView) return null;
  return (
    <CoordinatorRoleQueueAndLive
      roleView={roleView}
      registrationRole={registrationRole}
      taskForm={taskForm}
      issueForm={issueForm}
      reassignment={reassignment}
    />
  );
}

function CoordinatorRoleLoadingCard() {
  return (
    <CCard>
      <CCardBody className="flex items-center gap-3">
        <ShieldCheck className="size-5 shrink-0 text-(--prism-signal)" />
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
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-(--prism-amber)" />
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
  roleView,
  registrationRole,
  taskForm,
  issueForm,
  reassignment,
}: {
  roleView: PrismCoordinatorRoleView;
  registrationRole: boolean;
  taskForm: CoordinatorTaskFormModel;
  issueForm: CoordinatorIssueFormModel;
  reassignment: CoordinatorReassignmentModel;
}) {
  const checkInCopy = registrationRole
    ? `${roleView.guestAttendanceCount} checked in, including walk-ins flagged for PMCM review.`
    : `${roleView.guestAttendanceCount} checked in. Guest-level records are hidden for this role.`;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <CoordinatorTaskForm taskForm={taskForm} />
      <CoordinatorIssueForm issueForm={issueForm} />
      <CCard>
        <CCardHeader>
          <div className="flex items-center gap-2">
            <LayoutGrid className="size-4 text-(--prism-signal)" />
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
      {roleView.isDesignatedOperator ? (
        <CoordinatorOperatorControls roleView={roleView} reassignment={reassignment} />
      ) : null}
      <CCard>
        <CCardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-(--prism-signal)" />
            <h3 className="text-sm font-bold text-foreground">Role queue</h3>
            {roleView.tasks.length > 0 ? (
              <span className="ml-auto rounded-full bg-(--prism-signal)/10 px-2 py-0.5 text-[10px] font-bold text-(--prism-signal)">
                {roleView.tasks.length}
              </span>
            ) : null}
          </div>
        </CCardHeader>
        <CCardBody id="coordinator-role-queue" className="scroll-mt-24">
          <CompactRecordList
            emptyText="No event-day tasks assigned to this role yet."
            items={roleView.tasks.map((task) => ({
              id: task.id,
              title: task.title,
              description: `${task.assignedRole} — ${task.notes}`,
              meta: task.slaDueAt ? `Due ${new Date(task.slaDueAt).toLocaleString("en-PH")}` : undefined,
              status: task.status,
              icon: ClipboardList,
            }))}
          />
        </CCardBody>
      </CCard>

      <CCard>
        <CCardHeader>
          <div className="flex items-center gap-2">
            <Radio className="size-4 text-(--prism-signal)" />
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
    </div>
  );
}

export function CoordinatorAssignmentHistory({ assignments }: { assignments: PrismCoordinatorAssignment[] }) {
  return (
    <CCard>
      <CCardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-(--prism-signal)" />
          <h3 className="text-sm font-bold text-foreground">Assigned event history</h3>
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

function CoordinatorOperatorControls({
  roleView,
  reassignment,
}: {
  roleView: PrismCoordinatorRoleView;
  reassignment: CoordinatorReassignmentModel;
}) {
  const pending = (roleView.taskReassignmentRequests ?? []).filter((request) => request.status === "pending");
  return (
    <CCard>
      <CCardHeader>
        <div className="flex items-center gap-2">
          <UserCheck className="size-4 text-(--prism-signal)" />
          <h3 className="text-sm font-bold text-foreground">Operator controls</h3>
        </div>
      </CCardHeader>
      <CCardBody className="space-y-3">
        <p className="text-sm text-muted-foreground">
          You are the designated Event Day System Operator. You may request task reassignment and mark attendance for other coordinators; PMCM approves reassignment decisions.
        </p>
        <p className="text-xs font-semibold text-muted-foreground">
          {pending.length} reassignment request{pending.length === 1 ? "" : "s"} awaiting PMCM review.
        </p>
        <div className="space-y-2">
          {roleView.tasks.slice(0, 5).map((task) => (
            <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">{task.title}</span>
              <Button type="button" size="sm" variant="outline" disabled={reassignment.busy} onClick={() => reassignment.request(task.id)}>
                Request reassignment
              </Button>
            </div>
          ))}
        </div>
        {reassignment.error ? <p role="alert" className={FORM_ALERT}>{reassignment.error}</p> : null}
      </CCardBody>
    </CCard>
  );
}
