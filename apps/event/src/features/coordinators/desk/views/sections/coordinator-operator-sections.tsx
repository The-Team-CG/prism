"use client";

import { useState, type FormEvent } from "react";
import { ClipboardList, Truck, UserCheck } from "lucide-react";
import type {
  CreateEventTaskReassignmentInput,
  PrismCoordinatorAssignment,
  PrismCoordinatorRoleView,
} from "@prism/types";
import { canonicalCoordinatorRole } from "@prism/types";

import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { label } from "@/features/pmcm-kit";
import {
  canCoordinatorUpdateTask,
  confirmedSupplierChecks,
  COORDINATOR_ATTENDANCE_CHOICES,
  delegatedAttendanceTargets,
  isCoordinatorAssignmentActive,
  isIngressOrEgressRole,
  requiresAttendanceConfirmation,
  taskAssignedRoleOptions,
  type CoordinatorAttendanceChoice,
} from "../../model/coordinators-desk-rules";
import { CCard, CCardBody, CCardHeader, FORM_ALERT, FORM_SUBMIT } from "./coordinator-view-primitives";

export type CoordinatorReassignmentModel = {
  busy: boolean;
  error: string | null;
  request: (taskId: string, input: CreateEventTaskReassignmentInput) => void;
};

export type CoordinatorTaskActionsModel = {
  busy: boolean;
  error: string | null;
  updateStatus: (taskId: string, status: string) => void;
};

export type CoordinatorOperatorActionsModel = {
  busy: boolean;
  error: string | null;
  supplierBusy: boolean;
  supplierError: string | null;
  updateAttendance: (assignmentId: string, status: string) => void;
  verifySupplier: (requestId: string, verificationStatus: "verified" | "disputed", note?: string) => void;
};

type RoleViewTask = PrismCoordinatorRoleView["tasks"][number];
type SupplierStatus = PrismCoordinatorRoleView["supplierStatuses"][number];

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
      {operator || isIngressOrEgressRole(roleView.role) ? <CoordinatorSupplierChecks roleView={roleView} actions={operatorActions} /> : null}
    </>
  );
}

export function CoordinatorTaskQueue({ roleView, taskActions }: { roleView: PrismCoordinatorRoleView; taskActions: CoordinatorTaskActionsModel }) {
  return (
    <CCard>
      <CCardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Role queue</h3>
          {roleView.tasks.length > 0 && (
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-3xs font-bold text-primary">{roleView.tasks.length}</span>
          )}
        </div>
      </CCardHeader>
      <CCardBody id="coordinator-role-queue" className="scroll-mt-24">
        {roleView.tasks.length === 0 && <p className="text-sm text-muted-foreground">No event-day tasks assigned to this role yet.</p>}
        <div className="space-y-2">
          {roleView.tasks.map((task) => (
            <CoordinatorTaskQueueRow key={task.id} task={task} taskActions={taskActions} canUpdate={canCoordinatorUpdateTask(task, roleView)} />
          ))}
        </div>
        {taskActions.error && <p role="alert" className={FORM_ALERT}>{taskActions.error}</p>}
      </CCardBody>
    </CCard>
  );
}

function CoordinatorTaskQueueRow({ task, taskActions, canUpdate }: { task: RoleViewTask; taskActions: CoordinatorTaskActionsModel; canUpdate: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-3.5">
      <div>
        <p className="text-sm font-bold text-foreground">{task.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {task.assignedRole}{task.notes ? " — " + task.notes : ""}{task.slaDueAt ? " · Due " + new Date(task.slaDueAt).toLocaleString("en-PH") : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={task.status} />
        {canUpdate ? (
          <Button type="button" size="sm" variant="outline" disabled={taskActions.busy || task.status === "blocked"} onClick={() => taskActions.updateStatus(task.id, nextCoordinatorTaskStatus(task.status))}>
            {coordinatorTaskActionLabel(task.status)}
          </Button>
        ) : null}
      </div>
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
    <CCard>
      <CCardHeader>
        <div className="flex items-center gap-2">
          <UserCheck className="size-4 text-primary" />
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
        <ReassignmentRequestForm roleView={roleView} reassignment={reassignment} />
        {reassignment.error ? <p role="alert" className={FORM_ALERT}>{reassignment.error}</p> : null}
        <DelegatedAttendanceList roleView={roleView} operatorActions={operatorActions} />
        {operatorActions.error ? <p role="alert" className={FORM_ALERT}>{operatorActions.error}</p> : null}
      </CCardBody>
    </CCard>
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
        <select aria-label="Task to reassign" required value={taskId} onChange={(event) => setTaskId(event.target.value)} className={SELECT_FIELD}>
          <option value="">Select task</option>
          {openTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
        </select>
      </label>
      <label className={FIELD_CAPTION}>
        New owner role
        <select aria-label="New owner role" required value={toOwnerRole} onChange={(event) => { setToOwnerRole(event.target.value); setToOwnerName(""); }} className={SELECT_FIELD}>
          <option value="">Select role</option>
          {taskAssignedRoleOptions(roleView).map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
      </label>
      <label className={FIELD_CAPTION}>
        Coordinator (optional)
        <select aria-label="New owner coordinator" value={toOwnerName} onChange={(event) => setToOwnerName(event.target.value)} className={SELECT_FIELD}>
          <option value="">Any coordinator in this role</option>
          {owners.map((item) => <option key={item.id} value={item.coordinatorName}>{item.coordinatorName} · {item.role}</option>)}
        </select>
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

  return (
    <CCard>
      <CCardHeader>
        <div className="flex items-center gap-2">
          <Truck className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Supplier setup checks</h3>
        </div>
      </CCardHeader>
      <CCardBody className="space-y-2">
        {suppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No confirmed suppliers to check yet.</p>
        ) : (
          <label className={FIELD_CAPTION}>
            Note for PMCM (optional)
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What you saw at the setup" className={SELECT_FIELD} />
          </label>
        )}
        {suppliers.map((supplier) => (
          <SupplierCheckRow key={supplier.id} supplier={supplier} busy={actions.supplierBusy} onCheck={(status) => check(supplier, status)} />
        ))}
        {actions.supplierError ? <p role="alert" className={FORM_ALERT}>{actions.supplierError}</p> : null}
      </CCardBody>
    </CCard>
  );
}

function SupplierCheckRow({ supplier, busy, onCheck }: { supplier: SupplierStatus; busy: boolean; onCheck: (status: "verified" | "disputed") => void }) {
  const reported = label(supplier.eventDayStatus || supplier.readinessStatus || "no update");
  const verification = label(supplier.verificationStatus ?? "self_reported");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-semibold">{supplier.supplierName} · {supplier.category}</p>
        <p className="text-xs text-muted-foreground">
          {reported} · verification {verification}{supplier.verifiedBy ? " by " + supplier.verifiedBy : ""}
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onCheck("verified")}>Verify setup</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onCheck("disputed")}>Dispute</Button>
      </div>
    </div>
  );
}
