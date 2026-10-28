"use client";

import { useState } from "react";

import {
  BadgeCheck,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  LayoutGrid,
  LockKeyhole,
  ShieldCheck,
  Truck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { label } from "@/features/pmcm-kit";
import {
  coordinatorAssignmentDetail,
  coordinatorGreetingCopy,
  coordinatorIssueActionCopy,
  coordinatorTaskActionCopy,
} from "../../model/coordinator-view-copy";
import type { PrismCoordinatorRoleView } from "@prism/types";
import { LiveOpsControlSurface, LiveOpsScheduleDesk } from "@/features/live-ops/schedule";
import { HandoffBriefPanel } from "@/features/live-ops/handoff-brief";
import { CCard, CCardBody, CCardHeader } from "./coordinator-view-primitives";
import type {
  CoordinatorAttendanceFormModel,
  CoordinatorIssueFormModel,
  CoordinatorTaskFormModel,
} from "./coordinator-role-sections";
import type {
  CoordinatorOperatorActionsModel,
  CoordinatorReassignmentModel,
  CoordinatorTaskActionsModel,
} from "./coordinator-operator-sections";

export type {
  CoordinatorOperatorActionsModel,
  CoordinatorReassignmentModel,
  CoordinatorTaskActionsModel,
};

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
          <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-black text-foreground">
            <span className="min-w-0 truncate">{item.value}</span>
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

function SectionAccent({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-primary">{children}</p>;
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
  taskActions: CoordinatorTaskActionsModel;
  operatorActions: CoordinatorOperatorActionsModel;
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

  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-tight text-foreground">{greeting.title}</h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{greeting.description}</p>
        <CoordinatorAssignmentActions status={assignment?.status} busy={busy} onAcknowledge={onAcknowledge} onDecline={onDecline} onWithdraw={onWithdraw} />
      </div>
      {assignment ? (
        <dl className="shrink-0 text-sm sm:text-right">
          <dt className="text-muted-foreground">Your role</dt>
          <dd className="font-semibold text-foreground">{roleName}</dd>
          <dd className="text-muted-foreground">{label(attendanceStatus)}</dd>
        </dl>
      ) : null}
    </header>
  );
}

/** Acknowledged shows a confirmation; an open assignment shows Acknowledge, Decline (until declined) and Withdraw. */
function CoordinatorAssignmentActions({
  status,
  busy,
  onAcknowledge,
  onDecline,
  onWithdraw,
}: {
  status?: string;
  busy: boolean;
  onAcknowledge: () => void;
  onDecline: (reason?: string) => void;
  onWithdraw: () => void;
}) {
  if (!status) return null;
  if (status === "acknowledged") {
    return (
      <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-success">
        <CheckCircle2 className="size-4" aria-hidden="true" /> Role acknowledged
      </p>
    );
  }
  const open = status !== "declined";
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {open ? (
        <Button className="h-11 rounded-md font-semibold" onClick={() => onAcknowledge()} disabled={busy}>
          <BadgeCheck className="size-4" aria-hidden="true" /> Acknowledge role
        </Button>
      ) : null}
      {open ? (
        <Button variant="outline" className="h-11 rounded-md" onClick={() => onDecline(window.prompt("Why are you declining this assignment?")?.trim())} disabled={busy}>
          Decline
        </Button>
      ) : null}
      <Button variant="ghost" className="h-11 rounded-md" onClick={onWithdraw} disabled={busy}>
        Withdraw
      </Button>
    </div>
  );
}

