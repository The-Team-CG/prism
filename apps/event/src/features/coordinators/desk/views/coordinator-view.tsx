"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import { BellRing, CalendarClock, ClipboardCheck, ClipboardList, Home, Radio, UsersRound } from "lucide-react";
import type { PrismAuthenticatedSession, PrismCoordinatorWorkspace } from "@prism/types";
import { PrismDashboardShell } from "@prism/ui";
import { Button } from "@/app/components/ui/button";
import { roleLabel } from "@/features/pmcm-kit";
import { CoordinatorRegistrationDesk } from "@/features/coordinators/registration";
import { optionalNavBadge } from "../model/coordinator-view-copy";
import { buildCoordinatorCommandActions, buildCoordinatorRecordGroups } from "../model/coordinator-command-index";
import {
  COORDINATOR_HOME_PATH,
  COORDINATOR_VIEW_LABELS,
  OUTSIDE_PORTAL_NOTICE,
  coordinatorLocationRedirect,
  coordinatorViewFromParam,
  coordinatorViewSearch,
  isCoordinatorHomePath,
  type CoordinatorViewId,
} from "../model/coordinator-portal-routes";
import { useCoordinatorViewModel } from "../view-models/use-coordinator-view-model";
import { CoordinatorEventSwitcher } from "./coordinator-event-switcher";
import {
  CoordinatorBoundaryNotice,
  CoordinatorEventDayActions,
  CoordinatorGreetingBanner,
  CoordinatorStatusSummary,
  CoordinatorTimelineCard,
} from "./sections/coordinator-view-sections";
import { CoordinatorAssignmentHistory, CoordinatorRoleBadgeCard, CoordinatorRoleData } from "./sections/coordinator-role-sections";

type CoordinatorVm = ReturnType<typeof useCoordinatorViewModel>;
type NavigateTo = (view: CoordinatorViewId) => void;

/** App-relative href for a sidebar item, so the shell can render it as a real link. */
function viewHref(view: CoordinatorViewId, eventId?: string | null): string {
  return `${COORDINATOR_HOME_PATH}${coordinatorViewSearch(view, eventId)}`;
}

function CoordinatorRoleSection({ vm, section }: { vm: CoordinatorVm; section: "tasks" | "issues" }) {
  return (
    <CoordinatorRoleData
      section={section}
      roleViewLoading={vm.roleViewLoading}
      roleViewError={vm.roleViewError}
      roleView={vm.roleView}
      registrationRole={vm.registrationRole && !vm.readOnly}
      taskForm={vm.taskForm}
      issueForm={vm.issueForm}
      reassignment={vm.reassignment}
      taskActions={vm.taskActions}
      operatorActions={vm.operatorActions}
    />
  );
}

/** Primary issue entry point. It sits in the top bar on every view, so reporting takes one step from anywhere. */
function ReportIssueButton({ onReport }: { onReport: () => void }) {
  return (
    <Button type="button" onClick={onReport} className="min-h-11 rounded-md font-semibold">
      <Radio className="size-4" aria-hidden="true" /> Report an issue
    </Button>
  );
}

