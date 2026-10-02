import {
  AlertTriangle,
  BellRing,
  ClipboardList,
  Radio,
  RefreshCw,
  ShieldCheck,
  TimerReset,
  Truck,
  UserCheck,
  UserPlus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
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
import { liveOpsPillClass } from "../model/live-ops-workspace-rules";
import { useCoordinatorRowViewModel } from "../view-models/use-coordinator-row-view-model";
import type { useLiveOperationsWorkspaceViewModel } from "../view-models/use-live-operations-workspace-view-model";
import { LiveOpsControlSurface, LiveOpsScheduleDesk } from "@/features/live-ops/schedule";

type LiveOpsVm = ReturnType<typeof useLiveOperationsWorkspaceViewModel>;

function Pill({ value }: { value: string }) {
  return (
    <span className={cx("rounded-full px-2.5 py-1 text-xs font-black capitalize ring-1", liveOpsPillClass(value))}>
      {label(value)}
    </span>
  );
}

function Header({ icon: Icon, eyebrow, title }: { icon: LucideIcon; eyebrow: string; title: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-1 size-5 text-(--prism-amber)" />
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-(--prism-amber)">{eyebrow}</p>
        <h3 className="mt-1 text-lg font-black">{title}</h3>
      </div>
    </div>
  );
}

function MetricTile({ label: metricLabel, value, icon: Icon }: { label: string; value: number | string; icon: LucideIcon }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <Icon className="size-5 text-(--prism-amber)" />
        <p className="text-2xl font-black">{value}</p>
      </div>
      <p className="mt-2 text-xs font-black uppercase tracking-wide text-muted-foreground">{metricLabel}</p>
    </div>
  );
}

function Empty({ label: emptyLabel }: { label: string }) {
  return <div className="rounded-md border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">{emptyLabel}</div>;
}

export function LiveOpsOverview({
  event,
  liveOps,
  statusFeed,
  metrics,
  busy,
  onReload,
}: {
  event: PrismEvent;
  liveOps: PrismLiveOps | null;
  statusFeed: PrismEventDayStatusFeed | null;
  metrics: LiveOpsVm["metrics"];
  busy: boolean;
  onReload: () => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-primary/12 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Radio className="mt-1 size-5 text-(--prism-amber)" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-(--prism-amber)">Event-day operations</p>
            <h3 className="mt-1 text-xl font-black">{event.eventName} live desk</h3>
            <p className="mt-1 text-sm text-muted-foreground">{event.clientName} - {event.eventDate}</p>
          </div>
        </div>
        <button disabled={busy} onClick={onReload} className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-black text-foreground disabled:opacity-60">
          <RefreshCw className="size-4" /> Refresh
        </button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <MetricTile label="Guest attendance" value={liveOps?.guestAttendanceCount ?? 0} icon={UsersRound} />
        <MetricTile label="Tasks done" value={metrics.completedTasks} icon={ClipboardList} />
        <MetricTile label="Open issues" value={metrics.openIssues} icon={AlertTriangle} />
        <MetricTile label="Suppliers verified" value={metrics.verifiedSuppliers} icon={Truck} />
        <MetricTile label="Coord. present" value={metrics.presentCoordinators} icon={UserCheck} />
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-md border border-(--prism-amber)/20 bg-(--prism-amber)/8 p-3 text-sm leading-6 text-(--prism-amber)">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <span>
          Live operations shows event-day readiness, attendance, tasks, issues, and setup verification only. Finance, audit trail exports, and private supplier reviews stay in their PMCM-only workspaces.
        </span>
      </div>
      {statusFeed ? <LiveOpsStatusFeed feed={statusFeed} /> : null}
    </section>
  );
}

