import { describe, expect, it } from "vitest";
import type { PrismClientEventTimeline } from "@prism/types";
import { buildClientCalendarItems, clientCalendarKind } from "./client-calendar-items";

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

  it("names the event on every entry but the event day itself", () => {
    expect(buildClientCalendarItems(state, events).map((item) => [item.title, item.eventName])).toEqual([
      ["Layout approved", "Ayala Tech Summit"],
      ["Site visit", "Ayala Tech Summit"],
      ["Balance", "Ayala Tech Summit"],
      ["Ayala Tech Summit", undefined],
      ["Year-end party", undefined],
    ]);
  });

  it("opens older calendar links on their kind of date, and the plain calendar on everything", () => {
    expect(clientCalendarKind("calendar-meetings")).toBe("visit");
    expect(clientCalendarKind("calendar-deadlines")).toBe("payment");
    expect(clientCalendarKind("calendar-payment-due-dates")).toBe("payment");
    expect(clientCalendarKind("calendar-approval-deadlines")).toBe("approval");
    expect(clientCalendarKind("calendar")).toBeUndefined();
    expect(clientCalendarKind(undefined)).toBeUndefined();
  });

  it("labels each payment paid, late or due, and marks a late one overdue with what is still owed", () => {
    const withPaid = {
      ...state,
      paymentMilestones: [
        { ...state.paymentMilestones[0], amount: 300000, remainingBalance: 120000 },
        { id: "pay_deposit", eventId: "evt_1", label: "Deposit", dueDate: "2026-10-01", status: "paid", amount: 100000, remainingBalance: 0 },
      ],
    } as typeof state;
    const payments = (today: string) => buildClientCalendarItems(withPaid, events, today).filter((item) => item.kind === "payment");
    const labels = (today: string) => payments(today).map((item) => [item.chipLabel, item.look?.chip.split(" ")[1], Boolean(item.overdue)]);
    expect(labels("2026-11-15")).toEqual([["Deposit paid", "text-success", false], ["Balance due", "text-attention", false]]);
    expect(labels("2026-12-01")).toEqual([["Deposit paid", "text-success", false], ["Balance late", "text-danger", true]]);
    expect(payments("2026-12-01")[1]).toMatchObject({ amount: 300000, remaining: 120000 });
  });
});
