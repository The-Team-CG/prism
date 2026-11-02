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
  Truck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { label } from "@/features/pmcm-kit";
import {
  coordinatorAttendanceSummary,
  coordinatorGreetingCopy,
  coordinatorIssueActionCopy,
  coordinatorTaskActionCopy,
} from "../../model/coordinator-view-copy";
import { recordedAttendanceLabel } from "../../model/coordinators-desk-rules";
import type { PrismCoordinatorRoleView } from "@prism/types";
import { LiveOpsControlSurface, LiveOpsScheduleDesk } from "@/features/live-ops/schedule";
import { HandoffBriefPanel } from "@/features/live-ops/handoff-brief";
import { CCard, CCardBody, CCardHeader } from "./coordinator-view-primitives";
import type {
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
  /** Opens the view that holds the detail behind this figure. Omitted when no view does. */
  onSelect?: () => void;
};

function StatusSummary({ items }: { items: StatusSummaryItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <StatusSummaryCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function StatusSummaryCard({ item }: { item: StatusSummaryItem }) {
  const Icon = item.icon;
  const body = (
    <div className="flex items-start gap-3">
      {Icon ? (
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
        <div className="mt-1 text-sm font-black text-foreground">{item.value}</div>
        {item.detail ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p> : null}
      </div>
    </div>
  );
  if (!item.onSelect) {
    return <div className="rounded-lg border border-border bg-background/80 p-3.5">{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={item.onSelect}
      className="rounded-lg border border-border bg-background/80 p-3.5 text-left transition hover:border-primary/30 hover:bg-secondary/35 focus-visible:ring-2 focus-visible:ring-primary"
    >
      {body}
    </button>
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
  return <p className="text-sm text-muted-foreground">{children}</p>;
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
          <dd className="text-muted-foreground">{coordinatorAttendanceSummary(attendanceStatus, recordedAttendanceLabel(attendanceStatus) ?? label(attendanceStatus))}</dd>
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

/** Each figure opens the view that holds its detail. The attendance mark lives on My shift, so it is not repeated here. */
export function CoordinatorStatusSummary({
  activeDraft,
  roleViewLoading,
  roleView,
  roleDataStatus,
  registrationRole,
  onNavigate,
}: Pick<
  CoordinatorWorkspaceModel,
  "activeDraft" | "roleViewLoading" | "roleView" | "roleDataStatus" | "registrationRole"
> & { onNavigate: (view: CoordinatorStatusView) => void }) {
  const checkIns = roleView?.guestAttendanceCount ?? 0;
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
          onSelect: () => onNavigate("tasks"),
        },
        {
          id: "check-ins",
          label: "Check-ins",
          value: roleViewLoading ? "Loading" : !roleView || roleDataStatus === "unavailable" ? "Unavailable" : checkIns ? `${checkIns} checked in` : "No check-ins recorded",
          icon: UsersRound,
          status: roleDataStatus,
          detail: registrationRole ? "Open Registration to review check-ins." : "Guest check-ins for this event.",
          onSelect: () => onNavigate(registrationRole ? "registration" : "issues"),
        },
      ]}
    />
  );
}

type CoordinatorStatusView = "tasks" | "issues" | "registration";

export function CoordinatorEventDayActions({
  roleViewLoading,
  roleViewError,
  roleView,
  onNavigate,
}: Pick<
  CoordinatorWorkspaceModel,
  "roleViewLoading" | "roleViewError" | "roleView"
> & { onNavigate: (view: CoordinatorStatusView) => void }) {
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
              onSelect: () => onNavigate("tasks"),
            },
            {
              id: "issues",
              label: "Review or report an issue",
              description: issueCopy.description,
              icon: BellRing,
              status: issueCopy.status,
              onSelect: () => onNavigate("issues"),
            },
          ]}
        />
      </CCardBody>
    </CCard>
  );
}

function RunSheetNotPublished({ onCheckAgain }: { onCheckAgain?: () => void }) {
  return (
    <div className="rounded-xl bg-muted/40 p-4">
      <p className="text-sm font-semibold text-foreground">PMCM hasn&apos;t published the run sheet for this event yet.</p>
      {onCheckAgain ? (
        <Button variant="outline" className="mt-3 min-h-11 rounded-md" onClick={onCheckAgain}>
          Check again
        </Button>
      ) : null}
    </div>
  );
}

export function CoordinatorTimelineCard({ roleView, readOnly = false, onCheckAgain }: {
  roleView: PrismCoordinatorRoleView | null;
  readOnly?: boolean;
  onCheckAgain?: () => void;
}) {
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
        <fieldset disabled={readOnly} hidden={view !== "run-sheet"} className="min-w-0">{roleView?.schedule?.authored ? <LiveOpsControlSurface eventId={roleView.event.id} schedule={roleView.schedule} timer={roleView.timer} /> : roleView ? <RunSheetNotPublished onCheckAgain={onCheckAgain} /> : (
          <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">Loading the run sheet.</p>
        )}</fieldset>
        {roleView ? <fieldset disabled={readOnly} hidden={view !== "brief"} className="min-w-0"><HandoffBriefPanel eventId={roleView.event.id} defaultOpen /></fieldset> : null}
        {roleView ? <fieldset disabled={readOnly} hidden={view !== "reports"} className="min-w-0">
          <LiveOpsScheduleDesk
            eventId={roleView.event.id}
            assignments={roleView.coordinatorAssignments}
            canManageSchedule={Boolean(roleView.isDesignatedOperator)}
            canReplyToReports={false}
            canSubmitReports
            coordinatorScope
          />
        </fieldset> : null}
      </CCardBody>
    </CCard>
  );
}
