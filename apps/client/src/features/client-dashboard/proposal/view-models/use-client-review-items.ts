"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseContract, decideClientReviewItemSchema, type DecideClientReviewItemInput, type PrismClientReviewItem } from "@prism/types";
import { clientReviewRepository } from "../data/client-review-repository";

export function useClientReviewItems(eventId: string) {
  const [items, setItems] = useState<PrismClientReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentEventId = useRef(eventId);
  currentEventId.current = eventId;

  const refresh = useCallback(async () => {
    const requestedEventId = eventId;
    setLoading(true);
    try {
      const result = await clientReviewRepository.list(requestedEventId);
      if (currentEventId.current === requestedEventId) { setItems(result); setError(null); }
    } catch (reason) {
      if (currentEventId.current === requestedEventId) setError(reason instanceof Error ? reason.message : "Unable to load venue and styling options");
    } finally {
      if (currentEventId.current === requestedEventId) setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    setItems([]);
    setError(null);
    void refresh();
  }, [refresh]);

  const decide = useCallback(async (item: PrismClientReviewItem, action: DecideClientReviewItemInput["action"], comment: string) => {
    const requestedEventId = eventId;
    setBusyItemId(item.id);
    setError(null);
    try {
      const payload = parseContract(decideClientReviewItemSchema, {
        itemVersion: item.version,
        action,
        comment,
        idempotencyKey: crypto.randomUUID(),
      }, "Venue or styling decision");
      await clientReviewRepository.decide(requestedEventId, item.id, payload);
      if (currentEventId.current === requestedEventId) await refresh();
    } catch (reason) {
      if (currentEventId.current === requestedEventId) setError(reason instanceof Error ? reason.message : "Unable to save your decision");
    } finally {
      if (currentEventId.current === requestedEventId) setBusyItemId(null);
    }
  }, [eventId, refresh]);

  return { items, loading, busyItemId, error, refresh, decide };
}