function CoordinatorShift({ vm, roleName, onNavigate }: {
  vm: CoordinatorVm;
  roleName: string;
  onNavigate: NavigateTo;
}) {
  const nextTask = [...(vm.roleView?.tasks ?? [])]
    .filter((task) => !["done", "cancelled", "closed"].includes(task.status))
    .sort((left, right) => (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999"))[0];
  return (
    <div className="space-y-5">
      <div>
        <ReportIssueButton onReport={() => onNavigate("issues")} />
      </div>
      {nextTask && !vm.roleViewError ? (
        <section className="rounded-lg bg-primary-soft p-5" aria-label="Next task for your role">
          <p className="text-sm font-medium text-primary">Next task for your role</p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">{nextTask.title}</h2>
          {nextTask.notes ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{nextTask.notes}</p> : null}
          <p className="mt-3 text-sm text-muted-foreground">
            Owner: {nextTask.ownerName || nextTask.assignedRole} · {nextTask.dueAt ? `Due ${formatPortalDateTime(nextTask.dueAt)}` : "No deadline set"}
          </p>
          <button type="button" onClick={() => onNavigate("tasks")} className="mt-3 min-h-11 rounded-md px-1 text-sm font-semibold text-primary focus-visible:ring-2 focus-visible:ring-primary">
            Open task queue
          </button>
        </section>
      ) : null}
      <CoordinatorEventDayActions
        roleViewLoading={vm.roleViewLoading}
        roleViewError={vm.roleViewError}
        roleView={vm.roleView}
        onNavigate={onNavigate}
      />
      <CoordinatorRoleBadgeCard
        assignment={vm.assignment}
        busy={vm.busy}
        roleName={roleName}
        attendanceStatus={vm.attendanceStatus}
        onAcknowledge={vm.acknowledge}
        attendanceForm={vm.attendanceForm}
      />
      <CoordinatorStatusSummary
        activeDraft={vm.activeDraft}
        roleViewLoading={vm.roleViewLoading}
        roleView={vm.roleView}
        roleDataStatus={vm.roleDataStatus}
        registrationRole={vm.registrationRole && !vm.readOnly}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function CoordinatorRegistrationSection({ vm }: { vm: CoordinatorVm }) {
  if (!vm.event || !vm.registrationRole || vm.readOnly) {
    return <p role="status" className="text-sm text-muted-foreground">Registration is available to the assigned registration coordinator.</p>;
  }
  return <CoordinatorRegistrationDesk key={vm.event.id} eventId={vm.event.id} guestAttendanceCount={vm.roleView?.guestAttendanceCount} onAttendanceChange={vm.refreshRoleView} />;
}

function CoordinatorViewContent({ vm, view, sessionName, roleName, onNavigate }: {
  vm: CoordinatorVm;
  view: CoordinatorViewId;
  sessionName: string;
  roleName: string;
  onNavigate: NavigateTo;
}) {
  if (!vm.event) return <p role="status" className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">{vm.selectedEventId ? "That event is not available to this account. Choose an assigned event." : "Choose an assigned event to see your work."}</p>;
  switch (view) {
    case "shift": return <CoordinatorShift vm={vm} roleName={roleName} onNavigate={onNavigate} />;
    case "tasks": return <CoordinatorRoleSection vm={vm} section="tasks" />;
    case "issues": return <CoordinatorRoleSection vm={vm} section="issues" />;
    case "run-sheet": return <CoordinatorTimelineCard roleView={vm.roleView} readOnly={vm.readOnly} onCheckAgain={() => void vm.refreshRoleView()} />;
    case "assignments": return (
      <div className="space-y-5">
        <CoordinatorGreetingBanner event={vm.event} assignment={vm.assignment} busy={vm.busy} roleName={roleName} attendanceStatus={vm.attendanceStatus} sessionName={sessionName} onAcknowledge={vm.acknowledge} onDecline={vm.decline} onWithdraw={vm.withdraw} />
        <CoordinatorAssignmentHistory assignments={vm.assignments} />
        <CoordinatorBoundaryNotice />
      </div>
    );
    case "registration": return <CoordinatorRegistrationSection vm={vm} />;
  }
}

export function CoordinatorView({ session, state, onRefresh, onSignOut }: {
  session: PrismAuthenticatedSession;
  state: PrismCoordinatorWorkspace;
  onRefresh: () => Promise<void>;
  onSignOut?: () => void;
}) {
  const vm = useCoordinatorViewModel({ session, state, onRefresh });
  const pathname = usePathname() ?? COORDINATOR_HOME_PATH;
  const router = useRouter();
  const [activeView, setActiveView] = useState<CoordinatorViewId>("shift");
  const [outsideNotice, setOutsideNotice] = useState(false);
  const selectEventRef = useRef(vm.selectEvent);
  useEffect(() => { selectEventRef.current = vm.selectEvent; });
  useEffect(() => {
    // A PMCM or unknown path leaves the coordinator portal: send the coordinator home instead of rendering a page
    // for the wrong URL. Legacy section ids are rewritten in place, so old links keep their event and view.
    const redirect = coordinatorLocationRedirect({ pathname, search: window.location.search });
    if (redirect && !isCoordinatorHomePath(pathname)) {
      router.replace(`${COORDINATOR_HOME_PATH}${redirect.search}`);
      return;
    }
    if (redirect) window.history.replaceState(null, "", `${window.location.pathname}${redirect.search}`);
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveView(coordinatorViewFromParam(params.get("view")));
      setOutsideNotice(params.get("notice") === OUTSIDE_PORTAL_NOTICE);
      selectEventRef.current(params.get("event"));
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [pathname, router]);

  const roleName = vm.assignment?.role ?? roleLabel(session.role);
  const navItems = [
    { id: "shift", icon: Home, label: COORDINATOR_VIEW_LABELS.shift, section: "Coordinator", href: viewHref("shift", vm.event?.id) },
    { id: "tasks", icon: ClipboardList, label: COORDINATOR_VIEW_LABELS.tasks, section: "Coordinator", badge: optionalNavBadge(vm.roleView?.tasks.length), href: viewHref("tasks", vm.event?.id) },
    { id: "issues", icon: BellRing, label: COORDINATOR_VIEW_LABELS.issues, section: "Coordinator", badge: optionalNavBadge(vm.roleView?.urgentIssues.filter((issue) => issue.status !== "resolved").length), href: viewHref("issues", vm.event?.id) },
    { id: "run-sheet", icon: CalendarClock, label: COORDINATOR_VIEW_LABELS["run-sheet"], section: "Coordinator", href: viewHref("run-sheet", vm.event?.id) },
    { id: "assignments", icon: UsersRound, label: COORDINATOR_VIEW_LABELS.assignments, section: "Coordinator", href: viewHref("assignments", vm.event?.id) },
    ...(vm.registrationRole && !vm.readOnly ? [{ id: "registration", icon: ClipboardCheck, label: COORDINATOR_VIEW_LABELS.registration, section: "Coordinator", href: viewHref("registration", vm.event?.id) }] : []),
  ];

  function navigateTo(view: CoordinatorViewId, eventId = vm.event?.id) {
    setActiveView(view);
    window.history.pushState(null, "", `${window.location.pathname}${coordinatorViewSearch(view, eventId)}`);
  }
  function handleEvent(eventId: string) {
    vm.selectEvent(eventId);
    navigateTo(activeView, eventId);
  }
  useEffect(() => {
    document.title = `${COORDINATOR_VIEW_LABELS[activeView]} · P.R.I.S.M`;
  }, [activeView]);

  function dismissOutsideNotice() {
    setOutsideNotice(false);
    window.history.replaceState(null, "", `${window.location.pathname}${coordinatorViewSearch(activeView, vm.event?.id)}`);
  }

  return (
    <PrismDashboardShell
      portal="event"
      productLabel="P.R.I.S.M"
      roleLabel="Coordinator Portal"
      eyebrow="Event operations"
      title={COORDINATOR_VIEW_LABELS[activeView]}
      description={vm.event ? `${vm.event.eventName} · ${formatPortalDate(vm.event.eventDate)} · ${roleName}` : "Choose an assigned event to get started."}
      activeItemId={activeView}
      navItems={navItems}
      onNavSelect={(id) => navigateTo(coordinatorViewFromParam(id))}
      headerActions={<ReportIssueButton onReport={() => navigateTo("issues")} />}
      alwaysShowHeaderActions
      user={{ name: session.name, detail: roleLabel(session.role), initials: session.name.slice(0, 2).toUpperCase() }}
      onSignOut={onSignOut}
      searchPlaceholder="Search tasks and issues..."
      commandSectionLabel="Actions"
      commandActions={buildCoordinatorCommandActions(
        { canMark: vm.attendanceForm.canMark, hasAssignment: vm.attendanceForm.hasAssignment, windowOpen: vm.attendanceForm.windowOpen },
        navigateTo,
      )}
      commandGroups={buildCoordinatorRecordGroups({ tasks: vm.roleView?.tasks ?? [], issues: vm.roleView?.urgentIssues ?? [] }, navigateTo)}
      sidebarContext={<CoordinatorEventSwitcher events={state.events} assignments={vm.assignments} selectedEventId={vm.event?.id} onSelect={handleEvent} />}
    >
      <div className="space-y-5">
        {outsideNotice ? (
          <div role="status" className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <span>{"That page isn't part of the coordinator portal."}</span>
            <button type="button" onClick={dismissOutsideNotice} className="min-h-11 shrink-0 px-2 font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-primary">
              Dismiss
            </button>
          </div>
        ) : null}
        {vm.readOnly ? <p role="status" className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">Archived event: operational records are read-only.</p> : null}
        <fieldset disabled={vm.readOnly && activeView !== "run-sheet"} className="min-w-0">
          <CoordinatorViewContent vm={vm} view={activeView} sessionName={session.name} roleName={roleName} onNavigate={navigateTo} />
        </fieldset>
      </div>
    </PrismDashboardShell>
  );
}
