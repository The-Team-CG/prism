import { describe, expect, it } from "vitest";
import { effectivePostponementSnapshot, rescheduleDateLabel } from "./postponement-impact-rules";
import type { PrismEventDecision } from "@prism/types";

function decision(overrides: Partial<PrismEventDecision> & Pick<PrismEventDecision, "id" | "decidedAt" | "decision">): PrismEventDecision {
  return {
    eventId: "evt_1",
    reason: "Venue change",
    actorId: "pmcm_1",
    actorRole: "pmcm_admin",
    actorName: "PMCM Admin",
    actorEmail: null,
    priorState: { status: "planning", eventDate: "2026-11-10T00:00:00.000Z" },
    financialImpact: {},
    assignmentImpact: { releasedAssignmentIds: [], priorAssignments: [] },
    supplierImpact: "preserve_obligations",
    idempotencyKey: null,
    ...overrides,
  };
}

describe("postponement impact rules", () => {
  it("keeps the conflict snapshot while the new event date is still being confirmed", () => {
    const earlier = decision({
      id: "d1",
      decision: "postponed",
      decidedAt: "2026-09-01T10:00:00.000Z",
      assignmentImpact: {
        releasedAssignmentIds: [],
        priorAssignments: [],
        reschedule: { toDate: "2026-12-10T00:00:00.000Z", assignmentIds: ["a1"], conflicts: [] },
      },
    });
    const latest = decision({ id: "d2", decision: "date_to_be_confirmed", decidedAt: "2026-09-02T10:00:00.000Z" });

    expect(effectivePostponementSnapshot([earlier, latest])).toMatchObject({
      snapshotDecision: earlier,
      latestDecision: latest,
      dateNeedsConfirmation: true,
    });
  });

  it("uses a later reschedule and clears conflicts when a later decision releases them", () => {
    const first = decision({
      id: "d1",
      decision: "postponed",
      decidedAt: "2026-09-01T10:00:00.000Z",
      assignmentImpact: {
        releasedAssignmentIds: [],
        priorAssignments: [],
        reschedule: { toDate: "2026-12-10T00:00:00.000Z", assignmentIds: ["a1"], conflicts: [] },
      },
    });
    const next = decision({
      id: "d2",
      decision: "postponed",
      decidedAt: "2026-09-02T10:00:00.000Z",
      assignmentImpact: {
        releasedAssignmentIds: [],
        priorAssignments: [],
        reschedule: { toDate: "2027-01-10T00:00:00.000Z", assignmentIds: ["a1"], conflicts: [] },
      },
    });
    const release = decision({
      id: "d3",
      decision: "date_to_be_confirmed",
      decidedAt: "2026-09-03T10:00:00.000Z",
      assignmentImpact: { releasedAssignmentIds: ["a1"], priorAssignments: [] },
    });

    expect(effectivePostponementSnapshot([first, next])?.snapshotDecision).toBe(next);
    expect(effectivePostponementSnapshot([first, next, release])).toBeNull();
  });

  it("clears all snapshots after cancellation", () => {
    const postponed = decision({
      id: "d1",
      decision: "postponed",
      decidedAt: "2026-09-01T10:00:00.000Z",
      assignmentImpact: {
        releasedAssignmentIds: [],
        priorAssignments: [],
        reschedule: { toDate: "2026-12-10T00:00:00.000Z", assignmentIds: ["a1"], conflicts: [] },
      },
    });
    const cancelled = decision({ id: "d2", decision: "cancelled", decidedAt: "2026-09-02T10:00:00.000Z" });

    expect(effectivePostponementSnapshot([postponed, cancelled])).toBeNull();
  });

  it("formats the date that kept coordinator assignments were moved to", () => {
    expect(rescheduleDateLabel("2026-12-10T00:00:00.000Z")).toBe("Dec 10, 2026");
    expect(rescheduleDateLabel("not-a-date")).toBe("not-a-date");
  });
});
