"use client";

import { useMemo } from "react";
import { useClientWorkspace, type ClientDashboardAction } from "@/features/client-dashboard/workspace/shared";
import { computeEventProgressUseCase } from "../use-cases/compute-event-progress";
import type { EventProgressSnapshot } from "../model/event-progress-types";

export type EventProgressViewModel = EventProgressSnapshot & {
  hasEvent: boolean;
  clientActions: ClientDashboardAction[];
  runClientAction: (action: ClientDashboardAction) => void;
};

export function useEventProgressView(): EventProgressViewModel {
  const { state, selectedEvent, clientActions, runClientAction } = useClientWorkspace();

  return useMemo(() => {
    if (!selectedEvent || !state) {
      return {
        hasEvent: false,
        lifecycleStage: "Planning",
        lifecycleIndex: 0,
        checkpoints: [],
        timeline: [],
        paymentMilestones: [],
        score: 0,
        clientActions,
        runClientAction,
      };
    }

    const snapshot = computeEventProgressUseCase(selectedEvent, state);
    return { ...snapshot, hasEvent: true, clientActions, runClientAction };
  }, [clientActions, runClientAction, selectedEvent, state]);
}
