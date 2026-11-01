"use client";

import { EventRegister } from "./event-register";
import { EventArchiveSearchView } from "@/features/closure/archive";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

export function EventDashboardEventsListSectionView() {
  const { eventsForView, navigateEvent } = useEventDashboardLoadedRouteViewModel();
  return (
    <div className="grid gap-8">
      <EventRegister events={eventsForView} onOpenEvent={(id) => navigateEvent(id, "overview")} />
      <EventArchiveSearchView />
    </div>
  );
}
