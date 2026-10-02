"use client";

import { ClipboardList, Home, BellRing, UserCheck, CalendarClock, ClipboardCheck } from "lucide-react";

import type { PrismAuthenticatedSession, PrismCoordinatorWorkspace } from "@prism/types";
import { PrismDashboardShell } from "@prism/ui";
import { label } from "@/features/pmcm-kit";
import { useCoordinatorViewModel } from "../view-models/use-coordinator-view-model";
import {
  COORDINATOR_NAV_SCROLL,
  coordinatorShellDescription,
  optionalNavBadge,
} from "../model/coordinator-view-copy";
import {
  CoordinatorBoundaryNotice,
  CoordinatorEventDayActions,
  CoordinatorGreetingBanner,
  CoordinatorStatusSummary,
  CoordinatorTimelineCard,
} from "./sections/coordinator-view-sections";
import {
  CoordinatorAssignmentHistory,
  CoordinatorRoleBadgeCard,
  CoordinatorRoleData,
} from "./sections/coordinator-role-sections";
import { CoordinatorEventSwitcher } from "./coordinator-event-switcher";
import { CoordinatorRegistrationDesk } from "@/features/coordinators/registration";

export function CoordinatorView({
  session,
  state,
  onRefresh,
  onSignOut,
}: {
  session: PrismAuthenticatedSession;
  state: PrismCoordinatorWorkspace;
  onRefresh: () => Promise<void>;
  onSignOut?: () => void;
}) {
  const vm = useCoordinatorViewModel({ session, state, onRefresh });
  const {
    activeDraft,
    activeSection,
    assignment,
    // PA-299: sourced from the view-model, which reads the attendance
    // vocabulary or the "pending" default. It must never fall back to
    // assignment.status, which is the acknowledgment vocabulary.
    attendanceStatus,
    busy,
    event,
    registrationRole,
    roleDataStatus,
    roleView,
    roleViewError,
    roleViewLoading,
  } = vm;

  const roleName = assignment?.role ?? label(session.role);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  function handleNav(id: string) {
    vm.selectSection(id);
    const target = COORDINATOR_NAV_SCROLL[id];
    if (target) scrollTo(target);
  }

  const navItems = [
    { id: "coord-home", icon: Home, label: "Home", section: "Coordinator" },
    { id: "coord-queue", icon: ClipboardList, label: "Role queue", section: "Coordinator", badge: optionalNavBadge(roleView?.tasks.length) },
    {
      id: "coord-issues",
      icon: BellRing,
      label: "Urgent issues",
      section: "Coordinator",
      badge: optionalNavBadge(roleView?.urgentIssues.filter((issue) => issue.status !== "resolved").length),
    },
    { id: "coord-attendance", icon: UserCheck, label: "Attendance", section: "Coordinator" },
    { id: "coord-timeline", icon: CalendarClock, label: "Timeline", section: "Coordinator" },
    ...(registrationRole ? [{ id: "coord-registration", icon: ClipboardCheck, label: "Registration", section: "Coordinator" }] : []),
  ];

  return (
    <PrismDashboardShell
      productLabel="P.R.I.S.M"
      roleLabel="Coordinator Portal"
      eyebrow="Event operations"
      title={event?.eventName ?? "No assigned event"}
      description={coordinatorShellDescription(event, roleName)}
      activeItemId={activeSection}
      navItems={navItems}
      onNavSelect={handleNav}
      user={{
        name: session.name,
        detail: label(session.role),
        initials: session.name.slice(0, 2).toUpperCase(),
      }}
      onSignOut={onSignOut}
      searchPlaceholder="Search tasks and issues..."
    >
      <div className="space-y-5">
        <CoordinatorGreetingBanner
          event={event}
          assignment={assignment}
          busy={busy}
          roleName={roleName}
          attendanceStatus={attendanceStatus}
          sessionName={session.name}
          onAcknowledge={vm.acknowledge}
          onDecline={vm.decline}
          onWithdraw={vm.withdraw}
        />
        <CoordinatorBoundaryNotice />
        <CoordinatorEventSwitcher
          events={state.events}
          assignments={vm.assignments}
          selectedEventId={event?.id}
          onSelect={vm.selectEvent}
        />
        <CoordinatorStatusSummary
          activeDraft={activeDraft}
          roleViewLoading={roleViewLoading}
          roleView={roleView}
          roleDataStatus={roleDataStatus}
          registrationRole={registrationRole}
          attendanceStatus={attendanceStatus}
          assignment={assignment}
        />
        <CoordinatorAssignmentHistory assignments={vm.assignments} />
        <CoordinatorEventDayActions
          assignment={assignment}
          busy={busy}
          roleViewLoading={roleViewLoading}
          roleViewError={roleViewError}
          roleView={roleView}
          attendanceStatus={attendanceStatus}
          onAcknowledge={vm.acknowledge}
          scrollTo={scrollTo}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <CoordinatorTimelineCard roleView={roleView} />
          <CoordinatorRoleBadgeCard
            assignment={assignment}
            busy={busy}
            roleName={roleName}
            attendanceStatus={attendanceStatus}
            onAcknowledge={vm.acknowledge}
            attendanceForm={vm.attendanceForm}
          />
        </div>
        <CoordinatorRoleData
          roleViewLoading={roleViewLoading}
          roleViewError={roleViewError}
          roleView={roleView}
          registrationRole={registrationRole}
          taskForm={vm.taskForm}
          issueForm={vm.issueForm}
          reassignment={vm.reassignment}
          taskActions={vm.taskActions}
          operatorActions={vm.operatorActions}
        />
        {registrationRole && event ? <CoordinatorRegistrationDesk key={event.id} eventId={event.id} /> : null}
      </div>
    </PrismDashboardShell>
  );
}
