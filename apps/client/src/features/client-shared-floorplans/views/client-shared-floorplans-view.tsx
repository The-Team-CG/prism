"use client";

import { MapPinned } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
import { Card } from "@prism/ui/components/card";
import { ClientListEmpty, ClientListRow } from "@/features/client-dashboard/shared/client-list-ui";
import { clientSharedFloorplanSnapshotHref } from "../model/client-shared-floorplans";
import { useClientSharedFloorplansViewModel } from "../view-models/use-client-shared-floorplans-view-model";

const STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  in_review: "Waiting for your review",
  revision_requested: "Changes requested",
  submitted: "Submitted",
};

/**
 * Official layouts PMCM has shared, one row per event, on one surface under the page heading. Each row opens the
 * approved layout when there is one, otherwise the version sent for review. Both are read-only.
 */
export function ClientSharedFloorplansView() {
  const vm = useClientSharedFloorplansViewModel();
  return (
    <div className="space-y-4">
      {vm.error ? <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{vm.error}</p> : null}
      {vm.loading && vm.entries.length === 0 ? (
        <Card role="status" className="gap-0 px-4 py-5 text-sm text-muted-foreground">Loading shared floorplans…</Card>
      ) : vm.entries.length === 0 ? (
        <ClientListEmpty icon={MapPinned} title="No floorplans shared yet" description="When PMCM shares an official layout for one of your events, it appears here to view." />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <ul aria-label="Shared layouts" className="divide-y divide-border">
          {vm.entries.map((entry) => {
            const approved = entry.availableSnapshots.includes("approved");
            const snapshot = approved ? "approved" : entry.availableSnapshots[0];
            const status = STATUS_LABEL[entry.draftStatus] ?? entry.draftStatus.replaceAll("_", " ");
            return (
              <ClientListRow
                key={`${entry.eventId}:${entry.draftId}`}
                icon={MapPinned}
                tone={approved ? "done" : entry.draftStatus === "in_review" ? "attention" : "neutral"}
                title={entry.eventName}
                meta={`${formatPortalDate(entry.eventDate)} · ${entry.draftName}${approved && entry.availableSnapshots.includes("submitted") ? " · earlier version also shared" : ""}`}
                status={status}
                action={approved ? "View approved layout" : "View layout"}
                href={snapshot ? clientSharedFloorplanSnapshotHref(entry.eventId, entry.draftId, snapshot) : undefined}
              />
            );
          })}
          </ul>
        </Card>
      )}
    </div>
  );
}
