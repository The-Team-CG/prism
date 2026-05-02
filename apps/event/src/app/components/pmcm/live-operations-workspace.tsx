import { useMemo, useState } from "react";
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

import {
  type MvpCoordinator,
  type MvpCoordinatorAssignment,
  type MvpEvent,
  type MvpEventDayStatusFeed,
  type MvpEventDayTask,
  type MvpLiveOps,
  type MvpSupplierQuoteRequest,
  type MvpUrgentIssue,
} from "@/lib/mvp-api";
import { cx, label } from "./helpers";

function tone(value: string) {
  if (["done", "resolved", "verified", "present", "set_up_ready", "acknowledged", "confirmed", "on_track"].includes(value)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }
  if (["late", "disputed", "blocked", "critical", "high", "absent", "overdue", "pmcm"].includes(value)) {
    return "bg-rose-50 text-rose-700 ring-rose-100";
  }
  if (["in_progress", "assigned", "arrived", "medium", "self_reported", "due_soon", "role_lead"].includes(value)) {
    return "bg-amber-50 text-amber-800 ring-amber-100";
  }
  return "bg-muted text-muted-foreground ring-border";
}

function Pill({ value }: { value: string }) {
  return <span className={cx("rounded-full px-2.5 py-1 text-xs font-black capitalize ring-1", tone(value))}>{label(value)}</span>;
}

