"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardList, Home, BellRing, CalendarClock, ClipboardCheck, UsersRound } from "lucide-react";
import type { PrismAuthenticatedSession, PrismCoordinatorWorkspace } from "@prism/types";
import { PrismDashboardShell } from "@prism/ui";
import { label } from "@/features/pmcm-kit";
import { CoordinatorRegistrationDesk } from "@/features/coordinators/registration";
import { optionalNavBadge } from "../model/coordinator-view-copy";
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

const SECTION_LABELS = {
  "coord-home": "My shift",
  "coord-queue": "My tasks",
  "coord-issues": "Issues",
  "coord-timeline": "Run sheet",
  "coord-assignments": "Assignments",
  "coord-registration": "Registration",
} as const;
type CoordinatorSection = keyof typeof SECTION_LABELS;
type CoordinatorVm = ReturnType<typeof useCoordinatorViewModel>;

function coordinatorSection(value: string | null): CoordinatorSection {
  return value && Object.hasOwn(SECTION_LABELS, value) ? value as CoordinatorSection : "coord-home";
}

function navigateCoordinator(section: CoordinatorSection, eventId?: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("section", section);
  if (eventId) url.searchParams.set("event", eventId);
  window.history.pushState(null, "", url);
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

function CoordinatorShift({ vm, roleName, onNavigate }: {
  vm: CoordinatorVm;
  roleName: string;
  onNavigate: (section: CoordinatorSection) => void;
}) {
  return (
    <div className="space-y-5">
      <CoordinatorEventDayActions
        assignment={vm.assignment}
        busy={vm.busy}
        roleViewLoading={vm.roleViewLoading}
        roleViewError={vm.roleViewError}
        roleView={vm.roleView}
        attendanceStatus={vm.attendanceStatus}
        onAcknowledge={vm.acknowledge}
        scrollTo={(id) => {
          if (id === "coordinator-attendance") document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
          else onNavigate(id === "coordinator-role-queue" ? "coord-queue" : "coord-issues");
        }}
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
        attendanceStatus={vm.attendanceStatus}
        assignment={vm.assignment}
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

function CoordinatorSectionView({ vm, section, sessionName, roleName, onNavigate }: {
  vm: CoordinatorVm;
  section: CoordinatorSection;
  sessionName: string;
  roleName: string;
  onNavigate: (section: CoordinatorSection) => void;
}) {
  if (!vm.event) return <p role="status" className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">{vm.selectedEventId ? "That event is not available to this account. Choose an assigned event." : "Choose an assigned event to see your work."}</p>;
  switch (section) {
    case "coord-home": return <CoordinatorShift vm={vm} roleName={roleName} onNavigate={onNavigate} />;
    case "coord-queue": return <CoordinatorRoleSection vm={vm} section="tasks" />;
    case "coord-issues": return <CoordinatorRoleSection vm={vm} section="issues" />;
    case "coord-timeline": return <CoordinatorTimelineCard roleView={vm.roleView} />;
    case "coord-assignments": return (
      <div className="space-y-5">
        <CoordinatorGreetingBanner event={vm.event} assignment={vm.assignment} busy={vm.busy} roleName={roleName} attendanceStatus={vm.attendanceStatus} sessionName={sessionName} onAcknowledge={vm.acknowledge} onDecline={vm.decline} onWithdraw={vm.withdraw} />
        <CoordinatorAssignmentHistory assignments={vm.assignments} />
        <CoordinatorBoundaryNotice />
      </div>
    );
    case "coord-registration": return <CoordinatorRegistrationSection vm={vm} />;
  }
}

export function CoordinatorView({ session, state, onRefresh, onSignOut }: {
  session: PrismAuthenticatedSession;
  state: PrismCoordinatorWorkspace;
  onRefresh: () => Promise<void>;
  onSignOut?: () => void;
}) {
  const vm = useCoordinatorViewModel({ session, state, onRefresh });
  const [activeSection, setActiveSection] = useState<CoordinatorSection>("coord-home");
  const selectEventRef = useRef(vm.selectEvent);
  useEffect(() => { selectEventRef.current = vm.selectEvent; });
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveSection(coordinatorSection(params.get("section")));
      selectEventRef.current(params.get("event"));
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const roleName = vm.assignment?.role ?? label(session.role);
  const navItems = [
    { id: "coord-home", icon: Home, label: SECTION_LABELS["coord-home"], section: "Coordinator" },
    { id: "coord-queue", icon: ClipboardList, label: SECTION_LABELS["coord-queue"], section: "Coordinator", badge: optionalNavBadge(vm.roleView?.tasks.length) },
    { id: "coord-issues", icon: BellRing, label: SECTION_LABELS["coord-issues"], section: "Coordinator", badge: optionalNavBadge(vm.roleView?.urgentIssues.filter((issue) => issue.status !== "resolved").length) },
    { id: "coord-timeline", icon: CalendarClock, label: SECTION_LABELS["coord-timeline"], section: "Coordinator" },
    { id: "coord-assignments", icon: UsersRound, label: SECTION_LABELS["coord-assignments"], section: "Coordinator" },
    ...(vm.registrationRole && !vm.readOnly ? [{ id: "coord-registration", icon: ClipboardCheck, label: SECTION_LABELS["coord-registration"], section: "Coordinator" }] : []),
  ];
  function handleNav(id: string) {
    const section = coordinatorSection(id);
    setActiveSection(section);
    navigateCoordinator(section, vm.event?.id);
  }
  function handleEvent(eventId: string) {
    vm.selectEvent(eventId);
    navigateCoordinator(activeSection, eventId);
  }

  return (
    <PrismDashboardShell
      portal="event"
      productLabel="P.R.I.S.M"
      roleLabel="Coordinator Portal"
      eyebrow="Event operations"
      title={SECTION_LABELS[activeSection]}
      description={vm.event ? `${vm.event.eventName} · ${vm.event.eventDate} · ${roleName}` : "Choose an assigned event to get started."}
      activeItemId={activeSection}
      navItems={navItems}
      onNavSelect={handleNav}
      user={{ name: session.name, detail: label(session.role), initials: session.name.slice(0, 2).toUpperCase() }}
      onSignOut={onSignOut}
      searchPlaceholder="Search tasks and issues..."
    >
      <div className="space-y-5">
        <CoordinatorEventSwitcher events={state.events} assignments={vm.assignments} selectedEventId={vm.event?.id} onSelect={handleEvent} />
        {vm.readOnly ? <p role="status" className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">Archived event: operational records are read-only.</p> : null}
        <fieldset disabled={vm.readOnly} className="min-w-0">
          <CoordinatorSectionView vm={vm} section={activeSection} sessionName={session.name} roleName={roleName} onNavigate={handleNav} />
        </fieldset>
      </div>
    </PrismDashboardShell>
  );
}
