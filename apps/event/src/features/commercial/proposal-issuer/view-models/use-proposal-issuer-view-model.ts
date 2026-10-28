"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { PrismIssuedProposalSummary } from "@prism/types";
import { proposalIssuerRepository } from "../data/proposal-issuer-repository";
import {
  buildCostEstimateInput,
  buildIssueProposalInput,
  emptyEstimateLine,
  estimateTotal,
  type EstimateLineDraft,
} from "../model/proposal-issuer-rules";

const newLine = () => emptyEstimateLine(crypto.randomUUID());

export function useProposalIssuerViewModel(eventId: string) {
  const [latest, setLatest] = useState<PrismIssuedProposalSummary | null>(null);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [lines, setLines] = useState<EstimateLineDraft[]>(() => [newLine()]);
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Kept between attempts so a failed issue retries against the estimate it already created.
  const createdEstimateId = useRef<string | null>(null);
  // One key per drafted proposal: a retry after a failed attempt replays the same issue request instead of creating another version.
  const issueKey = useRef<string | null>(null);
  const currentEventId = useRef(eventId);
  currentEventId.current = eventId;

  const load = useCallback(async () => {
    const requestedEventId = eventId;
    try {
      const result = await proposalIssuerRepository.latest(requestedEventId);
      if (currentEventId.current === requestedEventId) setLatest(result.proposal);
    } catch (cause) {
      if (currentEventId.current === requestedEventId) setError(cause instanceof Error ? cause.message : "Could not load the issued proposal.");
    }
  }, [eventId]);

  useEffect(() => {
    setLatest(null);
    setError(null);
    setNotice(null);
    createdEstimateId.current = null;
    issueKey.current = null;
    void load();
  }, [load]);

  function editProposal<T>(setter: (value: T) => void) {
    return (value: T) => {
      issueKey.current = null;
      setter(value);
    };
  }

  function editEstimate<T>(setter: (value: T) => void) {
    return editProposal((value: T) => {
      createdEstimateId.current = null;
      setter(value);
    });
  }

  const updateLine = (key: string, patch: Partial<EstimateLineDraft>) =>
    editEstimate(setLines)(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const addLine = () => editEstimate(setLines)([...lines, newLine()]);
  const removeLine = (key: string) => editEstimate(setLines)(lines.length > 1 ? lines.filter((line) => line.key !== key) : lines);

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const requestedEventId = eventId;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const draft = { budgetAmount, notes, lines, title, summary, revisionNote };
      let estimateId = createdEstimateId.current;
      if (!estimateId) {
        const estimate = await proposalIssuerRepository.createEstimate(requestedEventId, buildCostEstimateInput(draft));
        estimateId = estimate.id;
        createdEstimateId.current = estimateId;
      }
      issueKey.current ??= crypto.randomUUID();
      const version = await proposalIssuerRepository.issue(requestedEventId, buildIssueProposalInput(draft, estimateId, issueKey.current));
      if (currentEventId.current !== requestedEventId) return;
      createdEstimateId.current = null;
      issueKey.current = null;
      setNotice(`Version ${version.versionNumber} is issued. The client can now review it.`);
      setTitle("");
      setSummary("");
      setRevisionNote("");
      setNotes("");
      setBudgetAmount("");
      setLines([newLine()]);
      await load();
    } catch (cause) {
      if (currentEventId.current === requestedEventId) setError(cause instanceof Error ? cause.message : "Could not issue this proposal.");
    } finally {
      if (currentEventId.current === requestedEventId) setBusy(false);
    }
  }

  return {
    latest,
    lines,
    total: estimateTotal(lines),
    budgetAmount,
    setBudgetAmount: editEstimate(setBudgetAmount),
    notes,
    setNotes: editEstimate(setNotes),
    title,
    setTitle: editProposal(setTitle),
    summary,
    setSummary: editProposal(setSummary),
    revisionNote,
    setRevisionNote: editProposal(setRevisionNote),
    busy,
    error,
    notice,
    updateLine,
    addLine,
    removeLine,
    issue,
  };
}
