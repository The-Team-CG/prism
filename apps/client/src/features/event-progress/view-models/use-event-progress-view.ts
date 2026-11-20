"use client";

import { useMemo } from "react";
import { manilaDateKey } from "@prism/ui/format-date";
import { dashboardHref, useClientWorkspace } from "@/features/client-dashboard/workspace/shared";
import { computeEventProgress } from "../model/event-progress-rules";
import type { EventProgressSnapshot, ProgressMilestone } from "../model/event-progress-types";

export type EventProgressViewModel = Omit<EventProgressSnapshot, "milestones"> & {
  hasEvent: boolean;
  milestones: Array<ProgressMilestone & { href?: string }>;
  /** How many things the client owes on this event; the Actions tab lists them. */
  needsYouCount: number;
  actionsHref?: string;
};

export function useEventProgressView(): EventProgressViewModel {
  const { state, selectedEvent, clientActions } = useClientWorkspace();
  const needsYouCount = clientActions.filter((action) => action.stage === "needs_client").length;

  return useMemo(() => {
    if (!selectedEvent || !state) {
      return { hasEvent: false, lifecycleStage: "Planning", lifecycleIndex: 0, milestones: [], clientEventDayStatus: null, needsYouCount };
    }
    const snapshot = computeEventProgress(selectedEvent, state, manilaDateKey());
    return {
      ...snapshot,
      milestones: snapshot.milestones.map((milestone) => ({
        ...milestone,
        href: milestone.route ? dashboardHref(milestone.route, selectedEvent.id) : undefined,
      })),
      hasEvent: true,
      needsYouCount,
      actionsHref: dashboardHref("actions", selectedEvent.id),
    };
  }, [needsYouCount, selectedEvent, state]);
}
