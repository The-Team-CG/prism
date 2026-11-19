"use client";

import { isEventModuleEnabled } from "@prism/types";
import type { ReactNode } from "react";
import { ClientBillingTab } from "../../billing";
import { ClientBriefingTab } from "../../briefing";
import { ClientDocumentsTab } from "../../documents";
import { ClientProposalTab } from "../../proposal";
import { manilaDateKey } from "@prism/ui/format-date";
import { ClientActionLists } from "../../shared/client-action-lists";
import { ClientChangeDeadlineNotice } from "../../shared/client-change-deadline-notice";
import { dashboardHref, useClientWorkspace, type ClientWorkspaceValue } from "../../workspace/shared";
import { ClientRouteTabs } from "../../shared/client-route-tabs";
import { ClientOverviewTab } from "./client-overview-tab";
import { ClientEventDetailsView } from "./client-event-details-view";
import { ClientOcularVisitPanel } from "./client-ocular-visit-panel";
import { ClientProgressView } from "./client-progress-view";
import { ClientScheduleView } from "./client-schedule-view";
import { ClientGuestsView } from "./client-guests-view";
import { ClientPreferencesView } from "./client-preferences-view";
import { ClientFloorPlanView } from "./client-floorplan-view";
import { ClientFinalSummaryView } from "./client-final-summary-view";
import { ClientMessagesView } from "../../messages";
import { ClientCloseoutView } from "../../closeout/views/client-closeout-view";
import { ClientChangeRequestsPanel } from "../../change-requests";
import type { ClientDashboardRoute } from "../../workspace/shared";

const OCULAR_VISIT_DONE = new Set(["completed", "waived"]);

function renderOverview(ctx: ClientWorkspaceValue) {
  const { selectedEvent, officialDraft } = ctx;
  if (!selectedEvent) return null;
  // The site visit comes before the official floorplan: the request form leads until it is asked for, then the
  // visit is a Coming up line until it is done.
  const visitOpen = !ctx.ocularVisit || !OCULAR_VISIT_DONE.has(ctx.ocularVisit.status);
  const visitAsked = ctx.ocularVisit?.status === "requested" || ctx.ocularVisit?.status === "scheduled";
  return (
    <div className="space-y-4">
      <ClientOverviewTab
        ocularVisit={ctx.ocularVisit}
        afterLead={visitOpen && !visitAsked ? <ClientOcularVisitPanel visit={ctx.ocularVisit} busy={ctx.busy === "ocular-visit"} onSubmit={ctx.submitOcularVisit} /> : null}
        selectedEvent={selectedEvent}
        briefing={ctx.briefing}
        payments={ctx.payments}
        billing={ctx.billing}
        documents={ctx.documents}
        officialDraft={officialDraft}
        preferenceDraftCount={ctx.preferenceDrafts.length}
        onOpenOfficialFloorplan={
          officialDraft
            ? () => ctx.openFloorplanEditor(officialDraft, officialDraft.status === "approved")
            : undefined
        }
        setTab={(next) => ctx.navigateToEventRoute(next)}
      />
    </div>
  );
}

function renderActions(ctx: ClientWorkspaceValue) {
  const event = ctx.selectedEvent;
  if (!event) return null;
  return (
    <div className="space-y-4">
      <ClientChangeDeadlineNotice event={event} todayKey={manilaDateKey()} />
      <ClientActionLists
        actions={ctx.clientActions}
        onAction={ctx.runClientAction}
        todayKey={manilaDateKey()}
        scope="event"
        emptyAction={event.archived ? undefined : { label: "Request a change", href: dashboardHref("changes", event.id) }}
      />
    </div>
  );
}

function renderProposal(ctx: ClientWorkspaceValue) {
  if (!ctx.selectedEvent) return null;
  return (
    <ClientProposalTab setTab={(next) => ctx.navigateToEventRoute(next)} />
  );
}

function renderChanges(ctx: ClientWorkspaceValue) {
  return (
    <div className="space-y-4">
      {ctx.selectedEvent ? (
        <ClientOcularVisitPanel
          visit={ctx.ocularVisit}
          busy={ctx.busy === "ocular-visit"}
          onSubmit={ctx.submitOcularVisit}
        />
      ) : null}
      {ctx.selectedEvent ? <ClientChangeRequestsPanel key={ctx.selectedEvent.id} eventId={ctx.selectedEvent.id} /> : null}
    </div>
  );
}

const EVENT_ROUTE_RENDERERS: Partial<Record<ClientDashboardRoute, (ctx: ClientWorkspaceValue) => ReactNode>> = {
  overview: renderOverview,
  details: () => <ClientEventDetailsView />,
  progress: () => <ClientProgressView />,
  schedule: () => <ClientScheduleView />,
  guests: () => <ClientGuestsView />,
  preferences: () => <ClientPreferencesView />,
  actions: renderActions,
  briefing: (ctx) => ctx.selectedEvent ? (
    <ClientBriefingTab
      eventId={ctx.selectedEvent.id}
      ownSuppliersEnabled={isEventModuleEnabled(ctx.selectedEvent, "client_owned_suppliers")}
      briefing={ctx.briefing}
      busy={ctx.busy === "briefing"}
      onSubmit={ctx.submitBriefing}
    />
  ) : null,
  proposal: renderProposal,
  floorplan: () => <ClientFloorPlanView />,
  documents: () => <ClientDocumentsTab />,
  billing: (ctx) => <ClientBillingTab eventId={ctx.selectedEvent?.id} eventName={ctx.selectedEvent?.eventName} payments={ctx.payments} billing={ctx.billing} disputes={ctx.disputes} />,
  messages: () => <ClientMessagesView />,
  changes: renderChanges,
  summary: (ctx) => <div className="space-y-4"><ClientFinalSummaryView />{ctx.selectedEvent ? <ClientCloseoutView key={ctx.selectedEvent.id} eventId={ctx.selectedEvent.id} archived={ctx.selectedEvent.archived} /> : null}</div>,
};

/** Planning is one sidebar item with five views; the tabs are the way between them. */
const PLANNING_TABS: Array<{ route: ClientDashboardRoute; label: string }> = [
  { route: "progress", label: "Progress" },
  { route: "actions", label: "Actions" },
  { route: "details", label: "Details" },
  { route: "changes", label: "Changes" },
];

export function ClientEventRouteBody() {
  const ctx = useClientWorkspace();
  const render = EVENT_ROUTE_RENDERERS[ctx.route];
  if (!render) return null;
  const { selectedEvent } = ctx;
  const planningRoute = PLANNING_TABS.some((tab) => tab.route === ctx.route);
  if (!planningRoute || !selectedEvent) return render(ctx);
  return (
    <div className="space-y-4">
      <ClientRouteTabs
        label="Planning views"
        activeId={ctx.route}
        tabs={PLANNING_TABS.map((tab) => ({ id: tab.route, label: tab.label, href: dashboardHref(tab.route, selectedEvent.id) }))}
      />
      {render(ctx)}
    </div>
  );
}
