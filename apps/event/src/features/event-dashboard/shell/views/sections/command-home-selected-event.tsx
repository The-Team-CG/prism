"use client";

import { ArrowRight, CalendarDays } from "lucide-react";
import type { PrismEvent, PrismFloorPlanDraft } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { SelectedEventStatusSummary } from "@/features/command-inbox/list";
import { RouteLink } from "@/features/pmcm-kit";
import { SIDEBAR_STATIC_ROUTES, eventWorkspaceHref } from "../../model/event-dashboard-routing";
import { Card, CardBody, CardHeader } from "./shell-ui";

/** Dashboard home companion to the command inbox: the selected event's status, or a way to pick one. */
export function CommandHomeSelectedEvent({
  event,
  drafts,
  activeDraft,
  quoteRequestCount,
  quoteCount,
  openCheckCount,
  onOpenEvent,
  onBrowseEvents,
}: {
  event?: PrismEvent;
  drafts: PrismFloorPlanDraft[];
  activeDraft?: PrismFloorPlanDraft;
  quoteRequestCount: number;
  quoteCount: number;
  openCheckCount: number;
  onOpenEvent: (eventId: string) => void;
  onBrowseEvents: () => void;
}) {
  if (!event) {
    return (
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="size-4 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-bold text-foreground">No event selected</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Open an event from the inbox or the events list to see its status here.</p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="rounded-lg font-bold">
            <RouteLink href={SIDEBAR_STATIC_ROUTES["events-list"]} onNavigate={onBrowseEvents}>Browse events</RouteLink>
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-foreground">{event.eventName}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Selected event{event.clientName ? ` for ${event.clientName}` : ""}</p>
          </div>
          <Button asChild size="sm" variant="outline" className="rounded-lg font-bold">
            <RouteLink href={eventWorkspaceHref(event.id)} onNavigate={() => onOpenEvent(event.id)}>
              Open workspace <ArrowRight className="size-4" />
            </RouteLink>
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        <SelectedEventStatusSummary
          drafts={drafts}
          activeDraft={activeDraft}
          quoteRequestCount={quoteRequestCount}
          quoteCount={quoteCount}
          openCheckCount={openCheckCount}
        />
      </CardBody>
    </Card>
  );
}
