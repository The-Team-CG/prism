"use client";

import { useState } from "react";
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
  const { selectedEvent, briefing, billing, payments, officialDraft, refresh, setNotice, setError, setBusy, busy } =
    useClientWorkspace();
  const [revisionNote, setRevisionNote] = useState("");
  const packageReady = proposalPackageReady({ briefing, billing });
  const event = selectedEvent;

  async function submit(action: ReviewEventProposalInput["action"]) {
    if (!event) return;
    setBusy("proposal-review");
    setError(null);
    try {
      const input: ReviewEventProposalInput =
        action === "request_revision" ? { action, revisionNote } : { action };
      await proposalReviewRepository.review(event.id, input);
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
