"use client";

import { LockKeyhole } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { ClientBillingTab } from "../../billing";
import { ClientBriefingTab } from "../../briefing";
import { ClientDocumentsTab } from "../../documents";
import { ClientProposalTab } from "../../proposal";
import { ClientActionGroup } from "../../shared/client-action-group";
import { useClientWorkspace } from "../../workspace/client-workspace-context";
import { ClientOverviewTab } from "./client-overview-tab";
import { ClientEventDetailsPage } from "./client-event-details-page";
import { ClientProgressPage } from "./client-progress-page";
import { ClientSchedulePage } from "./client-schedule-page";
import { ClientGuestsPage } from "./client-guests-page";
import { ClientPreferencesPage } from "./client-preferences-page";
import { ClientFloorPlanPage } from "./client-floorplan-page";
import { ClientFinalSummaryPage } from "./client-final-summary-page";
import { ClientMessagesPage } from "../../messages";
import { ClientApprovalsPage } from "../../approvals";

export function ClientEventWorkspacePage() {
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
      {route === "details" && <ClientEventDetailsPage />}
      {route === "progress" && <ClientProgressPage />}
      {route === "schedule" && <ClientSchedulePage />}
      {route === "guests" && <ClientGuestsPage />}
      {route === "preferences" && <ClientPreferencesPage />}
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
      {route === "approvals" && <ClientApprovalsPage />}
      {route === "floorplan" && <ClientFloorPlanPage />}
      {route === "documents" && <ClientDocumentsTab documents={documents} />}
      {route === "billing" && <ClientBillingTab payments={payments} billing={billing} />}
      {route === "messages" && <ClientMessagesPage />}
      {route === "changes" && (
        <ClientActionGroup
          title="Change requests"
          description="Client-visible revision and change items for this event."
          actions={clientActions}
          onAction={runClientAction}
        />
      )}
      {route === "summary" && <ClientFinalSummaryPage />}
    </div>
  );
}
