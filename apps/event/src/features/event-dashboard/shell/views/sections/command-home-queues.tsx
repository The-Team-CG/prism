"use client";

import { ShieldCheck } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { humanizeToken } from "@/features/pmcm-kit/model/formatters";
import type { PrismApprovalRequest, PrismEvent } from "@prism/types";
import type { DetailTab } from "../../model/event-dashboard-routing";
import { Card, CardHeader } from "./shell-ui";
import { EventQueueCard } from "./event-queue-card";

export function CommandHomeQueues({
  events,
  selectedEvent,
  pendingApprovals,
  onNavigateEvent,
  onReset,
}: {
  events: PrismEvent[];
  selectedEvent?: PrismEvent;
  pendingApprovals: PrismApprovalRequest[];
  onNavigateEvent: (id: string, tab?: DetailTab) => void;
  onReset: () => void;
}) {
  const hasApprovals = pendingApprovals.length > 0;
  return (
    <div className={`grid gap-5 ${hasApprovals ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
      <EventQueueCard
        events={events}
        selectedEventId={selectedEvent?.id}
        onSelectEvent={(id) => onNavigateEvent(id)}
        onReset={onReset}
        onNavigateEvent={(id) => onNavigateEvent(id, "overview")}
      />

      {hasApprovals ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-(--prism-signal)" />
              <h3 className="text-sm font-bold text-foreground">Pending approvals</h3>
              <Badge className="ml-auto rounded-full bg-(--prism-amber-soft) px-2 py-0.5 text-[10px] font-bold text-(--prism-amber)">
                {pendingApprovals.length}
              </Badge>
            </div>
          </CardHeader>
          <div className="divide-y divide-border">
            {pendingApprovals.slice(0, 3).map((req) => (
              <div key={req.id} className="px-6 py-3.5">
                <p className="truncate text-sm font-bold text-foreground">{req.name}</p>
                <p className="text-xs text-muted-foreground">{req.email} - {humanizeToken(req.role)}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
