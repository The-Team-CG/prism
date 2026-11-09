"use client";

import { isPmcmAdmin } from "@/app/lib/role-guards";
import { EventSettingsWorkspace } from "./event-settings-workspace";
import { EventModulesControl } from "@/features/event-settings/modules/views/event-modules-control";
import { ComplianceRulesSettings } from "@/features/compliance/rules";
import { AccountNotificationsView } from "@/features/account-notifications/views/account-notifications-view";
import { CanvaConnectionCard } from "@/features/event-settings/canva/views/canva-connection-card";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

export function EventDashboardSettingsSectionView() {
  const {
    session,
    selectedEvent,
    toggleClientEventDayView,
    setEventPrivacy,
    setEventModules,
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
        onSetEventPrivacy={setEventPrivacy}
      />
      {isPmcmAdmin(session.role) ? <EventModulesControl selectedEvent={selectedEvent} onSave={setEventModules} /> : null}
      {isPmcmAdmin(session.role) ? (
        <ComplianceRulesSettings rules={complianceRules} busy={Boolean(busy)} onCreateRule={createComplianceRule} />
      ) : null}
      {isPmcmAdmin(session.role) ? <CanvaConnectionCard /> : null}
      <AccountNotificationsView />
    </div>
  );
}
