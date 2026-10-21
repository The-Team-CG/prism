import { describe, expect, it } from "vitest";
import {
  buildFloorPlanRevisionPayload,
  canRequestFloorPlanRevision,
  floorPlanRevisionComment,
  floorPlanReviewHeadline,
  floorPlanRevisionSubmittedNote,
} from "./client-floorplan-review-rules";
import type { PrismEvent, PrismFloorPlanDraft } from "@prism/types";

function draftWith(status: PrismFloorPlanDraft["status"], revisionComment = ""): PrismFloorPlanDraft {
  return {
    id: "fpd_review",
    eventId: "evt_sample",
    floorPlanId: "plan_sample",
    name: "Official Layout",
    status,
    isActive: false,
    sourceType: "blank",
    createdByRole: "pmcm-admin",
    revisionComment,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

const unlockedEvent = {
  id: "evt_sample",
  clientPortalStatus: "unlocked",
  archived: false,
} as PrismEvent;

describe("floorplan revision comment rules", () => {
  it("builds a parsed revision comment payload", () => {
    const payload = buildFloorPlanRevisionPayload("   Move the mingle space near the bar.  ");
    expect(payload).toEqual({ revisionNote: "Move the mingle space near the bar." });
  });

  it("allows revision comments only for an in-review draft on an unlocked event", () => {
    expect(canRequestFloorPlanRevision(draftWith("in_review"), unlockedEvent)).toBe(true);
    expect(canRequestFloorPlanRevision(draftWith("approved"), unlockedEvent)).toBe(false);
    expect(canRequestFloorPlanRevision(draftWith("revision_requested"), unlockedEvent)).toBe(false);
    expect(canRequestFloorPlanRevision(draftWith("in_review"), { ...unlockedEvent, clientPortalStatus: "locked" })).toBe(false);
    expect(canRequestFloorPlanRevision(draftWith("in_review"), { ...unlockedEvent, archived: true })).toBe(false);
    expect(canRequestFloorPlanRevision(undefined, unlockedEvent)).toBe(false);
  });

  it("reads the stored revision comment once submitted", () => {
    expect(floorPlanRevisionComment(draftWith("revision_requested", "  Please resite registration.  "))).toBe("Please resite registration.");
    expect(floorPlanRevisionComment(draftWith("in_review"))).toBeNull();
  });

  it("headlines according to draft state", () => {
    expect(floorPlanReviewHeadline(draftWith("revision_requested"))).toContain("revision comment was sent");
    expect(floorPlanReviewHeadline(draftWith("approved"))).toContain("approved and locked");
    expect(floorPlanReviewHeadline(draftWith("in_review"))).toContain("request changes");
    expect(floorPlanReviewHeadline(undefined)).toContain("PMCM is working");
  });

  it("describes the submitted revision note", () => {
    expect(floorPlanRevisionSubmittedNote(draftWith("revision_requested", "Move the bar"))).toBe(
      'You asked PMCM to revise the plan: "Move the bar"',
    );
    expect(floorPlanRevisionSubmittedNote(draftWith("in_review"))).toBeNull();
  });
});