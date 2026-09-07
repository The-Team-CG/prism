import { describe, expect, it } from "vitest";
import type { PrismEvent } from "@prism/types";
import {
  canApproveProposal,
  canRequestProposalRevision,
  proposalPackageReady,
  remainingProposalRevisions,
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
  it("requires briefing and billing before client review", () => {
    expect(proposalPackageReady({})).toBe(false);
    expect(proposalPackageReady({ briefing: {}, billing: {} })).toBe(true);
  });

  it("blocks approve after the primary contact already approved", () => {
    expect(canApproveProposal(event(), true)).toBe(true);
    expect(canApproveProposal(event({ proposalClientStatus: "approved" }), true)).toBe(false);
  });

  it("caps revisions at three", () => {
    expect(remainingProposalRevisions(event({ proposalRevisionCount: 2 }))).toBe(1);
    expect(canRequestProposalRevision(event({ proposalRevisionCount: 3 }), true)).toBe(false);
  });
});
