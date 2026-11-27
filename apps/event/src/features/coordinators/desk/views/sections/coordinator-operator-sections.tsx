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
import { canonicalCoordinatorRole, coordinatorRoleLabel } from "@prism/types";

import { Button } from "@prism/ui/components/button";
import { PrismEmptyLine, PrismSection } from "@prism/ui/page-blocks";
import { CoordinatorEmpty } from "./coordinator-blocks";
import { label } from "@/features/pmcm-kit";
import { TASK_BLOCK_REASONS, TASK_GROUPS, groupTasks, taskDue, taskTone } from "../../model/coordinator-shift";
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
    </>
  );
}

/** The coordinator's tasks grouped by where they stand, each with the one next step it allows. */
export function CoordinatorTaskQueue({ roleView, taskActions }: { roleView: PrismCoordinatorRoleView; taskActions: CoordinatorTaskActionsModel }) {
  const groups = groupTasks(roleView.tasks);
  const shown = TASK_GROUPS.filter((group) => groups[group.id].length > 0);
  return (
    <div id="coordinator-role-queue" className="grid max-w-3xl lg:max-w-none scroll-mt-24 gap-4">
      {shown.length === 0 ? (
        <CoordinatorEmpty icon={ClipboardList} title="No tasks assigned to you yet">Tasks PMCM gives your role show up here.</CoordinatorEmpty>
      ) : null}
      {shown.map((group) => (
        <section key={group.id} aria-label={group.title} className="grid gap-1.5">
          <h2 className="px-1 text-xs font-semibold text-muted-foreground">{group.title} · {groups[group.id].length}</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {groups[group.id].map((task) => (
              <CoordinatorTaskQueueRow key={task.id} task={task} taskActions={taskActions} canUpdate={canCoordinatorUpdateTask(task, roleView)} />
            ))}
          </ul>
        </section>
      ))}
      {taskActions.error ? <p role="alert" className={FORM_ALERT}>{taskActions.error}</p> : null}
    </div>
  );
}

const TASK_BAR: Record<string, string> = { urgent: "border-l-danger", attention: "border-l-attention" };

function taskMeta(task: RoleViewTask): string {
  const due = taskDue(task);
  return [task.ownerName || coordinatorRoleLabel(task.assignedRole), due ? `Due ${formatPortalDateTime(due)}` : "No deadline", task.priority && task.priority !== "normal" ? `${label(task.priority)} priority` : null].filter(Boolean).join(" · ");
}

function CoordinatorTaskQueueRow({ task, taskActions, canUpdate }: { task: RoleViewTask; taskActions: CoordinatorTaskActionsModel; canUpdate: boolean }) {
  return <li className={`border-l-[3px] border-l-transparent px-4 py-3.5 sm:px-5 ${TASK_BAR[taskTone(task)] ?? ""}`}><CoordinatorTaskItem task={task} taskActions={taskActions} canUpdate={canUpdate} /></li>;
}

/**
 * One task with the one step it allows next, as a thumb-sized button. Blocking it takes one tap on a ready-made
 * reason ("Waiting on venue"); "Other" opens a text box for anything else.
 */
export function CoordinatorTaskItem({ task, taskActions, canUpdate }: { task: RoleViewTask; taskActions: CoordinatorTaskActionsModel; canUpdate: boolean }) {
  const [blocking, setBlocking] = useState(false);
  const done = task.status === "done";
  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2.5">
        <div className="min-w-0 flex-1 basis-56">
          <p className={done ? "text-sm font-semibold text-muted-foreground line-through" : "text-[15px] font-semibold text-foreground"}>{task.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{taskMeta(task)}</p>
          {task.notes ? <p className="mt-1 text-sm text-foreground">{task.notes}</p> : null}
          {task.status === "blocked" ? <CoordinatorBlockedNotice task={task} /> : null}
        </div>
        {canUpdate && !blocking ? <TaskRowActions task={task} taskActions={taskActions} onBlock={() => setBlocking(true)} /> : null}
      </div>
      {blocking ? <CoordinatorBlockForm task={task} taskActions={taskActions} onClose={() => setBlocking(false)} /> : null}
    </div>
  );
}

