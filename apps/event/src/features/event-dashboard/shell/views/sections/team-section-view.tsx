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
  { id: "archived", label: "Archived", href: "/dashboard/team/archived" },
];

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
  return (
    <div className="grid gap-5">
      <WorkspaceRouteTabs label="Team views" tabs={TEAM_VIEW_TABS} activeId={teamView} />
      <StaffInvitePanel vm={invitations} />
      {selectedEvent && teamView !== "archived" ? (
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
