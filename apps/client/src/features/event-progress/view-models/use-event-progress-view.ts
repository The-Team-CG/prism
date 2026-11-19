"use client";

import { useMemo } from "react";
import { dashboardHref, useClientWorkspace } from "@/features/client-dashboard/workspace/shared";
import { computeEventProgressUseCase } from "../use-cases/compute-event-progress";
import type { EventProgressSnapshot } from "../model/event-progress-types";

export type EventProgressViewModel = EventProgressSnapshot & {
  hasEvent: boolean;
  /** How many things the client owes on this event; the Actions tab lists them. */
  needsYouCount: number;
  actionsHref?: string;
};

export function useEventProgressView(): EventProgressViewModel {
  const { state, selectedEvent, clientActions } = useClientWorkspace();
  const needsYouCount = clientActions.filter((action) => action.stage === "needs_client").length;

  return useMemo(() => {
    if (!selectedEvent || !state) {
      return {
        hasEvent: false,
        lifecycleStage: "Planning",
        lifecycleIndex: 0,
        checkpoints: [],
        timeline: [],
        paymentMilestones: [],
        clientEventDayStatus: null,
        needsYouCount,
      };
    }

    const snapshot = computeEventProgressUseCase(selectedEvent, state);
    return { ...snapshot, hasEvent: true, needsYouCount, actionsHref: dashboardHref("actions", selectedEvent.id) };
  }, [needsYouCount, selectedEvent, state]);
}
