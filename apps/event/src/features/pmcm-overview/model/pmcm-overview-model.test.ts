import { describe, expect, it } from "vitest";
import type { PrismPmcmCalendarItem, PrismPmcmEventSummary } from "@prism/types";
import { eventAttentionLabels, fileSummaryLabel, financeSummaryLabel, messagesSummaryLabel, summariesByEvent } from "./event-summary-labels";
import { calendarWindow, toCalendarEntries } from "./pmcm-calendar-items";

const summary = (overrides: Partial<PrismPmcmEventSummary> = {}): PrismPmcmEventSummary => ({ eventId: "e1", balanceDue: 0, nextPaymentDue: null, overdueMilestones: 0, unreadMessages: 0, ...overrides });

describe("event list summaries", () => {
  it("says what an event owes, flags overdue milestones, and says nothing before the summary arrives", () => {
    expect(financeSummaryLabel(undefined)).toBeNull();
    expect(financeSummaryLabel(summary())).toEqual({ text: "Nothing owed" });
    expect(financeSummaryLabel(summary({ balanceDue: 260_000, nextPaymentDue: "2026-11-12" }))).toEqual({ text: expect.stringMatching(/^₱260,000 due · next Nov 12, 2026$/) });
    expect(financeSummaryLabel(summary({ balanceDue: 260_000, nextPaymentDue: "2026-10-01", overdueMilestones: 2 }))).toMatchObject({ urgent: true, text: expect.stringContaining("2 overdue") });
  });

  it("counts unread messages and marks them for attention", () => {
    expect(messagesSummaryLabel(summary())).toEqual({ text: "No unread messages" });
    expect(messagesSummaryLabel(undefined)).toEqual({ text: "No unread messages" });
    expect(messagesSummaryLabel(summary({ unreadMessages: 1 }))).toEqual({ text: "1 unread message", urgent: true });
    expect(messagesSummaryLabel(summary({ unreadMessages: 4 }))).toEqual({ text: "4 unread messages", urgent: true });
    expect(summariesByEvent([summary({ eventId: "e7" })]).get("e7")?.eventId).toBe("e7");
  });
});

describe("event attention labels", () => {
  it("lists only what needs the PMCM now, and nothing for an event that is in order or not yet loaded", () => {
    expect(eventAttentionLabels(undefined, undefined)).toEqual([]);
    expect(eventAttentionLabels(summary({ balanceDue: 90_000 }), { eventId: "e1", total: 8, open: 6, overdue: 0 })).toEqual([]);
    expect(eventAttentionLabels(summary({ overdueMilestones: 1, unreadMessages: 1 }), { eventId: "e1", total: 8, open: 6, overdue: 1 })).toEqual(["1 payment overdue", "1 file overdue", "1 unread message"]);
    expect(eventAttentionLabels(summary({ overdueMilestones: 3, unreadMessages: 5 }), { eventId: "e1", total: 8, open: 6, overdue: 4 })).toEqual(["3 payments overdue", "4 files overdue", "5 unread messages"]);
  });
});

describe("file summaries", () => {
  it("says how much file work is left, flags overdue, and says nothing for events the read did not cover", () => {
    expect(fileSummaryLabel(undefined)).toBeNull();
    expect(fileSummaryLabel({ eventId: "e1", total: 0, open: 0, overdue: 0 })).toBeNull();
    expect(fileSummaryLabel({ eventId: "e1", total: 8, open: 0, overdue: 0 })).toEqual({ text: "All requirements met" });
    expect(fileSummaryLabel({ eventId: "e1", total: 8, open: 6, overdue: 0 })).toEqual({ text: "6 of 8 requirements open" });
    expect(fileSummaryLabel({ eventId: "e1", total: 8, open: 6, overdue: 2 })).toEqual({ text: "6 of 8 requirements open · 2 overdue", urgent: true });
  });
});

describe("PMCM calendar entries", () => {
  const item = (overrides: Partial<PrismPmcmCalendarItem>): PrismPmcmCalendarItem => ({ id: "x", kind: "event", eventId: "e1", eventName: "Gala", date: "2026-11-20", detail: "Event day", ...overrides });

  it("headlines the event on its own day and leads other work with what is due, each opening where it is handled", () => {
    const [event, quote, payment, arrival] = toCalendarEntries([
      item({}),
      item({ id: "q", kind: "quote_deadline", detail: "XPERTO · Registration quote due" }),
      item({ id: "p", kind: "payment_due", detail: "Downpayment · ₱50,000 due" }),
      item({ id: "a", kind: "supplier_arrival", detail: "XPERTO arrives · Hall A", startTime: "06:00" }),
    ]);

    expect(event).toMatchObject({ title: "Gala", chipLabel: "Gala", detail: "Event day", target: "overview" });
    expect(quote).toMatchObject({ title: "XPERTO · Registration quote due", chipLabel: "Quote due", detail: "Gala", target: "suppliers" });
    expect(payment).toMatchObject({ chipLabel: "Payment due", target: "billing" });
    expect(arrival).toMatchObject({ startTime: "06:00", target: "suppliers" });
  });

  it("loads the visible dates widened to whole months plus the month on each side", () => {
    // November's grid runs Nov 1 to Dec 5, so the window is October through January.
    expect(calendarWindow({ from: "2026-11-01", to: "2026-12-05" })).toEqual({ from: "2026-10-01", to: "2027-01-31" });
    expect(calendarWindow({ from: "2026-12-30", to: "2026-12-30" })).toEqual({ from: "2026-11-01", to: "2027-01-31" });
    expect(calendarWindow({ from: "2028-03-10", to: "2028-03-10" })).toEqual({ from: "2028-02-01", to: "2028-04-30" });
  });
});
