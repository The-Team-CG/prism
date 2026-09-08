"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismGuestFeedback } from "@prism/types";
import { feedbackModerationRepository } from "../data/feedback-moderation-repository";
import { moderateFeedback } from "../use-cases/moderate-feedback";

export function useFeedbackModerationViewModel(eventId: string) {
  const [feedback, setFeedback] = useState<PrismGuestFeedback[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setFeedback(await feedbackModerationRepository.listPending(eventId)); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load feedback moderation queue."); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);
  const decide = useCallback(async (feedbackId: string, action: "approve" | "reject" | "hide", reason?: string) => {
    setBusyId(feedbackId);
    try { await moderateFeedback(eventId, feedbackId, { action, reason }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save moderation decision."); }
    finally { setBusyId(null); }
  }, [eventId, load]);
  return { feedback, error, busyId, reload: load, decide };
}