function LiveOpsStatusFeed({ feed }: { feed: PrismEventDayStatusFeed }) {
  return (
    <div className="mt-4 rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-black">
          <TimerReset className="size-4 text-(--prism-amber)" />
          Role-safe status feed
        </div>
        <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">
          {feed.items.length} live signals
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Feed cards are role-safe operational signals for event day, not billing or audit records.
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {feed.items.slice(0, 8).map((item) => (
          <div key={`${item.type}-${item.id}`} className="min-w-[240px] rounded-md border border-border bg-white p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 font-black">{item.title}</p>
              <Pill value={item.slaStatus ?? item.verificationStatus ?? item.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{label(item.type)} - {label(item.role ?? item.status)}</p>
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
      {liveOps.schedule ? <div className="rounded-lg border border-border bg-card p-5"><LiveOpsControlSurface schedule={liveOps.schedule} timer={liveOps.timer} /></div> : null}
      <LiveOpsScheduleDesk eventId={eventId} assignments={liveOps.coordinatorAssignments} canManageSchedule canReplyToReports canSubmitReports={false} />
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-border bg-card p-5">
          <Header icon={Truck} eyebrow="Supplier setup" title="Self-reported status and PMCM verification" />
          <div className="mt-4 space-y-3">
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

        <div className="rounded-lg border border-border bg-card p-5">
          <Header icon={UserCheck} eyebrow="Coordinator attendance" title="Present, late, absent, or replaced" />
          <div className="mt-4 space-y-3">
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

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <LiveOpsIssuesPanel liveOps={liveOps} busy={busy} vm={vm} onUpdateIssue={onUpdateIssue} onEscalateIssue={onEscalateIssue} />
        <LiveOpsTasksPanel liveOps={liveOps} busy={busy} vm={vm} onUpdateTask={onUpdateTask} onEscalateTask={onEscalateTask} />
      </section>

      <ReassignmentReviewPanel liveOps={liveOps} busy={busy} onDecide={onDecideTaskReassignment} />

      <section className="rounded-lg border border-border bg-card p-5">
        <Header icon={ShieldCheck} eyebrow="Live log" title="Event-day operational trail" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {liveOps.eventDayLogs.length === 0 ? <Empty label="No event-day log entries yet." /> : null}
          {liveOps.eventDayLogs.map((entry) => (
            <div key={entry.id} className="rounded-md border border-border bg-background p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-black">{entry.message}</p>
                <Pill value={entry.actionType} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{entry.actor} - {new Date(entry.createdAt).toLocaleString("en-PH")}</p>
            </div>
          ))}
        </div>
      </section>
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
    <section className="rounded-lg border border-border bg-card p-5">
      <Header icon={UserCheck} eyebrow="PMCM review" title="Coordinator task reassignment requests" />
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
      {error ? <p role="alert" className="mt-3 rounded-md bg-(--prism-danger)/10 px-3 py-2 text-xs font-bold text-(--prism-danger)">{error}</p> : null}
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
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <Header icon={AlertTriangle} eyebrow="Urgent issues" title="Open, assign, and resolve blockers" />
      <div className="mt-4 grid gap-3 rounded-md border border-border bg-background p-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">Issue title</span>
          <input value={vm.issueTitle} onChange={(event) => vm.setIssueTitle(event.target.value)} placeholder="Supplier late, walk-in queue, program blocker" className="h-11 rounded-md border border-border bg-white px-3 text-sm" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">Issue description</span>
          <textarea value={vm.issueDescription} onChange={(event) => vm.setIssueDescription(event.target.value)} placeholder="What happened, and what needs attention?" rows={3} className="rounded-md border border-border bg-white px-3 py-2 text-sm" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">Affected area</span>
          <input value={vm.issueAffectedArea} onChange={(event) => vm.setIssueAffectedArea(event.target.value)} placeholder="Registration, stage, ingress, or guest services" className="h-11 rounded-md border border-border bg-white px-3 text-sm" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">Severity</span>
            <select value={vm.issueSeverity} onChange={(event) => vm.setIssueSeverity(event.target.value as typeof vm.issueSeverity)} className="h-11 rounded-md border border-border bg-white px-3 text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">Owner role</span>
            <select value={vm.issueOwnerRole} onChange={(event) => vm.setIssueOwnerRole(event.target.value)} className="h-11 rounded-md border border-border bg-white px-3 text-sm">
              {COORDINATOR_ROLES.map((role) => <option key={role}>{role}</option>)}
            </select>
          </label>
        </div>
        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">SLA due time</span>
          <input
            type="datetime-local"
            value={vm.issueSlaDueAt}
            onChange={(event) => vm.setIssueSlaDueAt(event.target.value)}
            className="h-11 rounded-md border border-border bg-white px-3 text-sm"
          />
        </label>
        <p className="text-xs leading-5 text-muted-foreground">
          Urgent issues are operational blockers. Escalation notifies PMCM/operator context; it does not expose finance, audit, or private supplier review data.
        </p>
        <button disabled={busy || !vm.issueTitle.trim()} onClick={vm.createIssue} className="h-12 rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60">
          Open urgent issue
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {liveOps.urgentIssues.length === 0 ? <Empty label="No urgent issues open." /> : null}
        {liveOps.urgentIssues.map((issue) => (
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
    </div>
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
    <div className="rounded-lg border border-border bg-card p-5">
      <Header icon={ClipboardList} eyebrow="Event-day tasks" title="Role-owned live checklist" />
      <div className="mt-4 grid gap-3 rounded-md border border-border bg-background p-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">Task title</span>
          <input value={vm.taskTitle} onChange={(event) => vm.setTaskTitle(event.target.value)} placeholder="Registration dry run, stage cue check, ingress sweep" className="h-11 rounded-md border border-border bg-white px-3 text-sm" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">Role</span>
            <select value={vm.taskRole} onChange={(event) => vm.setTaskRole(event.target.value)} className="h-11 rounded-md border border-border bg-white px-3 text-sm">
              {COORDINATOR_ROLES.map((role) => <option key={role}>{role}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">Priority</span>
            <select value={vm.taskPriority} onChange={(event) => vm.setTaskPriority(event.target.value)} className="h-11 rounded-md border border-border bg-white px-3 text-sm">
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
        </div>
        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">SLA due time</span>
          <input
            type="datetime-local"
            value={vm.taskSlaDueAt}
            onChange={(event) => vm.setTaskSlaDueAt(event.target.value)}
            className="h-11 rounded-md border border-border bg-white px-3 text-sm"
          />
        </label>
        <button disabled={busy || !vm.taskTitle.trim()} onClick={vm.createTask} className="h-12 rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60">
          Add task
        </button>
      </div>
      <div className="mt-4 space-y-3">
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
    </div>
  );
}

function SupplierRow({ request, busy, onVerify, onDispute }: { request: PrismSupplierQuoteRequest; busy: boolean; onVerify: () => Promise<void>; onDispute: () => Promise<void> }) {
  const verification = request.eventDayVerificationStatus ?? request.verificationStatus ?? "self_reported";
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black">{request.supplierName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{request.category} - {label(request.eventDayStatus ?? "not_started")}</p>
        </div>
        <Pill value={verification} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy || verification === "verified"} onClick={onVerify} className="h-10 rounded-md bg-emerald-50 px-3 text-xs font-black text-emerald-700 disabled:opacity-60">
          Verify on site
        </button>
        <button disabled={busy || verification === "disputed"} onClick={onDispute} className="h-10 rounded-md bg-rose-50 px-3 text-xs font-black text-rose-700 disabled:opacity-60">
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
          <p className="font-black">{assignment.coordinatorName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{assignment.role} - {label(assignment.status)}</p>
          {assignment.replacementReason ? <p className="mt-1 text-xs text-muted-foreground">Replacement: {assignment.replacementReason}</p> : null}
        </div>
        <Pill value={vm.attendanceStatus} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy || vm.attendanceStatus === "present"} onClick={() => onStatus("present")} className="h-10 rounded-md bg-emerald-50 px-3 text-xs font-black text-emerald-700 disabled:opacity-60">Present</button>
        <button disabled={busy || vm.attendanceStatus === "late"} onClick={() => onStatus("late")} className="h-10 rounded-md bg-amber-50 px-3 text-xs font-black text-amber-800 disabled:opacity-60">Late</button>
        <button disabled={busy || vm.attendanceStatus === "absent"} onClick={() => onStatus("absent")} className="h-10 rounded-md bg-rose-50 px-3 text-xs font-black text-rose-700 disabled:opacity-60">Absent</button>
      </div>
      {vm.attendanceStatus !== "replaced" ? (
        <div className="mt-3 grid gap-2 rounded-md border border-dashed border-border bg-white p-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
            <UserPlus className="size-4 text-(--prism-amber)" />
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
          <button disabled={busy || !vm.canReplace} onClick={vm.replace} className="h-10 rounded-md bg-(--prism-ink) px-3 text-xs font-black text-sidebar-foreground disabled:opacity-60">
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
          <p className="font-black">{issue.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{issue.ownerRole || "Unassigned"} - {issue.description || "No description"}</p>
          <p className="mt-1 text-xs text-muted-foreground"><span className="font-black text-foreground">Affected area:</span> {issue.affectedArea || "Not specified"}</p>
          <SlaLine slaStatus={issue.slaStatus} slaDueAt={issue.slaDueAt} escalationLevel={issue.escalationLevel} escalatedBy={issue.escalatedBy} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill value={issue.severity} />
          <Pill value={issue.status} />
        </div>
      </div>
      {issue.status !== "resolved" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={busy} onClick={onResolve} className="h-10 rounded-md bg-emerald-50 px-3 text-xs font-black text-emerald-700 disabled:opacity-60">
            Mark resolved
          </button>
          <button disabled={busy} onClick={onEscalate} className="inline-flex h-10 items-center gap-1 rounded-md bg-rose-50 px-3 text-xs font-black text-rose-700 disabled:opacity-60">
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
          <p className="font-black">{task.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{task.assignedRole} - {task.ownerName || "No owner named"}</p>
          <SlaLine slaStatus={task.slaStatus} slaDueAt={task.slaDueAt} escalationLevel={task.escalationLevel} escalatedBy={task.escalatedBy} />
        </div>
        <Pill value={task.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy || task.status === "in_progress" || task.status === "done"} onClick={onProgress} className="h-10 rounded-md bg-amber-50 px-3 text-xs font-black text-amber-800 disabled:opacity-60">
          In progress
        </button>
        <button disabled={busy || task.status === "done"} onClick={onDone} className="h-10 rounded-md bg-emerald-50 px-3 text-xs font-black text-emerald-700 disabled:opacity-60">
          Done
        </button>
        <button disabled={busy || task.status === "done"} onClick={onEscalate} className="inline-flex h-10 items-center gap-1 rounded-md bg-rose-50 px-3 text-xs font-black text-rose-700 disabled:opacity-60">
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
      {slaDueAt ? <span>Due {new Date(slaDueAt).toLocaleString("en-PH")}</span> : null}
      {escalationLevel && escalationLevel !== "none" ? <Pill value={escalationLevel} /> : null}
      {escalatedBy ? <span>by {escalatedBy}</span> : null}
    </div>
  );
}
