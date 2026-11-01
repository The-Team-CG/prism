"use client";

import { FileRequirementsMatrixPanel } from "@/features/files/matrix";
import { PmcmDocumentHubView } from "@/features/files/hub";
import { EventFileHub } from "./event-file-hub";
import { EventDestinationPicker } from "./event-destination-picker";
import { WorkspaceSubTabs } from "./workspace-sub-tabs";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

export function EventDashboardFilesSectionView() {
  const {
    selectedEvent,
    documents,
    drafts,
    billingStatements,
    quoteRequests,
    briefing,
    checks,
    postEventDocuments,
    navigateEventTab,
    events,
    navigateEvent,
  } = useEventDashboardLoadedRouteViewModel();
  return (

          selectedEvent ? (
            <WorkspaceSubTabs
              label="File sections"
              tabs={[
                { id: "stored", label: "Stored files", render: () => <PmcmDocumentHubView eventId={selectedEvent.id} /> },
                { id: "required", label: "Required files", render: () => <FileRequirementsMatrixPanel eventId={selectedEvent.id} /> },
                {
                  id: "records",
                  label: "Records by area",
                  render: () => (
                    <EventFileHub
                      event={selectedEvent}
                      documents={documents}
                      drafts={drafts}
                      billingStatements={billingStatements}
                      quoteRequests={quoteRequests}
                      briefing={briefing}
                      checks={checks}
                      postEventDocuments={postEventDocuments}
                      onOpenFloorplans={() => navigateEventTab("floorplans")}
                      onOpenBriefing={() => navigateEventTab("briefing")}
                      onOpenSuppliers={() => navigateEventTab("suppliers")}
                      onOpenBilling={() => navigateEventTab("billing")}
                      onOpenClosure={() => navigateEventTab("closure")}
                    />
                  ),
                },
              ]}
            />
          ) : (
            <EventDestinationPicker
              events={events}
              description="Files are organized by event. Choose one to open its file hub."
              actionLabel="Open files"
              tab="files"
              onOpenEvent={(eventId) => navigateEvent(eventId, "files")}
            />
          )
  );
}
