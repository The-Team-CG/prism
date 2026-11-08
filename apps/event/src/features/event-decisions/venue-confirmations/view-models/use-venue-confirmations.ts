"use client";

import { useCallback, useEffect, useState } from "react";
import { parseContract, resolveVenueConfirmationSchema, type PrismVenueConfirmationTask } from "@prism/types";
import { venueConfirmationsRepository } from "../data/venue-confirmations-repository";

export function useVenueConfirmations(eventId: string) {
  const [tasks, setTasks] = useState<PrismVenueConfirmationTask[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setTasks(await venueConfirmationsRepository.list(eventId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load venue confirmations.");
    }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  async function resolve(taskId: string, outcome: "confirmed" | "unavailable") {
    setBusy(true);
    setError(null);
    try {
      await venueConfirmationsRepository.resolve(eventId, taskId, parseContract(resolveVenueConfirmationSchema, { outcome, note: notes[taskId] ?? "" }, "Venue confirmation"));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the venue confirmation.");
    } finally {
      setBusy(false);
    }
  }

  return { tasks, notes, setNote: (taskId: string, value: string) => setNotes((current) => ({ ...current, [taskId]: value })), busy, error, resolve };
}