function asIsoDateTime(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function LiveOperationsWorkspace({
  event,
  liveOps,
  statusFeed,
  coordinators,
  busy,
  onReload,
  onCreateTask,
  onUpdateTask,
  onEscalateTask,
  onCreateIssue,
  onUpdateIssue,
  onEscalateIssue,
  onUpdateCoordinatorAttendance,
  onReplaceCoordinator,
  onVerifySupplierStatus,
}: {
  event: MvpEvent;
  liveOps: MvpLiveOps | null;
  statusFeed: MvpEventDayStatusFeed | null;
  coordinators: MvpCoordinator[];
  busy: boolean;
  onReload: () => Promise<void>;
  onCreateTask: (input: { title: string; assignedRole?: string; ownerName?: string; priority?: string; notes?: string; slaDueAt?: string }) => Promise<void>;
  onUpdateTask: (taskId: string, input: { status?: "open" | "in_progress" | "done" | "blocked"; notes?: string }) => Promise<void>;
  onEscalateTask: (taskId: string, input: { escalationLevel: "role_lead" | "pmcm" | "critical"; notes: string; ownerRole?: string; ownerName?: string }) => Promise<void>;
  onCreateIssue: (input: { title: string; severity?: "low" | "medium" | "high" | "critical"; ownerRole?: string; description?: string; slaDueAt?: string }) => Promise<void>;
  onUpdateIssue: (issueId: string, input: { status?: "open" | "assigned" | "resolved" | "cancelled"; resolution?: string }) => Promise<void>;
  onEscalateIssue: (issueId: string, input: { escalationLevel: "role_lead" | "pmcm" | "critical"; notes: string; ownerRole?: string; ownerName?: string }) => Promise<void>;
  onUpdateCoordinatorAttendance: (assignmentId: string, input: { status: "present" | "late" | "absent" | "replaced"; notes?: string }) => Promise<void>;
  onReplaceCoordinator: (assignmentId: string, input: { replacementCoordinatorId: string; role: string; reason: string }) => Promise<void>;
  onVerifySupplierStatus: (requestId: string, input: { verificationStatus: "self_reported" | "verified" | "disputed"; notes?: string }) => Promise<void>;
}) {
  const [taskTitle, setTaskTitle] = useState("");
  const [taskRole, setTaskRole] = useState("General Coordinator");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [taskSlaDueAt, setTaskSlaDueAt] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueSeverity, setIssueSeverity] = useState<"low" | "medium" | "high" | "critical">("high");
  const [issueOwnerRole, setIssueOwnerRole] = useState("Event Day System Operator");
  const [issueSlaDueAt, setIssueSlaDueAt] = useState("");

  const metrics = useMemo(() => {
    const tasks = liveOps?.tasks ?? [];
    const issues = liveOps?.urgentIssues ?? [];
    const suppliers = liveOps?.supplierStatuses ?? [];
    const coordinators = liveOps?.coordinatorAssignments ?? [];
    return {
      completedTasks: tasks.filter((task) => task.status === "done").length,
      openIssues: issues.filter((issue) => !["resolved", "cancelled"].includes(issue.status)).length,
      verifiedSuppliers: suppliers.filter((supplier) => supplier.eventDayVerificationStatus === "verified" || supplier.verificationStatus === "verified").length,
      presentCoordinators: coordinators.filter((assignment) => assignment.attendanceStatus === "present").length,
    };
  }, [liveOps]);

  async function createTask() {
    await onCreateTask({ title: taskTitle, assignedRole: taskRole, priority: taskPriority, slaDueAt: asIsoDateTime(taskSlaDueAt) });
    setTaskTitle("");
    setTaskSlaDueAt("");
  }

  async function createIssue() {
    await onCreateIssue({ title: issueTitle, severity: issueSeverity, ownerRole: issueOwnerRole, slaDueAt: asIsoDateTime(issueSlaDueAt) });
    setIssueTitle("");
    setIssueSlaDueAt("");
  }

  return (
    <div className="space-y-5">
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
          <button disabled={busy} onClick={onReload} className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-black text-foreground disabled:opacity-60">
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
        {statusFeed && (
          <div className="mt-4 rounded-md border border-border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-black">
                <TimerReset className="size-4 text-(--prism-amber)" />
                Role-safe status feed
              </div>
              <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                {statusFeed.items.length} live signals
              </span>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {statusFeed.items.slice(0, 8).map((item) => (
                <div key={`${item.type}-${item.id}`} className="min-w-[210px] rounded-md border border-border bg-white p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 font-black">{item.title}</p>
                    <Pill value={item.slaStatus ?? item.verificationStatus ?? item.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{label(item.type)} - {label(item.role ?? item.status)}</p>
                  {item.escalationLevel && item.escalationLevel !== "none" && (
                    <div className="mt-2"><Pill value={item.escalationLevel} /></div>
                  )}
                </div>
              ))}
              {statusFeed.items.length === 0 && <Empty label="No role-safe live signals yet." />}
            </div>
          </div>
        )}
      </section>

      {!liveOps ? (
        <section className="rounded-lg border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
          Event-day live operations have not been loaded yet.
        </section>
      ) : (
        <>
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-lg border border-border bg-card p-5">
              <Header icon={Truck} eyebrow="Supplier setup" title="Self-reported status and PMCM verification" />
              <div className="mt-4 space-y-3">
                {liveOps.supplierStatuses.length === 0 && <Empty label="No supplier event-day statuses yet." />}
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
                {liveOps.coordinatorAssignments.length === 0 && <Empty label="No coordinator assignments yet." />}
                {liveOps.coordinatorAssignments.map((assignment) => (
                  <CoordinatorRow
                    key={assignment.id}
                    assignment={assignment}
                    coordinators={coordinators}
                    busy={busy}
                    onStatus={(status) => onUpdateCoordinatorAttendance(assignment.id, { status, notes: status === "late" ? "Marked late from live desk." : "" })}
                    onReplace={(input) => onReplaceCoordinator(assignment.id, input)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-lg border border-border bg-card p-5">
              <Header icon={AlertTriangle} eyebrow="Urgent issues" title="Open, assign, and resolve blockers" />
              <div className="mt-4 grid gap-3 rounded-md border border-border bg-background p-3">
                <input value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} placeholder="Issue title" className="h-10 rounded-md border border-border bg-white px-3 text-sm" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={issueSeverity} onChange={(event) => setIssueSeverity(event.target.value as typeof issueSeverity)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <select value={issueOwnerRole} onChange={(event) => setIssueOwnerRole(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
                    <option>Event Day System Operator</option>
                    <option>Registration Staff</option>
                    <option>Floor Director</option>
                    <option>Stage Director</option>
                    <option>Ingress and Egress Assistant</option>
                    <option>Usher</option>
                  </select>
                </div>
                <input
                  type="datetime-local"
                  value={issueSlaDueAt}
                  onChange={(event) => setIssueSlaDueAt(event.target.value)}
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm"
                />
                <button disabled={busy || !issueTitle.trim()} onClick={createIssue} className="h-10 rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60">
                  Open issue
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {liveOps.urgentIssues.length === 0 && <Empty label="No urgent issues open." />}
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
                        ownerRole: issue.ownerRole || issueOwnerRole,
                      })
                    }
                  />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <Header icon={ClipboardList} eyebrow="Event-day tasks" title="Role-owned live checklist" />
              <div className="mt-4 grid gap-3 rounded-md border border-border bg-background p-3">
                <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Task title" className="h-10 rounded-md border border-border bg-white px-3 text-sm" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={taskRole} onChange={(event) => setTaskRole(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
                    <option>General Coordinator</option>
                    <option>Event Day System Operator</option>
                    <option>Registration Staff</option>
                    <option>Floor Director</option>
                    <option>Stage Director</option>
                    <option>Ingress and Egress Assistant</option>
                    <option>Usher</option>
                  </select>
                  <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <input
                  type="datetime-local"
                  value={taskSlaDueAt}
                  onChange={(event) => setTaskSlaDueAt(event.target.value)}
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm"
                />
                <button disabled={busy || !taskTitle.trim()} onClick={createTask} className="h-10 rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60">
                  Add task
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {liveOps.tasks.length === 0 && <Empty label="No event-day tasks yet." />}
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
                        ownerRole: task.assignedRole,
                        ownerName: task.ownerName || undefined,
                      })
                    }
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <Header icon={ShieldCheck} eyebrow="Live log" title="Event-day operational trail" />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {liveOps.eventDayLogs.length === 0 && <Empty label="No event-day log entries yet." />}
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
      )}
    </div>
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

function SupplierRow({ request, busy, onVerify, onDispute }: { request: MvpSupplierQuoteRequest; busy: boolean; onVerify: () => Promise<void>; onDispute: () => Promise<void> }) {
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
        <button disabled={busy || verification === "verified"} onClick={onVerify} className="h-8 rounded-md bg-emerald-50 px-3 text-xs font-black text-emerald-700 disabled:opacity-60">
          Verify setup
        </button>
        <button disabled={busy || verification === "disputed"} onClick={onDispute} className="h-8 rounded-md bg-rose-50 px-3 text-xs font-black text-rose-700 disabled:opacity-60">
          Dispute
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
}: {
  assignment: MvpCoordinatorAssignment;
  coordinators: MvpCoordinator[];
  busy: boolean;
  onStatus: (status: "present" | "late" | "absent" | "replaced") => Promise<void>;
  onReplace: (input: { replacementCoordinatorId: string; role: string; reason: string }) => Promise<void>;
}) {
  const status = assignment.attendanceStatus ?? "pending";
  const [replacementCoordinatorId, setReplacementCoordinatorId] = useState("");
  const [replacementRole, setReplacementRole] = useState(assignment.role);
  const [replacementReason, setReplacementReason] = useState("");
  const eligibleCoordinators = coordinators.filter((coordinator) => coordinator.id !== assignment.coordinatorId && coordinator.active);

  async function replace() {
    if (!replacementCoordinatorId || !replacementReason.trim()) return;
    await onReplace({ replacementCoordinatorId, role: replacementRole || assignment.role, reason: replacementReason.trim() });
    setReplacementCoordinatorId("");
    setReplacementReason("");
  }

  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black">{assignment.coordinatorName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{assignment.role} - {label(assignment.status)}</p>
          {assignment.replacementReason && <p className="mt-1 text-xs text-muted-foreground">Replacement: {assignment.replacementReason}</p>}
        </div>
        <Pill value={status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy || status === "present"} onClick={() => onStatus("present")} className="h-8 rounded-md bg-emerald-50 px-3 text-xs font-black text-emerald-700 disabled:opacity-60">Present</button>
        <button disabled={busy || status === "late"} onClick={() => onStatus("late")} className="h-8 rounded-md bg-amber-50 px-3 text-xs font-black text-amber-800 disabled:opacity-60">Late</button>
        <button disabled={busy || status === "absent"} onClick={() => onStatus("absent")} className="h-8 rounded-md bg-rose-50 px-3 text-xs font-black text-rose-700 disabled:opacity-60">Absent</button>
      </div>
      {status !== "replaced" && (
        <div className="mt-3 grid gap-2 rounded-md border border-dashed border-border bg-white p-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
            <UserPlus className="size-4 text-(--prism-amber)" />
            Replacement
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
            <select
              value={replacementCoordinatorId}
              onChange={(event) => {
                const nextCoordinatorId = event.target.value;
                setReplacementCoordinatorId(nextCoordinatorId);
                const nextCoordinator = coordinators.find((coordinator) => coordinator.id === nextCoordinatorId);
                if (nextCoordinator?.roleTags?.length && !nextCoordinator.roleTags.includes(replacementRole)) {
                  setReplacementRole(nextCoordinator.roleTags[0]);
                }
              }}
              className="h-9 rounded-md border border-border bg-white px-2 text-xs"
            >
              <option value="">Select coordinator</option>
              {eligibleCoordinators.map((coordinator) => (
                <option key={coordinator.id} value={coordinator.id}>{coordinator.name}</option>
              ))}
            </select>
            <input value={replacementRole} onChange={(event) => setReplacementRole(event.target.value)} className="h-9 rounded-md border border-border bg-white px-2 text-xs" />
          </div>
          <input
            value={replacementReason}
            onChange={(event) => setReplacementReason(event.target.value)}
            placeholder="Replacement reason"
            className="h-9 rounded-md border border-border bg-white px-2 text-xs"
          />
          <button disabled={busy || !replacementCoordinatorId || !replacementReason.trim()} onClick={replace} className="h-8 rounded-md bg-(--prism-ink) px-3 text-xs font-black text-sidebar-foreground disabled:opacity-60">
            Replace coordinator
          </button>
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
  issue: MvpUrgentIssue;
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
          <SlaLine slaStatus={issue.slaStatus} slaDueAt={issue.slaDueAt} escalationLevel={issue.escalationLevel} escalatedBy={issue.escalatedBy} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill value={issue.severity} />
          <Pill value={issue.status} />
        </div>
      </div>
      {issue.status !== "resolved" && (
        <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy} onClick={onResolve} className="h-8 rounded-md bg-emerald-50 px-3 text-xs font-black text-emerald-700 disabled:opacity-60">
          Mark resolved
        </button>
          <button disabled={busy} onClick={onEscalate} className="inline-flex h-8 items-center gap-1 rounded-md bg-rose-50 px-3 text-xs font-black text-rose-700 disabled:opacity-60">
            <BellRing className="size-3.5" /> Escalate
          </button>
        </div>
      )}
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
  task: MvpEventDayTask;
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
        <button disabled={busy || task.status === "in_progress" || task.status === "done"} onClick={onProgress} className="h-8 rounded-md bg-amber-50 px-3 text-xs font-black text-amber-800 disabled:opacity-60">
          In progress
        </button>
        <button disabled={busy || task.status === "done"} onClick={onDone} className="h-8 rounded-md bg-emerald-50 px-3 text-xs font-black text-emerald-700 disabled:opacity-60">
          Done
        </button>
        <button disabled={busy || task.status === "done"} onClick={onEscalate} className="inline-flex h-8 items-center gap-1 rounded-md bg-rose-50 px-3 text-xs font-black text-rose-700 disabled:opacity-60">
          <BellRing className="size-3.5" /> Escalate
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
      {slaDueAt && <span>Due {new Date(slaDueAt).toLocaleString("en-PH")}</span>}
      {escalationLevel && escalationLevel !== "none" && <Pill value={escalationLevel} />}
      {escalatedBy && <span>by {escalatedBy}</span>}
    </div>
  );
}
