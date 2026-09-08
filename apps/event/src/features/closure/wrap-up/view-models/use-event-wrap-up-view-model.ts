"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismEventWrapUp, StartEventWrapUpInput, UpdateEventWrapUpInput } from "@prism/types";
import { wrapUpRepository } from "../data/wrap-up-repository";
import { wrapUpProgress, wrapUpReminderState } from "../model/wrap-up-rules";

export function useEventWrapUpViewModel(eventId: string) {
  const [record, setRecord] = useState<PrismEventWrapUp | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setBusy(true); setError(null);
    try { setRecord(await wrapUpRepository.get(eventId)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load wrap-up."); } finally { setBusy(false); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);
  async function start(input: StartEventWrapUpInput) { setBusy(true); try { setRecord(await wrapUpRepository.start(eventId, input)); } finally { setBusy(false); } }
  async function update(input: UpdateEventWrapUpInput) { setBusy(true); try { setRecord(await wrapUpRepository.update(eventId, input)); } finally { setBusy(false); } }
  return { record, busy, error, start, update, reload: load, progress: wrapUpProgress(record), reminder: wrapUpReminderState(record) };
}
