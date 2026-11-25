"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { isPmcmAdmin } from "@/app/lib/role-guards";
import { EventSettingsWorkspace } from "./event-settings-workspace";
import { EventModulesControl } from "@/features/event-settings/modules/views/event-modules-control";
import { useResource } from "@prism/portal-query";
import { ComplianceRulesSettings, complianceRuleCatalog } from "@/features/compliance/rules";
import { PlanningTemplatesSettings } from "@/features/planning/templates";
import { CanvaConnectionCard } from "@/features/event-settings/canva/views/canva-connection-card";
import { AccountAdminPanel } from "@/features/audit/trail/views/account-admin-panel";
import { useAccountAdminViewModel } from "@/features/audit/trail/view-models/use-account-admin-view-model";
import { cx, useListFilter } from "@/features/pmcm-kit";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

type SettingsTab = "rules" | "templates" | "people" | "integrations" | "event";

/**
 * PMCM's settings as tabs, each one subject: the rules every event is checked against, reusable templates, who can
 * sign in and how, integrations, and (with an event open) that event's own controls. Notification settings live on
 * the shared Notifications page. "Signed in as" and "Default workspace" are gone: Account already says who you are,
 * and nothing read the default workspace.
 */
export function EventDashboardSettingsSectionView() {
  const {
    session,
    selectedEvent,
    reference,
    refresh,
    toggleClientEventDayView,
    setEventPrivacy,
    setEventModules,
    complianceRules,
    createComplianceRule,
    updateComplianceRule,
    busy,
  } = useEventDashboardLoadedRouteViewModel();
  const accounts = useAccountAdminViewModel({ onAccountsChanged: () => refresh() });
  const admin = isPmcmAdmin(session.role);
  const tabs = settingsTabs(admin, selectedEvent?.eventName);
  const [requested, setTab] = useListFilter("tab", tabs[0]?.id ?? "event");
  const tab = tabs.some((entry) => entry.id === requested) ? (requested as SettingsTab) : tabs[0]?.id;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Settings" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              aria-controls={`settings-panel-${entry.id}`}
              onClick={() => setTab(entry.id)}
              className={cx("max-w-56 truncate rounded-md px-3 py-1.5 text-sm transition-colors", tab === entry.id ? "bg-card font-medium text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <Link href="/dashboard/notifications#notification-settings" className="text-sm font-medium text-primary hover:underline">Notification settings</Link>
      </div>
      <section id={`settings-panel-${tab}`} role="tabpanel" className="space-y-5">
        {tab === "rules" ? <EventRulesPanel rules={complianceRules} busy={Boolean(busy)} onCreateRule={createComplianceRule} onUpdateRule={updateComplianceRule} /> : null}
        {tab === "templates" ? <PlanningTemplatesSettings /> : null}
        {tab === "people" ? <AccountAdminPanel users={reference.users} viewerRole={session.role} vm={accounts} /> : null}
        {tab === "integrations" ? <CanvaConnectionCard /> : null}
        {tab === "event" && selectedEvent ? (
          <>
            <EventSettingsWorkspace
              session={session}
              selectedEvent={selectedEvent}
              onToggleClientEventDayView={toggleClientEventDayView}
              onSetEventPrivacy={setEventPrivacy}
            />
            {admin ? <EventModulesControl selectedEvent={selectedEvent} onSave={setEventModules} /> : null}
          </>
        ) : null}
      </section>
    </div>
  );
}

/** Admins see the organisation-wide tabs; anyone with an event open also sees that event's own controls. */
function settingsTabs(admin: boolean, eventName: string | undefined): Array<{ id: SettingsTab; label: string }> {
  const tabs: Array<{ id: SettingsTab; label: string }> = admin
    ? [
        { id: "rules", label: "Event rules" },
        { id: "templates", label: "Templates" },
        { id: "people", label: "People and access" },
        { id: "integrations", label: "Integrations" },
      ]
    : [];
  return eventName ? [...tabs, { id: "event", label: eventName }] : tabs;
}

/** Custom rules beside the built-in checks; the built-in catalog loads only while this tab is open. */
function EventRulesPanel(props: Omit<ComponentProps<typeof ComplianceRulesSettings>, "catalog">) {
  const catalog = useResource(complianceRuleCatalog, "signed-in").data;
  return <ComplianceRulesSettings {...props} catalog={catalog} />;
}
