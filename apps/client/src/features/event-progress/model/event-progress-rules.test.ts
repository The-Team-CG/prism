import { describe, expect, it } from "vitest";
import type { PrismClientWorkspace, PrismEvent } from "@prism/types";
import { deriveCheckpoints, deriveTimeline } from "./event-progress-rules";

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

  it("marks briefing timeline current after portal unlock even before briefing exists", () => {
    const steps = deriveTimeline(event, workspace());
    const briefing = steps.find((step) => step.id === "briefing");
    expect(briefing).toMatchObject({
      status: "current",
      description: "Awaiting event details",
    });
    expect(steps.find((step) => step.id === "conforme")?.status).toBe("completed");
  });
});
