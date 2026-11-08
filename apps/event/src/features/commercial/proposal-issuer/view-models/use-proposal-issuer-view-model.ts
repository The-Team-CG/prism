"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PrismIssuedProposalSummary, PrismPreviousCostEstimate } from "@prism/types";
import { composeProposalDraftSections } from "@prism/types";
import { proposalIssuerRepository } from "../data/proposal-issuer-repository";
import {
  buildCostEstimateInput,
  buildIssueProposalInput,
  buildProposalDraftRequest,
  appendEstimateLines,
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
  const [drafting, setDrafting] = useState(false);
  // What the form held before the last AI draft, so one click restores typed text.
  const [beforeDraft, setBeforeDraft] = useState<{ title: string; summary: string; revisionNote: string } | null>(null);
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
  const [previousEstimates, setPreviousEstimates] = useState<PrismPreviousCostEstimate[]>([]);
  useEffect(() => {
    let current = true;
    proposalIssuerRepository.previousEstimates(eventId).then((result) => { if (current) setPreviousEstimates(result); }, () => { if (current) setPreviousEstimates([]); });
    return () => { current = false; };
  }, [eventId]);
  /** FR-19: consolidate the selected supplier quotes into the estimate lines. */
  async function addSelectedQuotes() {
    setError(null);
    try {
      const quoteLines = await proposalIssuerRepository.selectedQuoteLines(eventId);
      if (quoteLines.length === 0) {
        setNotice("No supplier quote is selected for this event yet.");
        return;
      }
      editEstimate(setLines)(appendEstimateLines(lines, quoteLines, () => newLine().key));
      setNotice(`Added ${quoteLines.length} selected supplier quote${quoteLines.length === 1 ? "" : "s"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the selected quotes.");
    }
  }
  const applyPreviousEstimate = (estimate: PrismPreviousCostEstimate) => editEstimate(setLines)(appendEstimateLines(lines, estimate.lines, () => newLine().key));
  const removeLine = (key: string) => editEstimate(setLines)(lines.length > 1 ? lines.filter((line) => line.key !== key) : lines);

  /** Fills the title, summary and change note from the estimate. Nothing is issued; PMCM edits first. */
  async function draftWording() {
    if (drafting || busy) return;
    const requestedEventId = eventId;
    setDrafting(true);
    setError(null);
    setNotice(null);
    try {
      const request = buildProposalDraftRequest(requestedEventId, { budgetAmount, notes, lines, title, summary, revisionNote });
      const { draft } = await proposalIssuerRepository.draftWording(request);
      if (currentEventId.current !== requestedEventId) return;
      setBeforeDraft({ title, summary, revisionNote });
      editProposal(setTitle)(draft.title);
      editProposal(setSummary)(composeProposalDraftSections(draft.sections));
      if (latest) editProposal(setRevisionNote)(draft.revisionNote);
      setNotice("Draft wording added. Review and edit it before you issue.");
    } catch (cause) {
      if (currentEventId.current === requestedEventId) setError(cause instanceof Error ? cause.message : "Could not draft the wording.");
    } finally {
      if (currentEventId.current === requestedEventId) setDrafting(false);
    }
  }

  function undoDraft() {
    if (!beforeDraft) return;
    editProposal(setTitle)(beforeDraft.title);
    editProposal(setSummary)(beforeDraft.summary);
    editProposal(setRevisionNote)(beforeDraft.revisionNote);
    setBeforeDraft(null);
    setNotice("Your earlier wording is back.");
  }

  async function issue() {
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
    drafting,
    draftWording,
    addSelectedQuotes,
    previousEstimates,
    applyPreviousEstimate,
    canUndoDraft: beforeDraft !== null,
    undoDraft,
    error,
    notice,
    updateLine,
    addLine,
    removeLine,
    issue,
  };
}
