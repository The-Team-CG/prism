"use client";

import type { ReactNode } from "react";
import { ClientBillingTab } from "../../billing";
import { ClientBriefingTab } from "../../briefing";
import { ClientDocumentsTab } from "../../documents";
import { ClientProposalTab } from "../../proposal";
import { ClientActionGroup } from "../../shared/client-action-group";
import { useClientWorkspace, type ClientWorkspaceValue } from "../../workspace/shared";
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
import { ClientApprovalsView } from "../../approvals";
import { ClientCloseoutView } from "../../closeout/views/client-closeout-view";
import type { ClientDashboardRoute } from "../../workspace/shared";

const OCULAR_VISIT_DONE = new Set(["completed", "waived"]);

function renderOverview(ctx: ClientWorkspaceValue) {
  const { selectedEvent, officialDraft } = ctx;
  if (!selectedEvent) return null;
  // The site visit comes before the official floorplan, so the request stays on the overview until it is done.
  const visitOpen = !ctx.ocularVisit || !OCULAR_VISIT_DONE.has(ctx.ocularVisit.status);
  return (
    <div className="space-y-4">
      {visitOpen ? <ClientOcularVisitPanel visit={ctx.ocularVisit} busy={ctx.busy === "ocular-visit"} onSubmit={ctx.submitOcularVisit} /> : null}
      <ClientOverviewTab
        selectedEvent={selectedEvent}
        briefing={ctx.briefing}
        payments={ctx.payments}
        billing={ctx.billing}
        documents={ctx.documents}
        audit={ctx.audit}
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
  const needsAction = ctx.clientActions.filter((a) => a.tone === "primary" || a.tone === "warning");
  const waiting = ctx.clientActions.filter((a) => a.tone === "neutral");
  const completed = ctx.clientActions.filter((a) => a.tone === "success");
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <ClientActionGroup
        title="Needs your action"
        description="Client decisions that can move planning forward."
        actions={needsAction}
        onAction={ctx.runClientAction}
      />
      <ClientActionGroup
        title="Waiting on PMCM"
        description="Being prepared or reviewed by the event team."
        actions={waiting}
        onAction={ctx.runClientAction}
      />
      <ClientActionGroup
        title="Completed"
        description="Finished client-visible workflow items."
        actions={completed}
        onAction={ctx.runClientAction}
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
      <ClientActionGroup
        title="Change requests"
        description="Client-visible revision and change items for this event."
        actions={ctx.clientActions}
        onAction={ctx.runClientAction}
      />
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
      briefing={ctx.briefing}
      busy={ctx.busy === "briefing"}
      onSubmit={ctx.submitBriefing}
    />
  ) : null,
  proposal: renderProposal,
  approvals: () => <ClientApprovalsView />,
  floorplan: () => <ClientFloorPlanView />,
  documents: (ctx) => <ClientDocumentsTab documents={ctx.documents} />,
  billing: (ctx) => <ClientBillingTab eventId={ctx.selectedEvent?.id} eventName={ctx.selectedEvent?.eventName} payments={ctx.payments} billing={ctx.billing} disputes={ctx.disputes} />,
  messages: () => <ClientMessagesView />,
  changes: renderChanges,
  summary: (ctx) => <div className="space-y-4"><ClientFinalSummaryView />{ctx.selectedEvent ? <ClientCloseoutView key={ctx.selectedEvent.id} eventId={ctx.selectedEvent.id} archived={ctx.selectedEvent.archived} /> : null}</div>,
};

export function ClientEventRouteBody() {
  const ctx = useClientWorkspace();
  const render = EVENT_ROUTE_RENDERERS[ctx.route];
  if (!render) return null;
  return render(ctx);
}
