"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseContract, sendClientMessageSchema, type ClientMessageTrigger, type PrismClientMessageTriggerState } from "@prism/types";
import { clientFollowUpsRepository } from "../data/client-follow-ups-repository";

type Draft = { subject: string; body: string };

export function useClientFollowUps(eventId: string) {
  const [triggers, setTriggers] = useState<PrismClientMessageTriggerState[]>([]);
  const [drafts, setDrafts] = useState<Partial<Record<ClientMessageTrigger, Draft>>>({});
  const [busy, setBusy] = useState<ClientMessageTrigger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sendKeys = useRef<Partial<Record<ClientMessageTrigger, string>>>({});

  const load = useCallback(async () => {
    try {
      setTriggers(await clientFollowUpsRepository.triggers(eventId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load client follow-ups.");
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  async function draft(trigger: ClientMessageTrigger) {
    setBusy(trigger);
    setError(null);
    try {
      const { draft } = await clientFollowUpsRepository.draft({ eventId, trigger });
      setDrafts((current) => ({ ...current, [trigger]: draft }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not draft the message.");
    } finally {
      setBusy(null);
    }
  }

  function edit(trigger: ClientMessageTrigger, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [trigger]: { subject: "", body: "", ...current[trigger], ...patch } }));
  }

  async function send(trigger: ClientMessageTrigger) {
    const current = drafts[trigger];
    if (!current) return;
    sendKeys.current[trigger] ??= crypto.randomUUID();
    setBusy(trigger);
    setError(null);
    try {
      const input = parseContract(sendClientMessageSchema, { eventId, trigger, ...current, idempotencyKey: sendKeys.current[trigger] }, "Client message");
      await clientFollowUpsRepository.send(input);
      delete sendKeys.current[trigger];
      setDrafts((all) => ({ ...all, [trigger]: undefined }));
      setNotice("Message queued for the client.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the message.");
    } finally {
      setBusy(null);
    }
  }

  return { triggers, drafts, busy, error, notice, draft, edit, send };
}
