"use client";

import { useRef, useState } from "react";
import type { ReviewEventProposalInput } from "@prism/types";
import { useClientWorkspace } from "../../workspace/shared";
import { proposalReviewRepository } from "../data/proposal-review-repository";
import {
  canApproveProposal,
  canRequestProposalRevision,
  proposalPackageReady,
  proposalReviewHeadline,
  remainingProposalRevisions,
} from "../model/proposal-review-rules";

export function useClientProposalTabViewModel() {
  const { selectedEvent, briefing, billing, payments, documents, officialDraft, refresh, setNotice, setError, setBusy, busy } =
    useClientWorkspace();
  const [revisionNote, setRevisionNote] = useState("");
  const pendingDecision = useRef<{ action: ReviewEventProposalInput["action"]; revisionNote: string; key: string } | null>(null);
  const packageReady = proposalPackageReady({ briefing, billing, proposalIssued: documents.some((document) =>
    ["proposal", "ce_proposal", "briefing_proposal"].includes(document.type) && document.status === "issued") });
  const event = selectedEvent;

  async function submit(action: ReviewEventProposalInput["action"]) {
    if (!event) return;
    setBusy("proposal-review");
    setError(null);
    try {
      const normalizedNote = action === "request_revision" ? revisionNote.trim() : "";
      const previous = pendingDecision.current;
      const key = previous?.action === action && previous.revisionNote === normalizedNote ? previous.key : crypto.randomUUID();
      pendingDecision.current = { action, revisionNote: normalizedNote, key };
      const input: ReviewEventProposalInput = {
        action,
        idempotencyKey: key,
        ...(action === "request_revision" ? { revisionNote: normalizedNote } : {}),
      };
      await proposalReviewRepository.review(event.id, input);
      pendingDecision.current = null;
      setRevisionNote("");
      setNotice(action === "approve" ? "Proposal approved." : "Revision requested.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not review the proposal.");
    } finally {
      setBusy(null);
    }
  }

  return {
    selectedEvent: event,
    briefing,
    billing,
    payments,
    officialDraft,
    packageReady,
    headline: event ? proposalReviewHeadline(event, packageReady) : "Proposal",
    revisionNote,
    setRevisionNote,
    reviewing: busy === "proposal-review",
    canApprove: event ? canApproveProposal(event, packageReady) : false,
    canRequestRevision: event ? canRequestProposalRevision(event, packageReady) : false,
    remainingRevisions: event ? remainingProposalRevisions(event) : 0,
    approve: () => submit("approve"),
    requestRevision: () => submit("request_revision"),
  };
}
