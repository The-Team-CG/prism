"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { humanizeToken } from "@/features/pmcm-kit/model/formatters";
import { Card, CardBody } from "./shell-ui";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

export function EventWorkspaceHeader() {
  const { selectedEvent, submitBriefing, navigateEventTab } = useEventDashboardLoadedRouteViewModel();
  if (!selectedEvent) return null;
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">Event workspace</p>
        <h1 className="mt-1 text-xl font-bold text-foreground">{selectedEvent.eventName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{selectedEvent.clientName} — {selectedEvent.eventDate}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusBadge status={selectedEvent.status} />
          <StatusBadge status={selectedEvent.floorPlanStatus} label={`Floorplan ${humanizeToken(selectedEvent.floorPlanStatus)}`} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="rounded-lg font-bold" onClick={submitBriefing}>
          Submit briefing
        </Button>
        <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => navigateEventTab("suppliers")}>
          Supplier desk
        </Button>
        <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => navigateEventTab("live-ops")}>
          Live ops
        </Button>
      </div>
    </div>
  );
}

export function EmptyEventWorkspace() {
  return (
    <Card>
      <CardBody>
        <EmptyState
          icon={AlertTriangle}
          title="No confirmed events"
          description="Accept an inquiry and upload signed conforme to create the first PMCM event workspace."
        />
      </CardBody>
    </Card>
  );
}