const TASK_ACTION = "min-h-11 flex-1 sm:flex-none";

/** The task's one next step, and Blocked while it can still be blocked. Full width on a phone. */
function TaskRowActions({ task, taskActions, onBlock }: { task: RoleViewTask; taskActions: CoordinatorTaskActionsModel; onBlock: () => void }) {
  const blocked = task.status === "blocked";
  return (
    <div className="flex w-full gap-2 sm:w-auto">
      {task.status !== "done" && !blocked ? (
        <Button type="button" variant="outline" className={TASK_ACTION} disabled={taskActions.busy} onClick={onBlock}>Blocked</Button>
      ) : null}
      {blocked ? (
        <Button type="button" variant="outline" className={TASK_ACTION} disabled={taskActions.busy} onClick={() => taskActions.unblockTask(task.id)}>Unblock</Button>
      ) : (
        <Button type="button" variant={task.status === "done" ? "outline" : "default"} className={TASK_ACTION} disabled={taskActions.busy} onClick={() => taskActions.updateStatus(task.id, nextCoordinatorTaskStatus(task.status))}>
          {coordinatorTaskActionLabel(task.status)}
        </Button>
      )}
    </div>
  );
}

function CoordinatorBlockedNotice({ task }: { task: RoleViewTask }) {
  return (
    <p className="mt-1 text-sm text-danger">
      {task.blockedReason || "Blocked"}
      <span className="text-xs text-muted-foreground">
        {task.blockedBy ? ` · ${task.blockedBy}` : ""}
        {task.blockedAt ? ` · ${formatPortalDateTime(task.blockedAt)}` : ""}
      </span>
    </p>
  );
}

