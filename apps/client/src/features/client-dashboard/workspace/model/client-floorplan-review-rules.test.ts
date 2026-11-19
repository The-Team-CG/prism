import { describe, expect, it } from "vitest";
import {
  floorPlanRevisionComment,
  clientVisibleOfficialPlan,
  officialPlanStatusLine,
  selectClientFloorPlanLayout,
} from "./client-floorplan-review-rules";
import type { PrismFloorPlanDraft } from "@prism/types";

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

describe("floorplan revision comment rules", () => {
  it("reads the stored revision comment once submitted", () => {
    expect(floorPlanRevisionComment(draftWith("revision_requested", "  Please resite registration.  "))).toBe("Please resite registration.");
    expect(floorPlanRevisionComment(draftWith("in_review"))).toBeNull();
  });
});

describe("official floorplan first", () => {
  it("leads with the plan PMCM approved or sent for review, never an internal draft", () => {
    expect(clientVisibleOfficialPlan(draftWith("pmcm_draft"))).toBeUndefined();
    expect(clientVisibleOfficialPlan(undefined)).toBeUndefined();
    expect(clientVisibleOfficialPlan(draftWith("approved"))?.status).toBe("approved");
  });

  it("keeps the client's own preference in a separate card under the official plan", () => {
    const official = { ...draftWith("approved"), sourceType: "template" };
    const preference = { ...draftWith("client_submitted"), id: "fpd_pref", sourceType: "client_preference" };
    expect(selectClientFloorPlanLayout(official, [preference])).toMatchObject({ officialPlan: official, activeDraft: preference, isOfficial: false, approved: true });
    // With nothing of the client's own to show, only the official plan appears.
    expect(selectClientFloorPlanLayout(official, [])).toMatchObject({ showPreferenceCard: false });
    // Approve and revise are offered only while the submitted version awaits the client; an approved plan has none.
    expect(selectClientFloorPlanLayout(official, [])).toMatchObject({ showReview: false });
    expect(selectClientFloorPlanLayout({ ...draftWith("in_review"), sourceType: "template" }, [])).toMatchObject({ showReview: true });
    // Before PMCM shares a plan, the page works from the client's preference alone.
    expect(selectClientFloorPlanLayout(undefined, [preference])).toMatchObject({ officialPlan: undefined, activeDraft: preference, showPreferenceCard: true });
  });

  it("states where the official plan stands and the date it got there", () => {
    expect(officialPlanStatusLine({ ...draftWith("approved"), approvedAt: "2026-10-03T02:00:00.000Z" })).toMatch(/^Approved (3 Oct|Oct 3,) 2026$/);
    expect(officialPlanStatusLine({ ...draftWith("in_review"), submittedAt: "2026-10-01T02:00:00.000Z" })).toMatch(/^Sent for your review (1 Oct|Oct 1,) 2026$/);
  });
});
