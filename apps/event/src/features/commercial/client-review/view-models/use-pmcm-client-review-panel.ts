"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClientReviewItemSchema, parseContract, type CreateClientReviewItemInput, type PrismClientReviewItem } from "@prism/types";
import { clientReviewRepository } from "../data/client-review-repository";

export function usePmcmClientReviewPanel(eventId: string) {
  const [items, setItems] = useState<PrismClientReviewItem[]>([]);
  const [kind, setKind] = useState<CreateClientReviewItemInput["kind"]>("venue");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentEventId = useRef(eventId);
  currentEventId.current = eventId;
  const load = useCallback(async () => {
    const requestedEventId = eventId;
    try {
      const result = await clientReviewRepository.list(requestedEventId);
      if (currentEventId.current === requestedEventId) { setItems(result); setError(null); }
    } catch (cause) {
      if (currentEventId.current === requestedEventId) setError(cause instanceof Error ? cause.message : "Could not load client reviews.");
    }
  }, [eventId]);
  useEffect(() => { setItems([]); setError(null); void load(); }, [load]);
  const issue = async (event: FormEvent<HTMLFormElement>) => {
    const requestedEventId = eventId;
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const input = parseContract(createClientReviewItemSchema, { kind, title, summary, budgetRange, idempotencyKey: crypto.randomUUID() }, "Client review proposal");
      await clientReviewRepository.issue(requestedEventId, input);
      if (currentEventId.current === requestedEventId) { setTitle(""); setSummary(""); setBudgetRange(""); await load(); }
    } catch (cause) { if (currentEventId.current === requestedEventId) setError(cause instanceof Error ? cause.message : "Could not issue this review version."); }
    finally { if (currentEventId.current === requestedEventId) setBusy(false); }
  };
  const latestByKind = ["venue", "styling"].map((type) => items.filter((item) => item.kind === type).sort((a, b) => b.version - a.version)[0]).filter(Boolean);
  return { items, latestByKind, kind, setKind, title, setTitle, summary, setSummary, budgetRange, setBudgetRange, busy, error, issue };
}
