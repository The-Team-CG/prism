"use client";
import { EventDayCopilotPanel } from "@/features/ai-advisory/views/live-assist-panels";
import { formatPortalDateTime } from "@prism/ui/format-date";

import { useState, type FormEvent } from "react";
import { ClipboardList, Truck, UserCheck } from "lucide-react";
import type {
  CreateEventTaskReassignmentInput,
  PrismCoordinatorAssignment,
  PrismCoordinatorRoleView,
} from "@prism/types";
import { canonicalCoordinatorRole } from "@prism/types";

import { Button } from "@prism/ui/components/button";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { label } from "@/features/pmcm-kit";
import {
  canCoordinatorUpdateTask,
  confirmedSupplierChecks,
  COORDINATOR_ATTENDANCE_CHOICES,
  delegatedAttendanceTargets,
  isCoordinatorAssignmentActive,
  isIngressOrEgressRole,
  nextSupplierSiteStep,
  requiresAttendanceConfirmation,
  taskAssignedRoleOptions,
  type CoordinatorAttendanceChoice,
} from "../../model/coordinators-desk-rules";
import { Card, CardContent, CardHeader } from "@prism/ui/components/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { FORM_ALERT, FORM_SUBMIT } from "./coordinator-view-primitives";

export type CoordinatorReassignmentModel = {
  busy: boolean;
  error: string | null;
  request: (taskId: string, input: CreateEventTaskReassignmentInput) => void;
};

export type CoordinatorTaskActionsModel = {
  busy: boolean;
  error: string | null;
  updateStatus: (taskId: string, status: string) => void;
  blockTask: (taskId: string, reason: string) => void;
  unblockTask: (taskId: string) => void;
};

export type CoordinatorOperatorActionsModel = {
  busy: boolean;
  error: string | null;
  supplierBusy: boolean;
  supplierError: string | null;
  updateAttendance: (assignmentId: string, status: string) => void;
  verifySupplier: (requestId: string, verificationStatus: "verified" | "disputed", note?: string) => void;
  reportSupplierStatus: (requestId: string, status: "arrived" | "set_up_ready" | "done_leaving", note?: string) => void;
};

type RoleViewTask = PrismCoordinatorRoleView["tasks"][number];
type SupplierStatus = PrismCoordinatorRoleView["supplierStatuses"][number];

/** Radix Select cannot take an empty-string item value, so "any coordinator" uses this sentinel. */
const ANY_OWNER_COORDINATOR = "__any_owner_coordinator__";
const SELECT_FIELD = "h-10 rounded-md border border-border bg-background px-2 text-sm text-foreground";
const FIELD_CAPTION = "grid gap-1 text-xs font-semibold text-muted-foreground";

export function CoordinatorRoleActions({ roleView, reassignment, operatorActions }: {
  roleView: PrismCoordinatorRoleView;
  reassignment: CoordinatorReassignmentModel;
  operatorActions: CoordinatorOperatorActionsModel;
}) {
  const operator = Boolean(roleView.isDesignatedOperator);
  return (
    <>
      {operator ? <CoordinatorOperatorControls roleView={roleView} reassignment={reassignment} operatorActions={operatorActions} /> : null}
      {operator ? <EventDayCopilotPanel eventId={roleView.event.id} /> : null}
      {operator || isIngressOrEgressRole(roleView.role) ? <CoordinatorSupplierChecks roleView={roleView} actions={operatorActions} /> : null}
    </>
  );
}

export function CoordinatorTaskQueue({ roleView, taskActions }: { roleView: PrismCoordinatorRoleView; taskActions: CoordinatorTaskActionsModel }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Assigned to you</h3>
          {roleView.tasks.length > 0 && (
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-3xs font-bold text-primary">{roleView.tasks.length}</span>
          )}
        </div>
      </CardHeader>
      <CardContent id="coordinator-role-queue" className="scroll-mt-24">
        {roleView.tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks assigned to you yet.</p>}
        <div className="space-y-2">
          {roleView.tasks.map((task) => (
            <CoordinatorTaskQueueRow key={task.id} task={task} taskActions={taskActions} canUpdate={canCoordinatorUpdateTask(task, roleView)} />
          ))}
        </div>
        {taskActions.error && <p role="alert" className={FORM_ALERT}>{taskActions.error}</p>}
      </CardContent>
    </Card>
  );
}

