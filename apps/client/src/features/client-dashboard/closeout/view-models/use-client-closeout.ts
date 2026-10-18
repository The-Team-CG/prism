"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PrismClientCloseoutWorkspace, SubmitClientCloseoutResponseInput } from "@prism/types";
import { acknowledgeClientCloseout, acknowledgeClientDeliverable, loadClientCloseout, revokeClientTestimonialConsent, submitClientCloseoutResponse } from "../use-cases/client-closeout-actions";

export function useClientCloseout(eventId: string) {
  const [workspace, setWorkspace] = useState<PrismClientCloseoutWorkspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const currentEventId = useRef(eventId);
  currentEventId.current = eventId;
  const reload = useCallback(async () => {
    const requestedEventId = eventId;
    setError(null);
    try {
      const loaded = await loadClientCloseout(requestedEventId);
      if (currentEventId.current === requestedEventId) setWorkspace(loaded);
    } catch (caught) {
      if (currentEventId.current === requestedEventId) setError(caught instanceof Error ? caught.message : "Could not load event closeout.");
    }
  }, [eventId]);
  useEffect(() => { setWorkspace(null); setError(null); setNotice(null); void reload(); }, [reload]);
  const run = async (action: () => Promise<unknown>, success: string) => {
    const requestedEventId = eventId;
    setBusy(true); setError(null); setNotice(null);
    try { await action(); await reload(); if (currentEventId.current === requestedEventId) setNotice(success); }
    catch (caught) { if (currentEventId.current === requestedEventId) setError(caught instanceof Error ? caught.message : "The closeout update could not be saved."); }
    finally { if (currentEventId.current === requestedEventId) setBusy(false); }
  };
  return {
    workspace, busy, error, notice,
    acknowledgeWrapUp: (note: string) => run(() => acknowledgeClientCloseout(eventId, note), "Wrap-up acknowledgement saved."),
    acknowledgeDeliverable: (documentId: string, note: string) => run(() => acknowledgeClientDeliverable(eventId, documentId, note), "Deliverable acknowledgement saved."),
    submitResponse: (input: SubmitClientCloseoutResponseInput) => run(async () => {
      const response = await submitClientCloseoutResponse(eventId, input);
      if (currentEventId.current === eventId) setWorkspace((current) => current ? { ...current, response } : current);
      return response;
    }, "Feedback saved."),
    revokeConsent: () => run(() => revokeClientTestimonialConsent(eventId), "Testimonial consent withdrawn."),
  };
}
