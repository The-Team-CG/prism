"use client";

import { MapPinned, RotateCcw } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
import { Button } from "@/app/components/ui/button";
import { ClientListEmpty, ClientListRow, ClientListSection } from "@/features/client-dashboard/shared/client-list-ui";
import { clientSharedFloorplanSnapshotHref } from "../model/client-shared-floorplans";
import { useClientSharedFloorplansViewModel } from "../view-models/use-client-shared-floorplans-view-model";

const STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  in_review: "Waiting for your review",
  revision_requested: "Changes requested",
  submitted: "Submitted",
};

/**
 * Official layouts PMCM has shared, one row per event. Rendered inside the portal shell; each row opens the
 * approved layout when there is one, otherwise the version sent for review. Both are read-only.
 */
export function ClientSharedFloorplansView() {
  const vm = useClientSharedFloorplansViewModel();
  const refresh = (
    <Button variant="ghost" size="sm" onClick={vm.reload} disabled={vm.loading}>
      <RotateCcw className="size-4" aria-hidden /> {vm.loading ? "Refreshing…" : "Refresh"}
    </Button>
  );

  return (
    <div className="space-y-4">
      {vm.error ? <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{vm.error}</p> : null}
      {vm.loading && vm.entries.length === 0 ? (
        <p role="status" className="rounded-lg border border-border bg-card px-4 py-5 text-sm text-muted-foreground">Loading shared floorplans…</p>
      ) : vm.entries.length === 0 ? (
        <ClientListEmpty icon={MapPinned} title="No floorplans shared yet" description="When PMCM shares an official layout for one of your events, it appears here to view." action={refresh} />
      ) : (
        <ClientListSection id="client-shared-floorplans" title="Shared layouts" count={vm.entries.length} description="Official layouts are read-only. Send layout preferences from your event's floor plan page." action={refresh}>
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
        </ClientListSection>
      )}
    </div>
  );
}