function CoordinatorTaskQueueRow({ task, taskActions, canUpdate }: { task: RoleViewTask; taskActions: CoordinatorTaskActionsModel; canUpdate: boolean }) {
  return (
    <div className="space-y-3 rounded-xl bg-muted/40 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">{task.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {task.assignedRole}{task.notes ? " — " + task.notes : ""}{task.slaDueAt ? " · Due " + formatPortalDateTime(task.slaDueAt) : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          {canUpdate ? (
            <Button type="button" size="sm" variant="outline" disabled={taskActions.busy || task.status === "blocked"} onClick={() => taskActions.updateStatus(task.id, nextCoordinatorTaskStatus(task.status))}>
              {coordinatorTaskActionLabel(task.status)}
            </Button>
          ) : null}
        </div>
      </div>
      {canUpdate ? <CoordinatorTaskBlocking task={task} taskActions={taskActions} /> : null}
    </div>
  );
}

function CoordinatorTaskBlocking({ task, taskActions }: { task: RoleViewTask; taskActions: CoordinatorTaskActionsModel }) {
  if (task.status === "blocked") return <CoordinatorBlockedNotice task={task} taskActions={taskActions} />;
  if (task.status === "done") return null;
  return <CoordinatorBlockForm task={task} taskActions={taskActions} />;
}

function CoordinatorBlockedNotice({ task, taskActions }: { task: RoleViewTask; taskActions: CoordinatorTaskActionsModel }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-danger">
        Blocker: {task.blockedReason}
        {task.blockedBy ? ` · Blocked by ${task.blockedBy}` : ""}
        {task.blockedAt ? ` · ${formatPortalDateTime(task.blockedAt)}` : ""}
      </p>
      <Button type="button" size="sm" variant="outline" disabled={taskActions.busy} onClick={() => taskActions.unblockTask(task.id)}>
        Unblock
      </Button>
    </div>
  );
}

function CoordinatorBlockForm({ task, taskActions }: { task: RoleViewTask; taskActions: CoordinatorTaskActionsModel }) {
  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState("");

  function confirmBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason.trim()) return;
    taskActions.blockTask(task.id, reason);
    setBlocking(false);
    setReason("");
  }

  if (!blocking) {
    return (
      <Button type="button" size="sm" variant="outline" disabled={taskActions.busy} onClick={() => setBlocking(true)}>
        Mark blocked
      </Button>
    );
  }
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={confirmBlock}>
      <label className="grid min-w-0 flex-1 gap-1 text-xs font-medium text-muted-foreground">
        Blocker reason
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          placeholder="What is stopping this task?"
          className="h-9 rounded-md border border-border bg-white px-3 text-sm font-normal text-foreground"
        />
      </label>
      <Button type="submit" size="sm" disabled={taskActions.busy || !reason.trim()}>Confirm blocked</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => { setBlocking(false); setReason(""); }}>Cancel</Button>
    </form>
  );
}

function nextCoordinatorTaskStatus(status: string) {
  if (status === "done") return "open";
  if (status === "in_progress") return "done";
  return "in_progress";
}

function coordinatorTaskActionLabel(status: string) {
  if (status === "done") return "Reopen";
  if (status === "in_progress") return "Mark done";
  return "Start";
}

