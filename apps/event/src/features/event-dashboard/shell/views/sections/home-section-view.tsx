"use client";

import { EventDashboardCommandInboxSectionView } from "./command-inbox-section-view";
import { Card, CardHeader } from "./shell-ui";
import { CommandHomeSelectedEvent } from "./command-home-selected-event";
import { humanizeToken } from "@/features/pmcm-kit/model/formatters";
import { ShieldCheck } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { useEventDashboardScopedRouteViewModel } from "../event-dashboard-route-context";

export function EventDashboardHomeSectionView() {
  const {
    selectedEvent,
    drafts,
    activeDraft,
    quoteRequests,
    quotes,
    openCheckCount,
    pendingApprovals,
    navigateEvent,
    busy,
    approveApprovalRequest,
    declineApprovalRequest,
  } = useEventDashboardScopedRouteViewModel();
  return (

          <>
            <EventDashboardCommandInboxSectionView />
            <CommandHomeSelectedEvent
              event={selectedEvent}
              drafts={drafts}
              activeDraft={activeDraft}
              quoteRequestCount={quoteRequests.length}
              quoteCount={quotes.length}
              openCheckCount={openCheckCount}
              onOpenEvent={(eventId) => navigateEvent(eventId, "overview")}
            />

            {/* Pending account approvals */}
            {pendingApprovals.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">Account approvals</h2>
                  </div>
                </CardHeader>
                <div className="divide-y divide-border">
                  {pendingApprovals.map((request) => (
                    <div key={request.id} className="flex items-start justify-between gap-4 px-6 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{request.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{request.email}</p>
                        <p className="mt-1 text-xs font-medium text-attention">
                          {humanizeToken(request.role)} — {request.organization}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button size="sm" disabled={!!busy} onClick={() => approveApprovalRequest(request.id)} className="rounded-lg font-semibold">
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => declineApprovalRequest(request.id)} className="rounded-lg font-semibold">
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
  );
}
