"use client";

import { isPmcmAdmin } from "@/app/lib/role-guards";
import { EventSettingsWorkspace } from "./event-settings-workspace";
import { ComplianceRulesSettings } from "@/features/compliance/rules";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

export function EventDashboardSettingsSectionView() {
  const {
    session,
    selectedEvent,
    toggleClientEventDayView,
    complianceRules,
    createComplianceRule,
    busy,
  } = useEventDashboardLoadedRouteViewModel();
  return (
    <div className="space-y-5">
      <EventSettingsWorkspace
        session={session}
        selectedEvent={selectedEvent}
        onToggleClientEventDayView={toggleClientEventDayView}
      />
      {isPmcmAdmin(session.role) ? (
        <ComplianceRulesSettings rules={complianceRules} busy={Boolean(busy)} onCreateRule={createComplianceRule} />
      ) : null}
    </div>
  );
}
