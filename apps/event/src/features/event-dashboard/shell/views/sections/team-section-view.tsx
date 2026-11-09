"use client";

import { CoordinatorRoster } from "./coordinator-roster";
import { WorkspaceRouteTabs } from "./workspace-sub-tabs";
import { CoordinatorAssignmentDesk } from "@/features/coordinators/desk";
import { StaffInvitePanel } from "@/features/audit/trail/views/staff-invite-panel";
import { useAccountAdminViewModel } from "@/features/audit/trail/view-models/use-account-admin-view-model";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

/** Each team view has its own URL; the tab strip links between them. */
const TEAM_VIEW_TABS = [
  { id: "all", label: "All", href: "/dashboard/team" },
  { id: "roles", label: "Roles", href: "/dashboard/team/roles" },
  { id: "availability", label: "Availability", href: "/dashboard/team/availability" },
  { id: "assignments", label: "Assignments", href: "/dashboard/team/assignments" },
  { id: "workload", label: "Workload", href: "/dashboard/team/workload" },
  { id: "departments", label: "Departments", href: "/dashboard/team/departments" },
  { id: "archived", label: "Archived", href: "/dashboard/team/archived" },
];

const TEAM_VIEW_NOTES: Record<string, string> = {
  roles: "Role tags are shown on each coordinator below.",
  availability: "Availability is set per event. Open an event's coordinators to see and edit it.",
  assignments: "Assignments are made per event. Open an event's coordinators to assign roles.",
  workload: "Workload isn't tracked separately yet. Showing the full roster.",
  departments: "Departments aren't recorded yet. Showing the full roster.",
};

export function EventDashboardTeamSectionView() {
  const {
    selectedEvent,
    coordinators,
    reference,
    coordinatorRoleRequirements,
    busy,
    assignCoordinator,
    loadCoordinatorSuggestions,
    loadCoordinatorPoolAvailability,
    saveCoordinatorCoverage,
    sendCoordinatorAcknowledgementReminders,
    designateEventDayOperator,
    revokeEventDayOperator,
    loadEventDayOperator,
    loadCoordinatorAvailability,
    loadCoordinatorReliabilityHistory,
    createCoordinatorAvailability,
    deleteCoordinatorAvailability,
    navigateEvent,
    refresh,
    routeState,
  } = useEventDashboardLoadedRouteViewModel();
  const invitations = useAccountAdminViewModel({ onAccountsChanged: () => refresh() });
  const teamView = routeState.view ?? "all";
  const roster = teamView === "archived" ? coordinators.filter((coordinator) => !coordinator.active) : coordinators;
  const unbackedViewNote = TEAM_VIEW_NOTES[teamView];
  return (
    <div className="grid gap-5">
      <WorkspaceRouteTabs label="Team views" tabs={TEAM_VIEW_TABS} activeId={teamView} />
      <StaffInvitePanel vm={invitations} />
      {selectedEvent ? (
        <CoordinatorAssignmentDesk
          event={selectedEvent}
          coordinators={coordinators}
          assignments={reference.coordinatorAssignments}
          roleRequirements={coordinatorRoleRequirements}
          busy={Boolean(busy)}
          onAssign={assignCoordinator}
          onLoadSuggestions={loadCoordinatorSuggestions}
          onLoadPoolAvailability={loadCoordinatorPoolAvailability}
          onSaveCoverage={saveCoordinatorCoverage}
          onSendReminders={sendCoordinatorAcknowledgementReminders}
          onDesignateOperator={designateEventDayOperator}
          onRevokeOperator={revokeEventDayOperator}
          onLoadOperator={loadEventDayOperator}
          onLoadAvailability={loadCoordinatorAvailability}
          onLoadReliabilityHistory={loadCoordinatorReliabilityHistory}
          onCreateAvailability={createCoordinatorAvailability}
          onDeleteAvailability={deleteCoordinatorAvailability}
        />
      ) : (
        <CoordinatorRoster
          title={teamView === "archived" ? "Archived coordinators" : "Coordinator roster"}
          note={unbackedViewNote}
          archived={teamView === "archived"}
          coordinators={roster}
          assignments={reference.coordinatorAssignments}
          events={reference.events}
          onOpenEvent={(eventId) => navigateEvent(eventId, "coordinators")}
        />
      )}
    </div>
  );
}
