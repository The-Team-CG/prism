"use client";

import { useCallback, useMemo, useState } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import { toast } from "@prism/ui/components/sonner";
import { eventPlan } from "../../event-plan/data/event-plan-repository";
import { dateImpact, dateImpactRepository, type DateImpactKey } from "../data/date-impact-repository";
import { submitSyncPlan } from "../use-cases/sync-plan";

export type DateImpactViewModel = ReturnType<typeof useDateImpactViewModel>;

/** The date change review: the date being considered (or none), what it touches, and the one step that moves the plan. */
export function useDateImpactViewModel(eventId: string) {
  const [draftDate, setDraftDate] = useState("");
  const [checkedDate, setCheckedDate] = useState<string | null>(null);
  const key = useMemo<DateImpactKey>(() => ({ eventId, newDate: checkedDate }), [eventId, checkedDate]);
  const impact = useResource(dateImpact, key);
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncPlan = useCallback(async () => {
    if (!impact.data) return false;
    setBusy(true);
    setError(null);
    try {
      await submitSyncPlan(dateImpactRepository, impact.data);
      await Promise.all([invalidate(dateImpact), invalidate(eventPlan)]);
      toast.success("The plan now follows the event date");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not move the plan. Try again.");
      // A refused preview is stale: read the impact again so the next attempt starts from what is true now.
      await invalidate(dateImpact);
      return false;
    } finally {
      setBusy(false);
    }
  }, [impact.data, invalidate]);

  return {
    status: impact.status,
    loadError: impact.status === "error" ? impact.error.message : null,
    impact: impact.data ?? null,
    draftDate,
    setDraftDate,
    checkedDate,
    check: () => { setError(null); setCheckedDate(draftDate.trim() === "" ? null : draftDate); },
    reset: () => { setError(null); setDraftDate(""); setCheckedDate(null); },
    busy,
    error,
    syncPlan,
  };
}