function CoordinatorBlockForm({ task, taskActions, onClose }: { task: RoleViewTask; taskActions: CoordinatorTaskActionsModel; onClose: () => void }) {
  const [other, setOther] = useState(false);
  const [reason, setReason] = useState("");

  function block(text: string) {
    if (!text.trim()) return;
    taskActions.blockTask(task.id, text.trim());
    onClose();
  }
  function confirmOther(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    block(reason);
  }

  return (
    <div role="group" aria-label="Why is this task blocked?" className="grid gap-2 rounded-lg bg-muted/50 p-2.5">
      <p className="text-xs font-medium text-muted-foreground">What's stopping it?</p>
      <div className="flex flex-wrap gap-2">
        {TASK_BLOCK_REASONS.map((preset) => (
          <Button key={preset} type="button" size="sm" variant="outline" className="min-h-10" disabled={taskActions.busy} onClick={() => block(preset)}>{preset}</Button>
        ))}
        <Button type="button" size="sm" variant="ghost" className="min-h-10" aria-pressed={other} onClick={() => setOther((value) => !value)}>Other</Button>
        <Button type="button" size="sm" variant="ghost" className="min-h-10" onClick={onClose}>Cancel</Button>
      </div>
      {other ? (
        <form className="flex flex-wrap items-end gap-2" onSubmit={confirmOther}>
          <label className="grid min-w-0 flex-1 gap-1 text-xs font-medium text-muted-foreground">
            What is stopping this task?
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              autoFocus
              className="h-11 rounded-md border border-border bg-white px-3 text-sm font-normal text-foreground"
            />
          </label>
          <Button type="submit" className="min-h-11" disabled={taskActions.busy || !reason.trim()}>Confirm blocked</Button>
        </form>
      ) : null}
    </div>
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
          <h3 className="text-sm font-semibold text-foreground">Operator controls</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          You are the designated Onsite System Operator. You may request task reassignment and mark attendance for other coordinators; PMCM approves reassignment decisions.
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
            {/* Only the designated operator sees this form, and may route a task to any role. */}
            {taskAssignedRoleOptions(roleView, { canAssignAnyRole: true }).map((role) => <SelectItem key={role} value={role}>{coordinatorRoleLabel(role)}</SelectItem>)}
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
            {owners.map((item) => <SelectItem key={item.id} value={item.coordinatorName}>{item.coordinatorName} · {coordinatorRoleLabel(item.role)}</SelectItem>)}
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
          <p className="text-xs font-semibold text-danger">
            Mark {confirmingTarget.coordinatorName} absent? This adds a permanent reliability note to their profile.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={operatorActions.busy} onClick={confirmAbsent} className={FORM_SUBMIT}>Confirm absent</button>
            <button type="button" onClick={() => setConfirming(null)} className="h-11 rounded-md border border-border px-3 text-sm font-semibold">Keep as is</button>
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
      <span className="text-sm">{item.coordinatorName} · {coordinatorRoleLabel(item.role)} · {label(current)}</span>
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

/** The operator and the ingress and egress coordinators check suppliers in and out on site. */
export function canCheckSuppliers(roleView: Pick<PrismCoordinatorRoleView, "isDesignatedOperator" | "role">): boolean {
  return Boolean(roleView.isDesignatedOperator) || isIngressOrEgressRole(roleView.role);
}

/**
 * Suppliers on site: each confirmed supplier with its next on-site step as a full-width button, and Verify or Dispute
 * once it is set up. Suppliers PMCM has not confirmed are not checked in here.
 */
export function CoordinatorSupplierChecks({ roleView, actions }: { roleView: PrismCoordinatorRoleView; actions: CoordinatorOperatorActionsModel }) {
  const [note, setNote] = useState("");
  const suppliers = confirmedSupplierChecks(roleView.supplierStatuses);
  const arrived = suppliers.filter((supplier) => supplier.eventDayStatus).length;

  function check(supplier: SupplierStatus, status: "verified" | "disputed") {
    actions.verifySupplier(supplier.id, status, note);
    setNote("");
  }

  function report(supplier: SupplierStatus, status: "arrived" | "set_up_ready" | "done_leaving") {
    actions.reportSupplierStatus(supplier.id, status, note);
    setNote("");
  }

  return (
    <PrismSection id="coordinator-suppliers-on-site" title="Suppliers on site" description={suppliers.length ? `${arrived} of ${suppliers.length} checked in` : undefined} flush>
      {suppliers.length === 0 ? (
        <PrismEmptyLine icon={Truck} className="px-5 py-4">No confirmed suppliers to check in yet.</PrismEmptyLine>
      ) : (
        <div className="grid gap-3 px-4 pb-4 sm:px-5">
          <label className={FIELD_CAPTION}>
            Note for PMCM (optional)
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What you saw at the setup" className="h-11 rounded-md border border-border bg-background px-3 text-sm font-normal text-foreground" />
          </label>
          <ul className="grid gap-2">
            {suppliers.map((supplier) => (
              <SupplierCheckRow key={supplier.id} supplier={supplier} busy={actions.supplierBusy} onCheck={(status) => check(supplier, status)} onReport={(status) => report(supplier, status)} />
            ))}
          </ul>
        </div>
      )}
      {actions.supplierError ? <p role="alert" className={`mx-4 mb-4 sm:mx-5 ${FORM_ALERT}`}>{actions.supplierError}</p> : null}
    </PrismSection>
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
    <li className="grid gap-2.5 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[15px] font-semibold text-foreground">{supplier.supplierName}</p>
        <p className="text-xs text-muted-foreground">{reported}</p>
      </div>
      <p className="-mt-1.5 text-xs text-muted-foreground">{supplier.category} · verification {verification}{supplier.verifiedBy ? " by " + supplier.verifiedBy : ""}</p>
      {next ? <Button type="button" className="min-h-11 w-full" disabled={busy} onClick={() => onReport(next.status)}>Mark {next.label.toLowerCase()}</Button> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => onCheck("verified")}>Verify setup</Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => onCheck("disputed")}>Dispute</Button>
      </div>
    </li>
  );
}
