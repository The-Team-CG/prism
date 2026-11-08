import { describe, expect, it } from "vitest";
import { eventPlanningStatus } from "./event-planning-status";

describe("FR-05 planning status strip", () => {
  it("shows the proposal stage, revision rounds against the limit, floor plan and portal state", () => {
    const status = eventPlanningStatus({ proposalClientStatus: "revision_requested", proposalRevisionCount: 3, floorPlanStatus: "in_review", clientPortalStatus: "unlocked" });
    expect(status).toEqual([
      { label: "Proposal", value: "Revision requested" },
      { label: "Revision rounds", value: "3 of 3", warn: true },
      { label: "Floor plan", value: "Awaiting client approval" },
      { label: "Client portal", value: "Open" },
    ]);
    expect(eventPlanningStatus({ floorPlanStatus: "not_started", clientPortalStatus: "locked" })[0]).toEqual({ label: "Proposal", value: "Not issued" });
  });
});