function CoordinatorOperatorControls({ roleView, reassignment, operatorActions }: {
  roleView: PrismCoordinatorRoleView;
  reassignment: CoordinatorReassignmentModel;
  operatorActions: CoordinatorOperatorActionsModel;
}) {
  const pending = (roleView.taskReassignmentRequests ?? []).filter((request) => request.status === "pending");
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserCheck className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Operator controls</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          You are the designated Event Day System Operator. You may request task reassignment and mark attendance for other coordinators; PMCM approves reassignment decisions.
        </p>
        <p className="text-xs font-semibold text-muted-foreground">
          {pending.length} reassignment request{pending.length === 1 ? "" : "s"} awaiting PMCM review.
        </p>
        <ReassignmentRequestForm roleView={roleView} reassignment={reassignment} />
        {reassignment.error ? <p role="alert" className={FORM_ALERT}>{reassignment.error}</p> : null}
        <DelegatedAttendanceList roleView={roleView} operatorActions={operatorActions} />
        {operatorActions.error ? <p role="alert" className={FORM_ALERT}>{operatorActions.error}</p> : null}
      </CardContent>
    </Card>
  );
}

function ReassignmentRequestForm({ roleView, reassignment }: { roleView: PrismCoordinatorRoleView; reassignment: CoordinatorReassignmentModel }) {
  const [taskId, setTaskId] = useState("");
  const [toOwnerRole, setToOwnerRole] = useState("");
  const [toOwnerName, setToOwnerName] = useState("");
  const [reason, setReason] = useState("");
  const openTasks = roleView.tasks.filter((task) => task.status !== "done");
  // Picking the coordinator from the event's own roster keeps the name exactly as the API compares it.
  const owners = roleView.coordinatorAssignments.filter(
    (item) => isCoordinatorAssignmentActive(item) && (!toOwnerRole || item.role.toLowerCase() === toOwnerRole.toLowerCase()),
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const role = canonicalCoordinatorRole(toOwnerRole);
    if (!taskId || !role) return;
    reassignment.request(taskId, { toOwnerRole: role, toOwnerName: toOwnerName || undefined, reason });
    setReason("");
  }

  return (
    <form className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2" onSubmit={submit}>
      <label className={FIELD_CAPTION}>
        Task
        <Select required value={taskId} onValueChange={setTaskId}>
          <SelectTrigger aria-label="Task to reassign" className="w-full min-w-0">
            <SelectValue placeholder="Select task" />
          </SelectTrigger>
          <SelectContent>
            {openTasks.map((task) => <SelectItem key={task.id} value={task.id}><span className="truncate">{task.title}</span></SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      <label className={FIELD_CAPTION}>
        New owner role
        <Select required value={toOwnerRole} onValueChange={(role) => { setToOwnerRole(role); setToOwnerName(""); }}>
          <SelectTrigger aria-label="New owner role" className="w-full min-w-0">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {taskAssignedRoleOptions(roleView).map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      <label className={FIELD_CAPTION}>
        Coordinator (optional)
        <Select value={toOwnerName || ANY_OWNER_COORDINATOR} onValueChange={(name) => setToOwnerName(name === ANY_OWNER_COORDINATOR ? "" : name)}>
          <SelectTrigger aria-label="New owner coordinator" className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_OWNER_COORDINATOR}>Any coordinator in this role</SelectItem>
            {owners.map((item) => <SelectItem key={item.id} value={item.coordinatorName}>{item.coordinatorName} · {item.role}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      <label className={FIELD_CAPTION}>
        Reason
        <textarea aria-label="Reassignment reason" required value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground" />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={reassignment.busy || openTasks.length === 0}>Request reassignment</Button>
    </form>
  );
}

function DelegatedAttendanceList({ roleView, operatorActions }: { roleView: PrismCoordinatorRoleView; operatorActions: CoordinatorOperatorActionsModel }) {
  const [confirming, setConfirming] = useState<PrismCoordinatorAssignment | null>(null);
  const targets = delegatedAttendanceTargets(roleView.coordinatorAssignments, roleView.assignment.id);
  // A prompt opened for a coordinator who has since been replaced or released is dropped rather than acted on.
  const confirmingTarget = confirming ? targets.find((item) => item.id === confirming.id) : undefined;

  function mark(item: PrismCoordinatorAssignment, choice: CoordinatorAttendanceChoice) {
    if (requiresAttendanceConfirmation(choice)) setConfirming(item);
    else operatorActions.updateAttendance(item.id, choice);
  }

  function confirmAbsent() {
    if (!confirmingTarget) return;
    operatorActions.updateAttendance(confirmingTarget.id, "absent");
    setConfirming(null);
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-xs font-semibold text-muted-foreground">Delegated attendance</p>
      {targets.length === 0 ? <p className="text-sm text-muted-foreground">No other coordinators are working this event.</p> : null}
      {targets.map((item) => (
        <DelegatedAttendanceRow key={item.id} item={item} busy={operatorActions.busy} onMark={(choice) => mark(item, choice)} />
      ))}
      {confirmingTarget ? (
        <div className="rounded-md border border-danger/25 bg-danger/8 px-3 py-3">
          <p className="text-xs font-bold text-danger">
            Mark {confirmingTarget.coordinatorName} absent? This adds a permanent reliability note to their profile.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={operatorActions.busy} onClick={confirmAbsent} className={FORM_SUBMIT}>Confirm absent</button>
            <button type="button" onClick={() => setConfirming(null)} className="h-11 rounded-md border border-border px-3 text-sm font-bold">Keep as is</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DelegatedAttendanceRow({ item, busy, onMark }: { item: PrismCoordinatorAssignment; busy: boolean; onMark: (choice: CoordinatorAttendanceChoice) => void }) {
  const current = item.attendanceStatus ?? "pending";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
      <span className="text-sm">{item.coordinatorName} · {item.role} · {label(current)}</span>
      <div className="flex gap-2">
        {COORDINATOR_ATTENDANCE_CHOICES.map((choice) => (
          <Button key={choice.value} type="button" size="sm" variant="outline" disabled={busy || current === choice.value} onClick={() => onMark(choice.value)}>
            {choice.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function CoordinatorSupplierChecks({ roleView, actions }: { roleView: PrismCoordinatorRoleView; actions: CoordinatorOperatorActionsModel }) {
  const [note, setNote] = useState("");
  const suppliers = confirmedSupplierChecks(roleView.supplierStatuses);

  function check(supplier: SupplierStatus, status: "verified" | "disputed") {
    actions.verifySupplier(supplier.id, status, note);
    setNote("");
  }

  function report(supplier: SupplierStatus, status: "arrived" | "set_up_ready" | "done_leaving") {
    actions.reportSupplierStatus(supplier.id, status, note);
    setNote("");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Truck className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Supplier setup checks</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {suppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No confirmed suppliers to check yet.</p>
        ) : (
          <label className={FIELD_CAPTION}>
            Note for PMCM (optional)
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What you saw at the setup" className={SELECT_FIELD} />
          </label>
        )}
        {suppliers.map((supplier) => (
          <SupplierCheckRow key={supplier.id} supplier={supplier} busy={actions.supplierBusy} onCheck={(status) => check(supplier, status)} onReport={(status) => report(supplier, status)} />
        ))}
        {actions.supplierError ? <p role="alert" className={FORM_ALERT}>{actions.supplierError}</p> : null}
      </CardContent>
    </Card>
  );
}

function SupplierCheckRow({ supplier, busy, onCheck, onReport }: {
  supplier: SupplierStatus;
  busy: boolean;
  onCheck: (status: "verified" | "disputed") => void;
  onReport: (status: "arrived" | "set_up_ready" | "done_leaving") => void;
}) {
  const reported = label(supplier.eventDayStatus || supplier.readinessStatus || "no update");
  const next = nextSupplierSiteStep(supplier);
  const verification = label(supplier.verificationStatus ?? "self_reported");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-semibold">{supplier.supplierName} · {supplier.category}</p>
        <p className="text-xs text-muted-foreground">
          {reported} · verification {verification}{supplier.verifiedBy ? " by " + supplier.verifiedBy : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {next ? <Button type="button" size="sm" disabled={busy} onClick={() => onReport(next.status)}>Mark {next.label.toLowerCase()}</Button> : null}
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onCheck("verified")}>Verify setup</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onCheck("disputed")}>Dispute</Button>
      </div>
    </div>
  );
}
