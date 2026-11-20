"use client";

import { useEffect, useRef, useState } from "react";
import type { PrismIssuedProposalSummary, ProposalRevisionArea, ReviewEventProposalInput } from "@prism/types";
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

export type ProposalDecisionDialog = "approve" | "revise" | null;

export function useClientProposalTabViewModel() {
  const { selectedEvent, briefing, documents, refresh, setNotice, setError, setBusy, busy } = useClientWorkspace();
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionAreas, setRevisionAreas] = useState<ProposalRevisionArea[]>([]);
  const [dialog, setDialog] = useState<ProposalDecisionDialog>(null);
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
  const isDecider = currentProposal?.decider.isYou ?? false;
  const event = selectedEvent;

  async function submit(action: ReviewEventProposalInput["action"]) {
    if (!event || !issuedProposal || busy) return;
    if (action === "approve" ? !canApproveProposal(event, packageReady, isDecider) : !canRequestProposalRevision(event, packageReady, isDecider)) return;
    setBusy("proposal-review");
    setError(null);
    try {
      const decision = retainProposalDecisionKey(pendingDecision.current, {
        eventId: event.id, documentId: issuedProposal.id, action, revisionNote, revisionAreas,
      }, () => crypto.randomUUID());
      pendingDecision.current = decision;
      const input: ReviewEventProposalInput = {
        action,
        idempotencyKey: decision.key,
        ...(action === "request_revision" ? { revisionNote: decision.revisionNote, revisionAreas: decision.revisionAreas } : {}),
      };
      await proposalReviewRepository.review(event.id, input);
      pendingDecision.current = null;
      setRevisionNote("");
      setRevisionAreas([]);
      setDialog(null);
      setNotice(action === "approve"
        ? "You approved the proposal. PMCM is now planning your event with this version."
        : "Your change request is with PMCM. They'll send a new version for you to review.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record your decision. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return {
    selectedEvent: event,
    proposal: currentProposal,
    packageReady,
    /** PMCM prices the package from the briefing, so a missing briefing is what holds the proposal up. */
    needsBriefing: !briefing,
    headline: event ? proposalReviewHeadline(event, packageReady) : "Proposal",
    isDecider,
    decider: currentProposal?.decider ?? null,
    revisionNote,
    setRevisionNote,
    revisionAreas,
    toggleRevisionArea: (area: ProposalRevisionArea, on: boolean) =>
      setRevisionAreas((current) => (on ? [...new Set([...current, area])] : current.filter((value) => value !== area))),
    dialog,
    setDialog,
    reviewing: busy === "proposal-review",
    canApprove: event ? canApproveProposal(event, packageReady, isDecider) : false,
    canRequestRevision: event ? canRequestProposalRevision(event, packageReady, isDecider) : false,
    remainingRevisions: event ? remainingProposalRevisions(event) : 0,
    approve: () => submit("approve"),
    requestRevision: () => submit("request_revision"),
  };
}

export type ClientProposalTabViewModel = ReturnType<typeof useClientProposalTabViewModel>;
