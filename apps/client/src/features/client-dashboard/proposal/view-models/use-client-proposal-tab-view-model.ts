"use client";

import { useRef, useState } from "react";
import type { ReviewEventProposalInput } from "@prism/types";
import { useClientWorkspace } from "../../workspace/shared";
import { proposalReviewRepository } from "../data/proposal-review-repository";
import {
  canApproveProposal,
  canRequestProposalRevision,
  latestIssuedProposal,
  retainProposalDecisionKey,
  proposalPackageReady,
  proposalReviewHeadline,
  remainingProposalRevisions,
} from "../model/proposal-review-rules";

export function useClientProposalTabViewModel() {
  const { selectedEvent, briefing, billing, payments, documents, officialDraft, refresh, setNotice, setError, setBusy, busy } =
    useClientWorkspace();
  const [revisionNote, setRevisionNote] = useState("");
  const pendingDecision = useRef<ReturnType<typeof retainProposalDecisionKey> | null>(null);
  const issuedProposal = latestIssuedProposal(documents);
  const packageReady = proposalPackageReady({ briefing, billing, proposalIssued: Boolean(issuedProposal) });
  const event = selectedEvent;

  async function submit(action: ReviewEventProposalInput["action"]) {
    if (!event || !issuedProposal || busy) return;
    if (action === "approve" ? !canApproveProposal(event, packageReady) : !canRequestProposalRevision(event, packageReady)) return;
    setBusy("proposal-review");
    setError(null);
    try {
      const decision = retainProposalDecisionKey(pendingDecision.current, {
        eventId: event.id, documentId: issuedProposal.id, action, revisionNote,
      }, () => crypto.randomUUID());
      pendingDecision.current = decision;
      const input: ReviewEventProposalInput = {
        action,
        idempotencyKey: decision.key,
        ...(action === "request_revision" ? { revisionNote: decision.revisionNote } : {}),
      };
      await proposalReviewRepository.review(event.id, input);
      pendingDecision.current = null;
      setRevisionNote("");
      setNotice(action === "approve" ? "Proposal approval recorded. PMCM can review your decision and continue planning." : "Revision request sent to PMCM. Your notes are recorded with this proposal.");
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
