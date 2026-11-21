import { describe, expect, it } from "vitest";
import type { PrismClientEventTimeline, PrismClientWorkspace, PrismEvent } from "@prism/types";
import { computeEventProgress, deriveLifecycleIndex, deriveMilestones } from "./event-progress-rules";

const event: PrismEvent = {
  id: "evt_1",
  inquiryId: "inq_1",
  clientName: "Ana Reyes",
  eventName: "Summit",
  eventDate: "2026-08-01",
  status: "planning",
  clientPortalStatus: "unlocked",
  readiness: "open",
  archived: false,
  floorPlanStatus: "draft",
  floorPlanId: "plan_1",
};

function workspace(overrides: Partial<PrismClientWorkspace> = {}): PrismClientWorkspace {
  return {
    events: [event],
    clientEventTimelines: [],
    briefings: [],
    documents: [],
    billingStatements: [],
    floorPlanDrafts: [],
    supplierQuotes: [],
    paymentMilestones: [],
    coordinatorAssignments: [],
    ...overrides,
  } as PrismClientWorkspace;
}

describe("event-progress-rules", () => {
  it("uses the shared stage: Planning only once the client approves the proposal", () => {
    expect(deriveLifecycleIndex({ ...event, status: "briefing" })).toBe(2);
    expect(deriveLifecycleIndex({ ...event, status: "briefing", proposalClientStatus: "approved" })).toBe(3);
    // The fixture's operational status is "planning" (briefing submitted); that alone is not Planning.
    expect(deriveLifecycleIndex(event)).toBe(2);
    expect(deriveLifecycleIndex({ ...event, clientPortalStatus: "locked" })).toBe(1);
  });

  it("lists every milestone once, in order, with the first unfinished one next and a passed due date late", () => {
    const timeline: PrismClientEventTimeline = {
      eventId: "evt_1",
      milestones: [
        { key: "conforme_signed", date: "2026-06-01", status: "completed" },
        { key: "proposal_accepted", date: null, status: "current" },
        { key: "floor_plan_approved", date: null, status: "pending" },
        { key: "balance_payment_due", date: "2026-07-15", status: "pending" },
        { key: "event_date", date: "2026-08-01", status: "pending" },
      ],
      confirmedSupplierCount: 0,
    };
    const other: PrismClientEventTimeline = { ...timeline, eventId: "evt_other", milestones: timeline.milestones.map((m) => ({ ...m, status: "completed" })) as PrismClientEventTimeline["milestones"] };
    const milestones = deriveMilestones(event, workspace({
      clientEventTimelines: [other, timeline],
      briefings: [{ eventId: "evt_1", submittedAt: "2026-06-03T07:40:45.687Z" }],
    } as Partial<PrismClientWorkspace>), "2026-07-20");

    expect(milestones.map((m) => [m.kind, m.state, m.date])).toEqual([
      ["conforme", "done", "2026-06-01"],
      ["briefing", "done", "2026-06-03T07:40:45.687Z"],
      ["proposal", "next", null],
      ["floorplan", "upcoming", null],
      ["suppliers", "upcoming", null],
      ["payment", "late", "2026-07-15"],
      ["event", "upcoming", "2026-08-01"],
    ]);
    expect(milestones.find((m) => m.kind === "suppliers")?.detail).toBe("PMCM books them during planning");

    // Booked suppliers come from the client timeline count; the other event's bookings do not count.
    const booked = deriveMilestones(event, workspace({
      clientEventTimelines: [{ ...other, confirmedSupplierCount: 5 }, { ...timeline, confirmedSupplierCount: 2 }],
    } as Partial<PrismClientWorkspace>), "2026-07-20").find((m) => m.kind === "suppliers");
    expect(booked).toMatchObject({ state: "done", detail: "2 suppliers booked" });
  });

  it("gates the generic live status on the selected event's saved flag and event-day state", () => {
    const enabledDuringEvent = computeEventProgress(
      { ...event, status: "event_day", clientEventDayViewEnabled: true },
      workspace(),
      "2026-07-01",
    );
    const disabledDuringEvent = computeEventProgress(
      { ...event, status: "event_day", clientEventDayViewEnabled: false },
      workspace(),
      "2026-07-01",
    );
    const enabledBeforeEvent = computeEventProgress(
      { ...event, status: "planning", clientEventDayViewEnabled: true },
      workspace(),
      "2026-07-01",
    );

    expect(enabledDuringEvent.clientEventDayStatus).toBe("Event day is in progress.");
    expect(disabledDuringEvent.clientEventDayStatus).toBeNull();
    expect(enabledBeforeEvent.clientEventDayStatus).toBeNull();
  });
});
