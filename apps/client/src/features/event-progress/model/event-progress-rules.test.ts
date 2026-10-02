import { describe, expect, it } from "vitest";
import type { PrismClientEventTimeline, PrismClientWorkspace, PrismEvent } from "@prism/types";
import { computeEventProgress, deriveCheckpoints, deriveTimeline } from "./event-progress-rules";

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
  it("keeps documents detail independent of completion", () => {
    const incomplete = deriveCheckpoints(
      event,
      workspace({
        documents: [
          { id: "d1", eventId: "evt_1", status: "pending_review" },
          { id: "d2", eventId: "evt_1", status: "approved" },
        ],
      } as Partial<PrismClientWorkspace>),
    ).find((item) => item.id === "documents");

    expect(incomplete).toMatchObject({
      done: false,
      detail: "2 files uploaded",
      status: "attention",
    });

    const empty = deriveCheckpoints(event, workspace()).find((item) => item.id === "documents");
    expect(empty).toMatchObject({
      done: false,
      detail: "No documents uploaded yet",
    });
  });

  it("uses billing status copy when a statement exists but is unpaid", () => {
    const billed = deriveCheckpoints(
      event,
      workspace({
        billingStatements: [{ id: "b1", eventId: "evt_1", status: "issued" }],
      } as Partial<PrismClientWorkspace>),
    ).find((item) => item.id === "billing");

    expect(billed).toMatchObject({
      done: false,
      detail: "Status: issued",
    });

    const unpaidMilestone = deriveCheckpoints(
      event,
      workspace({
        billingStatements: [{ id: "b1", eventId: "evt_1", status: "awaiting_payment" }],
        paymentMilestones: [{ id: "p1", eventId: "evt_1", status: "pending" }],
      } as Partial<PrismClientWorkspace>),
    ).find((item) => item.id === "billing");

    expect(unpaidMilestone).toMatchObject({
      done: false,
      detail: "Status: awaiting payment",
    });
  });

  it("uses only the selected event's five persisted milestones", () => {
    const selectedTimeline: PrismClientEventTimeline = {
      eventId: "evt_1",
      milestones: [
        { key: "conforme_signed", date: "2026-06-01", status: "completed" },
        { key: "proposal_accepted", date: "2026-06-05", status: "completed" },
        { key: "floor_plan_approved", date: null, status: "current" },
        { key: "balance_payment_due", date: "2026-08-15", status: "pending" },
        { key: "event_date", date: "2026-10-01", status: "pending" },
      ],
    };
    const otherTimeline: PrismClientEventTimeline = {
      ...selectedTimeline,
      eventId: "evt_other",
      milestones: [
        { key: "conforme_signed", date: "1999-01-01", status: "pending" },
        selectedTimeline.milestones[1],
        selectedTimeline.milestones[2],
        selectedTimeline.milestones[3],
        selectedTimeline.milestones[4],
      ],
    };

    const steps = deriveTimeline(
      event,
      workspace({ clientEventTimelines: [otherTimeline, selectedTimeline] }),
    );

    expect(steps).toHaveLength(5);
    expect(steps.map((step) => [step.id, step.title, step.status, step.meta])).toEqual([
      ["conforme_signed", "Conforme signed", "completed", "2026-06-01"],
      ["proposal_accepted", "Proposal accepted", "completed", "2026-06-05"],
      ["floor_plan_approved", "Floor plan approved", "current", "Date pending"],
      ["balance_payment_due", "Balance payment due", "pending", "2026-08-15"],
      ["event_date", "Event date", "pending", "2026-10-01"],
    ]);
  });

  it("gates the generic live status on the selected event's saved flag and event-day state", () => {
    const enabledDuringEvent = computeEventProgress(
      { ...event, status: "event_day", clientEventDayViewEnabled: true },
      workspace(),
    );
    const disabledDuringEvent = computeEventProgress(
      { ...event, status: "event_day", clientEventDayViewEnabled: false },
      workspace(),
    );
    const enabledBeforeEvent = computeEventProgress(
      { ...event, status: "planning", clientEventDayViewEnabled: true },
      workspace(),
    );

    expect(enabledDuringEvent.clientEventDayStatus).toBe("Event day is in progress.");
    expect(disabledDuringEvent.clientEventDayStatus).toBeNull();
    expect(enabledBeforeEvent.clientEventDayStatus).toBeNull();
  });
});
