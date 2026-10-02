/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismEventDecision } from "@prism/types";
import { PostponementImpactPanel } from "./postponement-impact-panel";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../data/event-decision-repository", () => ({
  eventDecisionRepository: { list },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function decision(overrides: Partial<PrismEventDecision> & Pick<PrismEventDecision, "id" | "decision" | "decidedAt">): PrismEventDecision {
  return {
    eventId: "evt_1",
    reason: "Venue unavailable",
    actorId: "pmcm_1",
    actorRole: "pmcm_admin",
    actorName: "PMCM Admin",
    actorEmail: null,
    priorState: { status: "planning", eventDate: "2026-11-10T00:00:00.000Z" },
    financialImpact: {},
    assignmentImpact: {
      releasedAssignmentIds: [],
      priorAssignments: [],
      reschedule: {
        toDate: "2026-12-10T00:00:00.000Z",
        assignmentIds: ["assignment_1", "assignment_2"],
        conflicts: [
          { assignmentId: "assignment_1", coordinatorName: "Rhea Santos", reason: "double_booking", conflictEventName: "Charity Gala" },
          { assignmentId: "assignment_2", coordinatorName: "Taylor Lee", reason: "unavailable" },
        ],
      },
    },
    supplierImpact: "preserve_obligations",
    idempotencyKey: null,
    ...overrides,
  };
}

describe("PostponementImpactPanel", () => {
  it("lists booking and declared-availability conflicts from the latest postponement", async () => {
    list.mockResolvedValue([
      decision({ id: "old", decision: "postponed", decidedAt: "2026-09-01T10:00:00.000Z" }),
      decision({ id: "current", decision: "postponed", decidedAt: "2026-09-02T10:00:00.000Z" }),
    ]);

    render(<PostponementImpactPanel eventId="evt_1" />);

    expect(await screen.findByText("Rhea Santos")).toBeTruthy();
    expect(screen.getByText("Taylor Lee")).toBeTruthy();
    expect(screen.getByText("Already assigned to Charity Gala on that date.")).toBeTruthy();
    expect(screen.getByText("Declared unavailable on that date.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review assignments in the coordinator desk" }).getAttribute("href")).toBe("#coordinator-assignment-desk");
  });

  it("keeps the conflict snapshot visible while a later decision leaves the event date unconfirmed", async () => {
    list.mockResolvedValue([
      decision({ id: "old", decision: "postponed", decidedAt: "2026-09-01T10:00:00.000Z" }),
      decision({
        id: "current",
        decision: "date_to_be_confirmed",
        decidedAt: "2026-09-02T10:00:00.000Z",
        assignmentImpact: { releasedAssignmentIds: [], priorAssignments: [] },
      }),
    ]);

    render(<PostponementImpactPanel eventId="evt_1" />);

    expect(await screen.findByText("Rhea Santos")).toBeTruthy();
    expect(screen.getByText(/event date is still being confirmed/i)).toBeTruthy();
    expect(screen.getAllByText("Conflict recorded")).toHaveLength(2);
  });
});
