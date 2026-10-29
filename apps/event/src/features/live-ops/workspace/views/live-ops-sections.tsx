import { DateTimePicker } from "@prism/ui/components/date-time-picker";
import { BellRing, ChevronRight, Plus, RefreshCw, UserPlus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import { COORDINATOR_ROLES, decideEventTaskReassignmentSchema, parseContract } from "@prism/types";

import type {
  CoordinatorRole,
  EscalateLiveOpsInput,
  EscalateEventDayTaskInput,
  PrismCoordinator,
  PrismCoordinatorAssignment,
  PrismCoordinatorSuggestion,
  PrismEvent,
  PrismEventDayStatusFeed,
  PrismEventDayTask,
  PrismLiveOps,
  PrismSupplierQuoteRequest,
  PrismUrgentIssue,
  ReplaceCoordinatorAssignmentInput,
  UpdateCoordinatorAttendanceInput,
  UpdateEventDayTaskInput,
  UpdateUrgentIssueInput,
  VerifySupplierStatusInput,
  DecideEventTaskReassignmentInput,
  PrismEventTaskReassignmentRequest,
} from "@prism/types";
import { cx, label } from "@/features/pmcm-kit";
import { isOpenLiveOpsIssue, liveOpsPillClass, orderLiveOpsIssuesForDesk } from "../model/live-ops-workspace-rules";
import { useCoordinatorRowViewModel } from "../view-models/use-coordinator-row-view-model";
import type { useLiveOperationsWorkspaceViewModel } from "../view-models/use-live-operations-workspace-view-model";
import Link from "next/link";
import { LiveOpsControlSurface, LiveOpsScheduleDesk, eventRunSheetHref } from "@/features/live-ops/schedule";

type LiveOpsVm = ReturnType<typeof useLiveOperationsWorkspaceViewModel>;

function Pill({ value }: { value: string }) {
  return (
    <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1", liveOpsPillClass(value))}>
      {label(value)}
    </span>
  );
}

function Header({ title, count, action }: { title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-baseline gap-2 text-lg font-semibold text-foreground">
        {title}
        {typeof count === "number" ? <span className="text-sm font-normal tabular-nums text-muted-foreground">{count}</span> : null}
      </h3>
      {action}
    </div>
  );
}

/** Button that reveals an inline creation form, so the desk is not a stack of open forms. */
function FormToggle({ open, controls, label: toggleLabel, onToggle }: { open: boolean; controls: string; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={cx(
        "inline-flex min-h-11 items-center gap-1.5 rounded-md px-4 text-sm font-semibold",
        open ? "border border-border bg-background text-foreground" : "bg-primary text-primary-foreground",
      )}
    >
      {open ? <X className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
      {open ? "Close form" : toggleLabel}
    </button>
  );
}

function Disclosure({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border border-border bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-semibold">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
        {title}
        {summary ? <span className="ml-auto text-xs font-normal text-muted-foreground">{summary}</span> : null}
      </summary>
      <div className="border-t border-border p-4 sm:p-5">{children}</div>
    </details>
  );
}

function Empty({ label: emptyLabel }: { label: string }) {
  return <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">{emptyLabel}</p>;
}

/** Compact desk header: noun title, refresh, and live counts as one readable row. */
export function LiveOpsOverview({
  event,
  liveOps,
  metrics,
  busy,
  onReload,
}: {
  event: PrismEvent;
  liveOps: PrismLiveOps | null;
  metrics: LiveOpsVm["metrics"];
  busy: boolean;
  onReload: () => Promise<void>;
}) {
  const stats: Array<[string, number]> = [
    ["Open issues", metrics.openIssues],
    ["Tasks done", metrics.completedTasks],
    ["Guests checked in", liveOps?.guestAttendanceCount ?? 0],
    ["Suppliers verified", metrics.verifiedSuppliers],
    ["Coordinators present", metrics.presentCoordinators],
  ];
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5" aria-labelledby="live-desk-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="live-desk-title" className="text-xl font-semibold text-foreground">Live desk</h2>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{event.clientName} · {formatPortalDate(event.eventDate)}</p>
        </div>
        <button type="button" disabled={busy} onClick={onReload} className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground disabled:opacity-60">
          <RefreshCw className="size-4" aria-hidden /> Refresh
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 sm:grid-cols-5">
        {stats.map(([statLabel, value]) => (
          <div key={statLabel} className="flex items-baseline justify-between gap-2 border-t border-border py-1.5 sm:block">
            <dt className="text-xs text-muted-foreground">{statLabel}</dt>
            <dd className={cx("text-base font-semibold tabular-nums sm:text-lg", statLabel === "Open issues" && value > 0 ? "text-danger" : "text-foreground")}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function LiveOpsStatusFeed({ feed }: { feed: PrismEventDayStatusFeed }) {
  return (
    <div>
      <p className="text-xs leading-5 text-muted-foreground">
        Role-safe operational signals for event day. Finance, audit trail exports, and private supplier reviews stay in their PMCM-only workspaces.
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {feed.items.slice(0, 8).map((item) => (
          <div key={`${item.type}-${item.id}`} className="min-w-[240px] rounded-md border border-border bg-background p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 font-semibold">{item.title}</p>
              <Pill value={item.slaStatus ?? item.verificationStatus ?? item.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{label(item.type)} · {label(item.role ?? item.status)}</p>
            {item.escalationLevel && item.escalationLevel !== "none" ? (
              <div className="mt-2"><Pill value={item.escalationLevel} /></div>
            ) : null}
          </div>
        ))}
        {feed.items.length === 0 ? <Empty label="No role-safe live signals yet." /> : null}
      </div>
    </div>
  );
}

export function LiveOpsDesk({
  eventId,
  liveOps,
  statusFeed,
  coordinators,
  busy,
  vm,
  onUpdateTask,
  onEscalateTask,
  onUpdateIssue,
  onEscalateIssue,
  onUpdateCoordinatorAttendance,
  onReplaceCoordinator,
  onLoadCoordinatorSuggestions,
  onVerifySupplierStatus,
  onDecideTaskReassignment,
}: {
  eventId: string;
  liveOps: PrismLiveOps;
  statusFeed: PrismEventDayStatusFeed | null;
  coordinators: PrismCoordinator[];
  busy: boolean;
  vm: LiveOpsVm;
  onUpdateTask: (taskId: string, input: UpdateEventDayTaskInput) => Promise<void>;
  onEscalateTask: (taskId: string, input: EscalateEventDayTaskInput) => Promise<void>;
  onUpdateIssue: (issueId: string, input: UpdateUrgentIssueInput) => Promise<void>;
  onEscalateIssue: (issueId: string, input: EscalateLiveOpsInput) => Promise<void>;
  onUpdateCoordinatorAttendance: (assignmentId: string, input: UpdateCoordinatorAttendanceInput) => Promise<void>;
  onReplaceCoordinator: (assignmentId: string, input: ReplaceCoordinatorAssignmentInput) => Promise<void>;
  onLoadCoordinatorSuggestions: (role: CoordinatorRole, skills: string[]) => Promise<PrismCoordinatorSuggestion[]>;
  onVerifySupplierStatus: (requestId: string, input: VerifySupplierStatusInput) => Promise<void>;
  onDecideTaskReassignment: (requestId: string, input: DecideEventTaskReassignmentInput) => Promise<void>;
}) {
  return (
    <>
      {liveOps.schedule ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
          <LiveOpsControlSurface eventId={eventId} schedule={liveOps.schedule} timer={liveOps.timer} />
          {liveOps.schedule.authored ? (
            <Link href={eventRunSheetHref(eventId)} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-semibold no-underline">
              Open printable run sheet
            </Link>
          ) : null}
        </div>
      ) : null}

      <LiveOpsIssuesPanel liveOps={liveOps} busy={busy} vm={vm} onUpdateIssue={onUpdateIssue} onEscalateIssue={onEscalateIssue} />
      <LiveOpsTasksPanel liveOps={liveOps} busy={busy} vm={vm} onUpdateTask={onUpdateTask} onEscalateTask={onEscalateTask} />

      <ReassignmentReviewPanel liveOps={liveOps} busy={busy} onDecide={onDecideTaskReassignment} />

      <Disclosure title="Attendance and supplier setup" summary={`${liveOps.coordinatorAssignments.length} coordinators · ${liveOps.supplierStatuses.length} suppliers`}>
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h3 className="text-base font-semibold">Supplier setup</h3>
            <p className="text-xs text-muted-foreground">Self-reported status and PMCM verification.</p>
            <div className="mt-3 space-y-3">
              {liveOps.supplierStatuses.length === 0 ? <Empty label="No supplier event-day statuses yet." /> : null}
              {liveOps.supplierStatuses.map((request) => (
                <SupplierRow
                  key={request.id}
                  request={request}
                  busy={busy}
                  onVerify={() => onVerifySupplierStatus(request.id, { verificationStatus: "verified", notes: "PMCM/coordinator verified setup on site." })}
                  onDispute={() => onVerifySupplierStatus(request.id, { verificationStatus: "disputed", notes: "Setup needs PMCM follow-up." })}
                />
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-base font-semibold">Coordinator attendance</h3>
            <p className="text-xs text-muted-foreground">Present, late, absent, or replaced.</p>
            <div className="mt-3 space-y-3">
              {liveOps.coordinatorAssignments.length === 0 ? <Empty label="No coordinator assignments yet." /> : null}
              {liveOps.coordinatorAssignments.map((assignment) => (
                <CoordinatorRow
                  key={assignment.id}
                  assignment={assignment}
                  coordinators={coordinators}
                  busy={busy}
                  onLoadSuggestions={onLoadCoordinatorSuggestions}
                  onStatus={(status) => onUpdateCoordinatorAttendance(assignment.id, { status, notes: status === "late" ? "Marked late from live desk." : "" })}
                  onReplace={(input) => onReplaceCoordinator(assignment.id, input)}
                />
              ))}
            </div>
          </div>
        </section>
      </Disclosure>

      <Disclosure title="Schedule and reports">
        <LiveOpsScheduleDesk eventId={eventId} assignments={liveOps.coordinatorAssignments} canStartEventDay canManageSchedule canReplyToReports canSubmitReports={false} />
      </Disclosure>

      {statusFeed ? (
        <Disclosure title="Live signals" summary={`${statusFeed.items.length} signals`}>
          <LiveOpsStatusFeed feed={statusFeed} />
        </Disclosure>
      ) : null}

      <Disclosure title="Event-day log" summary={`${liveOps.eventDayLogs.length} entries`}>
        <div className="grid gap-3 md:grid-cols-2">
          {liveOps.eventDayLogs.length === 0 ? <Empty label="No event-day log entries yet." /> : null}
          {liveOps.eventDayLogs.map((entry) => (
            <div key={entry.id} className="rounded-md border border-border bg-background p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold">{entry.message}</p>
                <Pill value={entry.actionType} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{entry.actor} · {formatPortalDateTime(entry.createdAt)}</p>
            </div>
          ))}
        </div>
      </Disclosure>
    </>
  );
}

export function ReassignmentReviewPanel({
  liveOps,
  busy,
  onDecide,
}: {
  liveOps: PrismLiveOps;
  busy: boolean;
  onDecide: (requestId: string, input: DecideEventTaskReassignmentInput) => Promise<void>;
}) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const pending = (liveOps.taskReassignmentRequests ?? []).filter((request) => request.status === "pending");
  if (pending.length === 0) return null;

  function decide(request: PrismEventTaskReassignmentRequest, decision: "approved" | "rejected") {
    setError(null);
    try {
      const input = parseContract(decideEventTaskReassignmentSchema, { decision, reason: reasons[request.id] }, "Task reassignment decision");
      void onDecide(request.id, input);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record this decision.");
    }
  }

  const taskTitle = (taskId: string) => liveOps.tasks.find((task) => task.id === taskId)?.title ?? taskId;

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <Header title="Task reassignment requests" count={pending.length} />
      <div className="mt-4 space-y-3">
        {pending.map((request) => (
          <div key={request.id} className="rounded-md border border-border bg-background p-4">
            <p className="font-semibold">{request.fromOwnerRole} → {request.toOwnerRole}{request.toOwnerName ? ` (${request.toOwnerName})` : ""}</p>
            <p className="mt-1 text-sm text-muted-foreground">Task: {taskTitle(request.taskId)}. Requested by {request.requestedBy}. {request.reason}</p>
            <label className="mt-3 grid gap-1 text-xs font-semibold text-muted-foreground">Decision note
              <textarea value={reasons[request.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [request.id]: event.target.value }))} rows={2} className="rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground" placeholder="Required when rejecting" />
            </label>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy} onClick={() => decide(request, "approved")} className="h-9 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">Approve</button>
              <button type="button" disabled={busy || !(reasons[request.id] ?? "").trim()} onClick={() => decide(request, "rejected")} className="h-9 rounded-md border border-border px-3 text-sm font-semibold disabled:opacity-60">Reject</button>
            </div>
          </div>
        ))}
      </div>
      {error ? <p role="alert" className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-xs font-bold text-danger">{error}</p> : null}
    </section>
  );
}

function LiveOpsIssuesPanel({
  liveOps,
  busy,
  vm,
  onUpdateIssue,
  onEscalateIssue,
}: {
  liveOps: PrismLiveOps;
  busy: boolean;
  vm: LiveOpsVm;
  onUpdateIssue: (issueId: string, input: UpdateUrgentIssueInput) => Promise<void>;
  onEscalateIssue: (issueId: string, input: EscalateLiveOpsInput) => Promise<void>;
}) {
  const issues = orderLiveOpsIssuesForDesk(liveOps.urgentIssues);
  const openCount = issues.filter(isOpenLiveOpsIssue).length;
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5" aria-label="Urgent issues">
      <Header
        title="Urgent issues"
        count={openCount}
        action={<FormToggle open={vm.issueFormOpen} controls="live-ops-issue-form" label="Log issue" onToggle={vm.toggleIssueForm} />}
      />
      <div className="mt-3 space-y-3">
        {issues.length === 0 ? <Empty label="No urgent issues open." /> : null}
        {issues.map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            busy={busy}
            onResolve={() => onUpdateIssue(issue.id, { status: "resolved", resolution: "Resolved from live desk." })}
            onEscalate={() =>
              onEscalateIssue(issue.id, {
                escalationLevel: issue.severity === "critical" ? "critical" : "pmcm",
                notes: `Escalated from PMCM live desk: ${issue.title}`,
                ownerRole: issue.ownerRole || vm.issueOwnerRole,
              })
            }
          />
        ))}
      </div>
      <div id="live-ops-issue-form" hidden={!vm.issueFormOpen} className="mt-4 grid gap-3 rounded-md border border-border bg-background p-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Issue title</span>
          <input value={vm.issueTitle} onChange={(event) => vm.setIssueTitle(event.target.value)} placeholder="Supplier late, walk-in queue, program blocker" className="h-11 rounded-md border border-border bg-white px-3 text-sm" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Issue description</span>
          <textarea value={vm.issueDescription} onChange={(event) => vm.setIssueDescription(event.target.value)} placeholder="What happened, and what needs attention?" rows={3} className="rounded-md border border-border bg-white px-3 py-2 text-sm" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Affected area</span>
          <input value={vm.issueAffectedArea} onChange={(event) => vm.setIssueAffectedArea(event.target.value)} placeholder="Registration, stage, ingress, or guest services" className="h-11 rounded-md border border-border bg-white px-3 text-sm" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Severity</span>
            <select value={vm.issueSeverity} onChange={(event) => vm.setIssueSeverity(event.target.value as typeof vm.issueSeverity)} className="h-11 rounded-md border border-border bg-white px-3 text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Owner role</span>
            <select value={vm.issueOwnerRole} onChange={(event) => vm.setIssueOwnerRole(event.target.value)} className="h-11 rounded-md border border-border bg-white px-3 text-sm">
              {COORDINATOR_ROLES.map((role) => <option key={role}>{role}</option>)}
            </select>
          </label>
        </div>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">SLA due time</span>
          <DateTimePicker value={vm.issueSlaDueAt} onValueChange={(next) => vm.setIssueSlaDueAt(next)} />
        </label>
        <p className="text-xs leading-5 text-muted-foreground">
          Urgent issues are operational blockers. Escalation notifies PMCM/operator context; it does not expose finance, audit, or private supplier review data.
        </p>
        <button type="button" disabled={busy || !vm.issueTitle.trim()} onClick={() => void vm.createIssue()} className="h-11 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          Open urgent issue
        </button>
      </div>
    </section>
  );
}

function LiveOpsTasksPanel({
  liveOps,
  busy,
  vm,
  onUpdateTask,
  onEscalateTask,
}: {
  liveOps: PrismLiveOps;
  busy: boolean;
  vm: LiveOpsVm;
  onUpdateTask: (taskId: string, input: UpdateEventDayTaskInput) => Promise<void>;
  onEscalateTask: (taskId: string, input: EscalateEventDayTaskInput) => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5" aria-label="Event-day tasks">
      <Header
        title="Event-day tasks"
        count={liveOps.tasks.filter((task) => task.status !== "done").length}
        action={<FormToggle open={vm.taskFormOpen} controls="live-ops-task-form" label="Add task" onToggle={vm.toggleTaskForm} />}
      />
      <div className="mt-3 space-y-3">
        {liveOps.tasks.length === 0 ? <Empty label="No event-day tasks yet." /> : null}
        {liveOps.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            busy={busy}
            onProgress={() => onUpdateTask(task.id, { status: "in_progress" })}
            onDone={() => onUpdateTask(task.id, { status: "done", notes: "Completed from live desk." })}
            onEscalate={() =>
              onEscalateTask(task.id, {
                escalationLevel: task.priority === "critical" ? "critical" : "pmcm",
                notes: `Escalated from PMCM live desk: ${task.title}`,
                ownerName: task.ownerName || undefined,
              })
            }
          />
        ))}
      </div>
      <div id="live-ops-task-form" hidden={!vm.taskFormOpen} className="mt-4 grid gap-3 rounded-md border border-border bg-background p-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Task title</span>
          <input value={vm.taskTitle} onChange={(event) => vm.setTaskTitle(event.target.value)} placeholder="Registration dry run, stage cue check, ingress sweep" className="h-11 rounded-md border border-border bg-white px-3 text-sm" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Role</span>
            <select value={vm.taskRole} onChange={(event) => vm.setTaskRole(event.target.value)} className="h-11 rounded-md border border-border bg-white px-3 text-sm">
              {COORDINATOR_ROLES.map((role) => <option key={role}>{role}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Priority</span>
            <select value={vm.taskPriority} onChange={(event) => vm.setTaskPriority(event.target.value)} className="h-11 rounded-md border border-border bg-white px-3 text-sm">
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
        </div>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">SLA due time</span>
          <DateTimePicker value={vm.taskSlaDueAt} onValueChange={(next) => vm.setTaskSlaDueAt(next)} />
        </label>
        <button type="button" disabled={busy || !vm.taskTitle.trim()} onClick={() => void vm.createTask()} className="h-11 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          Add task
        </button>
      </div>
    </section>
  );
}

function SupplierRow({ request, busy, onVerify, onDispute }: { request: PrismSupplierQuoteRequest; busy: boolean; onVerify: () => Promise<void>; onDispute: () => Promise<void> }) {
  const verification = request.eventDayVerificationStatus ?? request.verificationStatus ?? "self_reported";
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{request.supplierName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{request.category} - {label(request.eventDayStatus ?? "not_started")}</p>
        </div>
        <Pill value={verification} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy || verification === "verified"} onClick={onVerify} className="h-10 rounded-md bg-success-soft px-3 text-xs font-semibold text-success disabled:opacity-60">
          Verify on site
        </button>
        <button disabled={busy || verification === "disputed"} onClick={onDispute} className="h-10 rounded-md bg-danger-soft px-3 text-xs font-semibold text-danger disabled:opacity-60">
          Dispute setup
        </button>
      </div>
    </div>
  );
}

function CoordinatorRow({
  assignment,
  coordinators,
  busy,
  onStatus,
  onReplace,
  onLoadSuggestions,
}: {
  assignment: PrismCoordinatorAssignment;
  coordinators: PrismCoordinator[];
  busy: boolean;
  onStatus: (status: "present" | "late" | "absent" | "replaced") => Promise<void>;
  onReplace: (input: ReplaceCoordinatorAssignmentInput) => Promise<void>;
  onLoadSuggestions: (role: CoordinatorRole, skills: string[]) => Promise<PrismCoordinatorSuggestion[]>;
}) {
  const vm = useCoordinatorRowViewModel({ assignment, coordinators, busy, onReplace, onLoadSuggestions });

  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{assignment.coordinatorName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{assignment.role} - {label(assignment.status)}</p>
          {assignment.replacementReason ? <p className="mt-1 text-xs text-muted-foreground">Replacement: {assignment.replacementReason}</p> : null}
        </div>
        <Pill value={vm.attendanceStatus} />
      </div>
      <CoordinatorAttendanceButtons status={vm.attendanceStatus} busy={busy} onStatus={onStatus} />
      {vm.attendanceStatus !== "replaced" ? (
        <div className="mt-3 grid gap-2 rounded-md border border-dashed border-border bg-white p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <UserPlus className="size-4 text-attention" />
            Replacement
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Replacement marks this assignment as replaced, creates a pending assignment for the selected coordinator, and keeps the reason in the live log context.
          </p>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
            <select
              value={vm.replacementCoordinatorId}
              onChange={(event) => vm.selectReplacementCoordinator(event.target.value)}
              className="h-10 rounded-md border border-border bg-white px-2 text-xs"
            >
              <option value="">Select coordinator</option>
              {vm.eligibleCoordinators.map((coordinator) => (
                <option key={coordinator.id} value={coordinator.id}>{coordinator.name}</option>
              ))}
            </select>
            <select value={vm.replacementRole} onChange={(event) => vm.setReplacementRole(event.target.value)} className="h-10 rounded-md border border-border bg-white px-2 text-xs">
              <option value="">Select role</option>
              {vm.replacementRoleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </div>
          <button
            type="button"
            disabled={busy || !vm.replacementRole || vm.suggestionStatus === "loading"}
            onClick={() => void vm.findReplacementSuggestions()}
            className="h-9 rounded-md border border-border bg-background px-3 text-xs font-bold disabled:opacity-60"
          >
            {vm.suggestionStatus === "loading" ? "Finding replacement matches…" : "Find replacement matches"}
          </button>
          {vm.suggestionStatus === "error" ? <p role="status" className="text-xs text-destructive">Could not load replacement matches. Try again or select a coordinator manually.</p> : null}
          {vm.suggestionStatus === "empty" ? <p role="status" className="text-xs text-muted-foreground">No available skill matches for this role and event date.</p> : null}
          {vm.replacementSuggestions.map((suggestion) => (
            <div key={suggestion.id} className="rounded-md border border-border bg-background p-2">
              <p className="text-xs font-bold">{suggestion.name} · {suggestion.matchedSkillCount}/{suggestion.requiredSkillCount} skills</p>
              <p className="mt-1 text-xs text-muted-foreground">Matched: {suggestion.matchedSkills.join(", ") || "None"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Missing: {suggestion.missingSkills.join(", ") || "None"}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => vm.selectReplacementCoordinator(suggestion.id)}
                className="mt-2 h-8 rounded-md border border-border px-3 text-xs font-bold disabled:opacity-60"
              >
                Use {suggestion.name}
              </button>
            </div>
          ))}
          <input
            value={vm.replacementReason}
            onChange={(event) => vm.setReplacementReason(event.target.value)}
            placeholder="Replacement reason required for live log"
            className="h-10 rounded-md border border-border bg-white px-2 text-xs"
          />
          <button disabled={busy || !vm.canReplace} onClick={vm.replace} className="h-10 rounded-md bg-ink px-3 text-xs font-semibold text-ink-foreground disabled:opacity-60">
            Replace coordinator
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-border bg-white p-3 text-xs leading-5 text-muted-foreground">
          Replacement recorded. This row is retained as operational context; the replacement coordinator receives a pending assignment.
        </div>
      )}
    </div>
  );
}

function IssueRow({
  issue,
  busy,
  onResolve,
  onEscalate,
}: {
  issue: PrismUrgentIssue;
  busy: boolean;
  onResolve: () => Promise<void>;
  onEscalate: () => Promise<void>;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{issue.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{issue.ownerRole || "Unassigned"} - {issue.description || "No description"}</p>
          <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Affected area:</span> {issue.affectedArea || "Not specified"}</p>
          <SlaLine slaStatus={issue.slaStatus} slaDueAt={issue.slaDueAt} escalationLevel={issue.escalationLevel} escalatedBy={issue.escalatedBy} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill value={issue.severity} />
          <Pill value={issue.status} />
        </div>
      </div>
      {issue.status !== "resolved" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={busy} onClick={onResolve} className="h-10 rounded-md bg-success-soft px-3 text-xs font-semibold text-success disabled:opacity-60">
            Mark resolved
          </button>
          <button disabled={busy} onClick={onEscalate} className="inline-flex h-10 items-center gap-1 rounded-md bg-danger-soft px-3 text-xs font-semibold text-danger disabled:opacity-60">
            <BellRing className="size-3.5" /> Escalate to PMCM
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TaskRow({
  task,
  busy,
  onProgress,
  onDone,
  onEscalate,
}: {
  task: PrismEventDayTask;
  busy: boolean;
  onProgress: () => Promise<void>;
  onDone: () => Promise<void>;
  onEscalate: () => Promise<void>;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{task.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{task.assignedRole} - {task.ownerName || "No owner named"}</p>
          <SlaLine slaStatus={task.slaStatus} slaDueAt={task.slaDueAt} escalationLevel={task.escalationLevel} escalatedBy={task.escalatedBy} />
        </div>
        <Pill value={task.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy || task.status === "in_progress" || task.status === "done"} onClick={onProgress} className="h-10 rounded-md bg-attention-soft px-3 text-xs font-semibold text-attention disabled:opacity-60">
          In progress
        </button>
        <button disabled={busy || task.status === "done"} onClick={onDone} className="h-10 rounded-md bg-success-soft px-3 text-xs font-semibold text-success disabled:opacity-60">
          Done
        </button>
        <button disabled={busy || task.status === "done"} onClick={onEscalate} className="inline-flex h-10 items-center gap-1 rounded-md bg-danger-soft px-3 text-xs font-semibold text-danger disabled:opacity-60">
          <BellRing className="size-3.5" /> Escalate task
        </button>
      </div>
    </div>
  );
}

function SlaLine({
  slaStatus,
  slaDueAt,
  escalationLevel,
  escalatedBy,
}: {
  slaStatus?: string | null;
  slaDueAt?: string | null;
  escalationLevel?: string | null;
  escalatedBy?: string | null;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Pill value={slaStatus ?? "on_track"} />
      {slaDueAt ? <span className="tabular-nums">Due {formatPortalDateTime(slaDueAt)}</span> : null}
      {escalationLevel && escalationLevel !== "none" ? <Pill value={escalationLevel} /> : null}
      {escalatedBy ? <span>by {escalatedBy}</span> : null}
    </div>
  );
}

function CoordinatorAttendanceButtons({ status, busy, onStatus }: {
  status: string;
  busy: boolean;
  onStatus: (status: "present" | "late" | "absent" | "replaced") => Promise<void>;
}) {
  return (
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy || status === "present"} onClick={() => onStatus("present")} className="h-10 rounded-md bg-success-soft px-3 text-xs font-semibold text-success disabled:opacity-60">Present</button>
        <button disabled={busy || status === "late"} onClick={() => onStatus("late")} className="h-10 rounded-md bg-attention-soft px-3 text-xs font-semibold text-attention disabled:opacity-60">Late</button>
        <button disabled={busy || status === "absent"} onClick={() => onStatus("absent")} className="h-10 rounded-md bg-danger-soft px-3 text-xs font-semibold text-danger disabled:opacity-60">Absent</button>
      </div>
  );
}
