"use client";

import { isPmcmAdmin } from "@/app/lib/role-guards";
import { EventSettingsWorkspace } from "./event-settings-workspace";
import { EventModulesControl } from "@/features/event-settings/modules/views/event-modules-control";
import { ComplianceRulesSettings } from "@/features/compliance/rules";
import { PlanningTemplatesSettings } from "@/features/planning/templates";
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
      <nav aria-label="Settings sections" className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <a href="#workspace-settings" className="hover:text-foreground">Workspace</a>
        {isPmcmAdmin(session.role) ? <><a href="#event-controls" className="hover:text-foreground">Event controls</a><a href="#compliance-settings" className="hover:text-foreground">Compliance</a><a href="#planning-settings" className="hover:text-foreground">Planning templates</a><a href="#integrations-settings" className="hover:text-foreground">Integrations</a></> : null}
        <a href="#notification-settings" className="hover:text-foreground">Notifications</a>
      </nav>
      <section id="workspace-settings" className="scroll-mt-6"><EventSettingsWorkspace
        session={session}
        selectedEvent={selectedEvent}
        onToggleClientEventDayView={toggleClientEventDayView}
        onSetEventPrivacy={setEventPrivacy}
      /></section>
      {isPmcmAdmin(session.role) ? <section id="event-controls" className="scroll-mt-6"><EventModulesControl selectedEvent={selectedEvent} onSave={setEventModules} /></section> : null}
      {isPmcmAdmin(session.role) ? (
        <section id="compliance-settings" className="scroll-mt-6"><ComplianceRulesSettings rules={complianceRules} busy={Boolean(busy)} onCreateRule={createComplianceRule} /></section>
      ) : null}
      {isPmcmAdmin(session.role) ? <section id="planning-settings" className="scroll-mt-6"><PlanningTemplatesSettings /></section> : null}
      {isPmcmAdmin(session.role) ? <section id="integrations-settings" className="scroll-mt-6"><CanvaConnectionCard /></section> : null}
      <section id="notification-settings" className="scroll-mt-6"><AccountNotificationsView /></section>
    </div>
  );
}
