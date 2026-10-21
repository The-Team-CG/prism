import { describe, expect, it } from "vitest";
import type { PrismEvent } from "@prism/types";
import {
  canApproveProposal,
  canRequestProposalRevision,
  proposalPackageReady,
  remainingProposalRevisions,
  retainProposalDecisionKey,
} from "./proposal-review-rules";

const event = (overrides: Partial<PrismEvent> = {}): PrismEvent =>
  ({
    id: "evt_1",
    inquiryId: "inq_1",
    clientName: "Ayala",
    eventName: "Forum",
    eventDate: "2026-06-18",
    status: "planning",
    clientPortalStatus: "unlocked",
    readiness: "ready",
    archived: false,
    floorPlanStatus: "not_started",
    ...overrides,
  }) as PrismEvent;

describe("proposal-review-rules", () => {
  it("requires an issued proposal in addition to briefing and billing", () => {
    expect(proposalPackageReady({})).toBe(false);
    expect(proposalPackageReady({ briefing: {}, billing: {} })).toBe(false);
    expect(proposalPackageReady({ briefing: {}, billing: {}, proposalIssued: true })).toBe(true);
  });

  it("blocks approve after the primary contact already approved", () => {
    expect(canApproveProposal(event(), true)).toBe(true);
    expect(canApproveProposal(event({ proposalClientStatus: "approved" }), true)).toBe(false);
  });

  it("caps revisions at three", () => {
    expect(remainingProposalRevisions(event({ proposalRevisionCount: 2 }))).toBe(1);
    expect(canRequestProposalRevision(event({ proposalRevisionCount: 3 }), true)).toBe(false);
  });

  it("keeps the same key after a lost response, including equivalent trimmed notes", () => {
    const input = { eventId: 'event_1', documentId: 'proposal_v1', action: 'request_revision' as const, revisionNote: ' Adjust scope ' };
    const pending = retainProposalDecisionKey(null, input, () => 'first-key');
    const retry = retainProposalDecisionKey(pending, { ...input, revisionNote: 'Adjust scope' }, () => 'must-not-be-used');
    expect(retry.key).toBe('first-key');
    expect(retry.revisionNote).toBe('Adjust scope');
  });

  it.each([
    { eventId: 'event_2' }, { documentId: 'proposal_v2' },
    { action: 'approve' as const }, { revisionNote: 'Different decision' },
  ])("uses a new key for a different decision identity: %j", (change) => {
    const input = { eventId: 'event_1', documentId: 'proposal_v1', action: 'request_revision' as const, revisionNote: 'Adjust scope' };
    const pending = retainProposalDecisionKey(null, input, () => 'first-key');
    expect(retainProposalDecisionKey(pending, { ...input, ...change }, () => 'new-key').key).toBe('new-key');
  });

  it("denies client actions after locking or archive", () => {
    expect(canApproveProposal(event({ archived: true }), true)).toBe(false);
    expect(canRequestProposalRevision(event({ clientPortalStatus: 'locked' }), true)).toBe(false);
  });
});
