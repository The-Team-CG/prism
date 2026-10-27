import { describe, expect, it } from "vitest";
import type { PrismClientEventTimeline } from "@prism/types";
import { buildClientCalendarItems } from "./client-calendar-items";

const events = [
  { id: "evt_1", eventName: "Ayala Tech Summit", eventDate: "2026-12-10", status: "planning" },
  { id: "evt_2", eventName: "Year-end party", eventDate: "2026-12-18", status: "planning" },
];

function timeline(eventId: string, layoutDate: string | null, status: "completed" | "pending"): PrismClientEventTimeline {
  return {
    eventId,
    milestones: [
      { key: "conforme_signed", date: "2026-09-01", status: "completed" },
      { key: "proposal_accepted", date: "2026-09-10", status: "completed" },
      { key: "floor_plan_approved", date: layoutDate, status },
      { key: "balance_payment_due", date: null, status: "pending" },
      { key: "event_date", date: "2026-12-10", status: "pending" },
    ],
  };
}

const state = {
  paymentMilestones: [
    { id: "pay_1", eventId: "evt_1", label: "Balance", dueDate: "2026-11-30", status: "pending" },
    { id: "pay_other", eventId: "evt_other", label: "Not this client", dueDate: "2026-11-01", status: "pending" },
  ],
  ocularVisits: [
    { eventId: "evt_1", status: "scheduled", clientNote: null, requestedAt: "2026-10-01", scheduledAt: "2026-10-20T09:00:00.000Z" },
    { eventId: "evt_2", status: "requested", clientNote: null, requestedAt: "2026-10-02", scheduledAt: null },
  ],
  clientEventTimelines: [timeline("evt_1", "2026-10-05", "completed"), timeline("evt_2", null, "pending")],
} as unknown as Parameters<typeof buildClientCalendarItems>[0];

describe("buildClientCalendarItems", () => {
  it("shows only recorded dates, never deadlines inferred from the event date", () => {
    const items = buildClientCalendarItems(state, events);
    expect(items.map((item) => `${item.date} ${item.title}`)).toEqual([
      "2026-10-05 Layout approved",
      "2026-10-20 Site visit",
      "2026-11-30 Balance",
      "2026-12-10 Ayala Tech Summit",
      "2026-12-18 Year-end party",
    ]);
  });

  it("filters to the kind each calendar view names", () => {
    expect(buildClientCalendarItems(state, events, "calendar-meetings").map((item) => item.title)).toEqual(["Site visit"]);
    expect(buildClientCalendarItems(state, events, "calendar-deadlines").map((item) => item.title)).toEqual(["Balance"]);
    expect(buildClientCalendarItems(state, events, "calendar-approval-deadlines").map((item) => item.title)).toEqual(["Layout approved"]);
  });
});