export function CoordinatorBoundaryNotice() {
  return (
    <CCard>
      <CCardBody className="flex items-start gap-3">
        <LockKeyhole className="mt-0.5 size-5 shrink-0 text-attention" />
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
          value: roleViewLoading ? "Loading" : !roleView || roleDataStatus === "unavailable" ? "Unavailable" : `${roleView.supplierStatuses.length} supplier updates`,
          icon: Truck,
          status: roleDataStatus,
          detail: "Reported preparation and onsite updates.",
        },
        {
          id: "attendance",
          label: "Guest attendance",
          value: roleViewLoading ? "Loading" : !roleView || roleDataStatus === "unavailable" ? "Unavailable" : roleView.guestAttendanceCount,
          icon: UsersRound,
          status: roleDataStatus,
          detail: registrationRole ? "Open Registration to review check-ins." : "Recorded event attendance count.",
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
  roleViewLoading,
  roleViewError,
  roleView,
  scrollTo,
}: Pick<
  CoordinatorWorkspaceModel,
  "roleViewLoading" | "roleViewError" | "roleView" | "scrollTo"
>) {
  const taskCopy = coordinatorTaskActionCopy(roleViewLoading, roleViewError, roleView?.tasks.filter((task) => !["done", "cancelled", "closed"].includes(task.status)).length ?? 0);
  const issueCopy = coordinatorIssueActionCopy(roleViewLoading, roleViewError, roleView?.urgentIssues.filter((issue) => !["resolved", "cancelled", "closed"].includes(issue.status)).length ?? 0);

  return (
    <CCard>
      <CCardHeader>
        <h2 className="text-base font-bold text-foreground">What needs attention</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review your tasks, issues and attendance for this event.
        </p>
      </CCardHeader>
      <CCardBody>
        <EventDayActionGroup
          actions={[
            {
              id: "queue",
              label: "Review tasks",
              description: taskCopy.description,
              icon: ClipboardList,
              status: taskCopy.status,
              onSelect: () => scrollTo("coordinator-role-queue"),
            },
            {
              id: "issues",
              label: "Review or report an issue",
              description: issueCopy.description,
              icon: BellRing,
              status: issueCopy.status,
              onSelect: () => scrollTo("coordinator-live-data"),
            },
          ]}
        />
      </CCardBody>
    </CCard>
  );
}

export function CoordinatorTimelineCard({ roleView, readOnly = false }: { roleView: PrismCoordinatorRoleView | null; readOnly?: boolean }) {
  const [view, setView] = useState<"run-sheet" | "brief" | "reports">("run-sheet");
  return (
    <CCard>
      <CCardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Run sheet and shift records</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Follow the live timeline, review your handoff brief or record shift reports.</p>
        <div role="group" aria-label="Run sheet views" className="mt-4 flex flex-wrap gap-2">
          {([
            { id: "run-sheet", label: "Live run sheet" },
            { id: "brief", label: "Handoff brief" },
            { id: "reports", label: "Schedule and reports" },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={view === item.id}
              onClick={() => setView(item.id)}
              className={view === item.id
                ? "min-h-11 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring"
                : "min-h-11 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"}
            >
              {item.label}
            </button>
          ))}
        </div>
      </CCardHeader>
      <CCardBody id="coordinator-timeline" className="scroll-mt-24 space-y-3">
        <fieldset disabled={readOnly} hidden={view !== "run-sheet"} className="min-w-0">{roleView?.schedule ? <LiveOpsControlSurface eventId={roleView.event.id} schedule={roleView.schedule} timer={roleView.timer} /> : (
          <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">No event schedule has been published yet. Check with PMCM for the latest timing.</p>
        )}</fieldset>
        {roleView ? <fieldset disabled={readOnly} hidden={view !== "brief"} className="min-w-0"><HandoffBriefPanel eventId={roleView.event.id} defaultOpen /></fieldset> : null}
        {roleView ? <fieldset disabled={readOnly} hidden={view !== "reports"} className="min-w-0">
          <LiveOpsScheduleDesk
            eventId={roleView.event.id}
            assignments={roleView.coordinatorAssignments}
            canManageSchedule={Boolean(roleView.isDesignatedOperator)}
            canReplyToReports={false}
            canSubmitReports
          />
        </fieldset> : null}
      </CCardBody>
    </CCard>
  );
}
