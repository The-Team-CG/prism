"use client";

import { LockKeyhole } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { ClientBillingTab } from "../../billing";
import { ClientBriefingTab } from "../../briefing";
import { ClientDocumentsTab } from "../../documents";
import { ClientProposalTab } from "../../proposal";
import { ClientActionGroup } from "../../shared/client-action-group";
import { useClientWorkspace } from "../../workspace/shared";
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

export function ClientEventWorkspaceView() {
  const {
    route,
    selectedEvent,
    officialDraft,
    preferenceDrafts,
    audit,
    billing,
    briefing,
    documents,
    payments,
    clientActions,
    navigateToEventRoute,
    openFloorplanEditor,
    runClientAction,
    eventHeader,
  } = useClientWorkspace();

  if (!selectedEvent) {
    return (
      <EmptyState
        icon={LockKeyhole}
        title="No active event portal"
        description="The client portal opens after your inquiry is accepted and the signed conforme is uploaded."
        className="mt-8"
      />
    );
  }

  const needsAction = clientActions.filter((a) => a.tone === "primary" || a.tone === "warning");
  const waiting = clientActions.filter((a) => a.tone === "neutral");
  const completed = clientActions.filter((a) => a.tone === "success");

  return (
    <div className="space-y-5">
      {eventHeader}
      {route === "overview" && (
        <ClientOverviewTab
          selectedEvent={selectedEvent}
          briefing={briefing}
          payments={payments}
          billing={billing}
          documents={documents}
          audit={audit}
          officialDraft={officialDraft}
          preferenceDraftCount={preferenceDrafts.length}
          onOpenOfficialFloorplan={
            officialDraft
              ? () => openFloorplanEditor(officialDraft, officialDraft.status === "approved")
              : undefined
          }
          setTab={(next) => navigateToEventRoute(next)}
        />
      )}
      {route === "details" && <ClientEventDetailsView />}
      {route === "progress" && <ClientProgressView />}
      {route === "schedule" && <ClientScheduleView />}
      {route === "guests" && <ClientGuestsView />}
      {route === "preferences" && <ClientPreferencesView />}
      {route === "actions" && (
        <div className="grid gap-4 xl:grid-cols-3">
          <ClientActionGroup
            title="Needs your action"
            description="Client decisions that can move planning forward."
            actions={needsAction}
            onAction={runClientAction}
          />
          <ClientActionGroup
            title="Waiting on PMCM"
            description="Being prepared or reviewed by the event team."
            actions={waiting}
            onAction={runClientAction}
          />
          <ClientActionGroup
            title="Completed"
            description="Finished client-visible workflow items."
            actions={completed}
            onAction={runClientAction}
          />
        </div>
      )}
      {route === "briefing" && <ClientBriefingTab briefing={briefing} />}
      {route === "proposal" && (
        <ClientProposalTab
          selectedEvent={selectedEvent}
          briefing={briefing}
          billing={billing}
          payments={payments}
          officialDraft={officialDraft}
          setTab={(next) => navigateToEventRoute(next)}
        />
      )}
      {route === "approvals" && <ClientApprovalsView />}
      {route === "floorplan" && <ClientFloorPlanView />}
      {route === "documents" && <ClientDocumentsTab documents={documents} />}
      {route === "billing" && <ClientBillingTab payments={payments} billing={billing} />}
      {route === "messages" && <ClientMessagesView />}
      {route === "changes" && (
        <ClientActionGroup
          title="Change requests"
          description="Client-visible revision and change items for this event."
          actions={clientActions}
          onAction={runClientAction}
        />
      )}
      {route === "summary" && <ClientFinalSummaryView />}
    </div>
  );
}
