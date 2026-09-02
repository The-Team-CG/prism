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
import { ClientProgressView } from "./client-progress-view";
import { ClientScheduleView } from "./client-schedule-view";
import { ClientGuestsView } from "./client-guests-view";
import { ClientPreferencesView } from "./client-preferences-view";
import { ClientFloorPlanView } from "./client-floorplan-view";
import { ClientFinalSummaryView } from "./client-final-summary-view";
import { ClientMessagesView } from "../../messages";
import { ClientApprovalsView } from "../../approvals";
import type { ClientDashboardRoute } from "../../workspace/shared";

function renderOverview(ctx: ClientWorkspaceValue) {
  const { selectedEvent, officialDraft } = ctx;
  if (!selectedEvent) return null;
  return (
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
    <ClientProposalTab
      selectedEvent={ctx.selectedEvent}
      briefing={ctx.briefing}
      billing={ctx.billing}
      payments={ctx.payments}
      officialDraft={ctx.officialDraft}
      setTab={(next) => ctx.navigateToEventRoute(next)}
    />
  );
}

function renderChanges(ctx: ClientWorkspaceValue) {
  return (
    <ClientActionGroup
      title="Change requests"
      description="Client-visible revision and change items for this event."
      actions={ctx.clientActions}
      onAction={ctx.runClientAction}
    />
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
  briefing: (ctx) => <ClientBriefingTab briefing={ctx.briefing} />,
  proposal: renderProposal,
  approvals: () => <ClientApprovalsView />,
  floorplan: () => <ClientFloorPlanView />,
  documents: (ctx) => <ClientDocumentsTab documents={ctx.documents} />,
  billing: (ctx) => <ClientBillingTab payments={ctx.payments} billing={ctx.billing} />,
  messages: () => <ClientMessagesView />,
  changes: renderChanges,
  summary: () => <ClientFinalSummaryView />,
};

export function ClientEventRouteBody() {
  const ctx = useClientWorkspace();
  const render = EVENT_ROUTE_RENDERERS[ctx.route];
  if (!render) return null;
  return render(ctx);
}
