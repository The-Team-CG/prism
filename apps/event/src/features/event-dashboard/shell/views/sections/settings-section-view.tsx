"use client";

import { isPmcmAdmin } from "@/app/lib/role-guards";
import { EventSettingsWorkspace } from "./event-settings-workspace";
import { EventModulesControl } from "@/features/event-settings/modules/views/event-modules-control";
import { ComplianceRulesSettings } from "@/features/compliance/rules";
import { PlanningTemplatesSettings } from "@/features/planning/templates";
import { portalHref } from "@prism/ui/portal-path";
import { SegmentedAnchorNav } from "@/features/pmcm-kit";
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
      <SegmentedAnchorNav
        label="Settings sections"
        items={[
          { id: "workspace-settings", label: "Workspace", href: "#workspace-settings" },
          ...(isPmcmAdmin(session.role)
            ? [
                { id: "event-controls", label: "Event controls", href: "#event-controls" },
                { id: "compliance-settings", label: "Compliance", href: "#compliance-settings" },
                { id: "planning-settings", label: "Planning templates", href: "#planning-settings" },
                { id: "integrations-settings", label: "Integrations", href: "#integrations-settings" },
              ]
            : []),
          {
            id: "notification-settings",
            label: "Notification settings",
            href: portalHref("/dashboard/notifications#notification-settings"),
          },
        ]}
      />
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
    </div>
  );
}
