"use client";

import { useResource } from "@prism/portal-query";
import { FileRequirementsMatrixPanel } from "@/features/files/matrix";
import { fileSummaryLabel, pmcmFileSummaries } from "@/features/pmcm-overview";
import { PmcmFileLibraryView } from "@/features/files/library";
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
  const summaries = useResource(pmcmFileSummaries, selectedEvent ? null : "signed-in");
  const byEvent = new Map((summaries.data?.items ?? []).map((item) => [item.eventId, item]));
  return (

          selectedEvent ? (
            <WorkspaceSubTabs
              label="File sections"
              tabs={[
                { id: "library", label: "Library", render: () => <PmcmFileLibraryView eventId={selectedEvent.id} /> },
                { id: "required", label: "Requirements", render: () => <FileRequirementsMatrixPanel eventId={selectedEvent.id} suppliers={Array.from(new Map(quoteRequests.filter((request) => request.eventId === selectedEvent.id && request.status === "selected" && request.supplierId).map((request) => [request.supplierId!, { supplierId: request.supplierId!, supplierName: request.supplierName }])).values())} /> },
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
              rowDetail={(event) => fileSummaryLabel(byEvent.get(event.id))}
            />
          )
  );
}
