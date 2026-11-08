"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createProposalCommentSchema, parseContract, type PrismProposalComment } from "@prism/types";
import { proposalCommentsRepository } from "../data/proposal-comments-repository";

export function useProposalComments(eventId: string) {
  const [comments, setComments] = useState<PrismProposalComment[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingKey = useRef<{ body: string; key: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setComments(await proposalCommentsRepository.list(eventId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load proposal comments.");
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  async function reply() {
    const body = draft.trim();
    if (!body || busy) return;
    if (pendingKey.current?.body !== body) pendingKey.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    setError(null);
    try {
      const input = parseContract(createProposalCommentSchema, { body, idempotencyKey: pendingKey.current.key }, "Proposal reply");
      await proposalCommentsRepository.create(eventId, input);
      pendingKey.current = null;
      setDraft("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the reply.");
    } finally {
      setBusy(false);
    }
  }

  return { comments, draft, setDraft, busy, error, reply };
}
