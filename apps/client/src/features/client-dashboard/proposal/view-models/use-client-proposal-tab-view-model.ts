"use client";

import { useEffect, useRef, useState } from "react";
import type { PrismIssuedProposalSummary, ReviewEventProposalInput } from "@prism/types";
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
  const [proposal, setProposal] = useState<PrismIssuedProposalSummary | null>(null);
  const eventId = selectedEvent?.id;
  const issuedDocumentId = latestIssuedProposal(documents)?.id;
  // Reload when the event changes or PMCM issues a newer version (a new issued document appears).
  useEffect(() => {
    if (!eventId) return;
    let current = true;
    setProposal(null);
    proposalReviewRepository.latest(eventId).then(
      (result) => { if (current) setProposal(result.proposal); },
      (caught: unknown) => {
        if (current) {
          setProposal(null);
          setError(caught instanceof Error ? caught.message : "Could not load the issued proposal. Refresh the page to try again.");
        }
      },
    );
    return () => { current = false; };
  }, [eventId, issuedDocumentId, setError]);
  const pendingDecision = useRef<ReturnType<typeof retainProposalDecisionKey> | null>(null);
  const issuedProposal = latestIssuedProposal(documents);
  const currentProposal = proposal?.eventId === eventId ? proposal : null;
  const packageReady = proposalPackageReady({ proposalIssued: Boolean(issuedProposal && currentProposal) });
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
    proposal: currentProposal,
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
