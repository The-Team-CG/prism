"use client";

import { EventRoleLoadingState } from "@/features/event-dashboard/loading";
import { EventCommandLanding } from "@/features/event-public/landing";
import { useEventCommandHomeViewModel } from "../view-models/use-event-command-home-view-model";

export function EventCommandHomeView() {
  const { session, onSignedIn } = useEventCommandHomeViewModel();

  if (!session) return <EventCommandLanding onSignedIn={onSignedIn} />;
  return <EventRoleLoadingState role={session.role} />;
}
