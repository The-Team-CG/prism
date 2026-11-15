import { describe, expect, it } from "vitest";
import type { PrismPmcmCalendarItem, PrismPmcmEventSummary } from "@prism/types";
import { eventShortcutCounts, fileSummaryLabel, summariesByEvent } from "./event-summary-labels";
import { calendarWindow, toCalendarEntries } from "./pmcm-calendar-items";
import { clientActivityLine, eventComingUp } from "./event-overview-glance";

const summary = (overrides: Partial<PrismPmcmEventSummary> = {}): PrismPmcmEventSummary => ({ eventId: "e1", balanceDue: 0, nextPaymentDue: null, overdueMilestones: 0, unreadMessages: 0, ...overrides });

describe("event list summaries", () => {
  it("finds an event's summary by its id", () => {
    expect(summariesByEvent([summary({ eventId: "e7" })]).get("e7")?.eventId).toBe("e7");
  });
});

describe("event card shortcut counts", () => {
  it("counts overdue payments, open file requirements and unread messages, and leaves out what has not loaded", () => {
    expect(eventShortcutCounts(undefined, undefined)).toEqual({ billing: undefined, files: undefined, messages: undefined });
    expect(eventShortcutCounts(summary({ overdueMilestones: 2, unreadMessages: 5 }), { eventId: "e1", total: 8, open: 3, overdue: 1 })).toEqual({ billing: 2, files: 3, messages: 5 });
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
    const [event, quote, payment, arrival, late] = toCalendarEntries([
      item({}),
      item({ id: "q", kind: "quote_deadline", detail: "XPERTO · Registration quote due" }),
      item({ id: "p", kind: "payment_due", detail: "Downpayment · ₱50,000 due" }),
      item({ id: "a", kind: "supplier_arrival", detail: "XPERTO arrives · Hall A", startTime: "06:00" }),
      item({ id: "l", kind: "payment_due", date: "2026-11-01", detail: "Balance · ₱20,000 due" }),
    ], "2026-11-15");

    expect(event).toMatchObject({ title: "Gala", chipLabel: "Gala", detail: "Event day", target: "overview" });
    expect(quote).toMatchObject({ title: "XPERTO · Registration quote due", chipLabel: "Quote due", detail: "Gala", target: "suppliers" });
    expect(payment).toMatchObject({ chipLabel: "Payment due", target: "billing", look: { chip: expect.stringContaining("text-attention") } });
    expect(late).toMatchObject({ chipLabel: "Payment late", look: { chip: expect.stringContaining("text-danger") } });
    expect(arrival).toMatchObject({ startTime: "06:00", target: "suppliers" });
  });

  it("loads the visible dates widened to whole months plus the month on each side", () => {
    // November's grid runs Nov 1 to Dec 5, so the window is October through January.
    expect(calendarWindow({ from: "2026-11-01", to: "2026-12-05" })).toEqual({ from: "2026-10-01", to: "2027-01-31" });
    expect(calendarWindow({ from: "2026-12-30", to: "2026-12-30" })).toEqual({ from: "2026-11-01", to: "2027-01-31" });
    expect(calendarWindow({ from: "2028-03-10", to: "2028-03-10" })).toEqual({ from: "2028-02-01", to: "2028-04-30" });
  });
});

describe("an event's overview at a glance", () => {
  it("says when the client last opened the portal and what they have not read, and flags a client gone quiet", () => {
    const today = "2026-11-16";
    expect(clientActivityLine("Ana Reyes", { eventId: "e1", lastActiveAt: "2026-11-11T02:00:00.000Z", unreadNotices: 2 }, today))
      .toEqual({ text: "Ana Reyes last opened the portal 5 days ago · 2 notices unread", quiet: false });
    expect(clientActivityLine("Ana Reyes", { eventId: "e1", lastActiveAt: "2026-11-16T01:00:00.000Z", unreadNotices: 0 }, today))
      .toEqual({ text: "Ana Reyes opened the portal today", quiet: false });
    expect(clientActivityLine("Ana Reyes", { eventId: "e1", lastActiveAt: "2026-11-02T01:00:00.000Z", unreadNotices: 1 }, today))
      .toEqual({ text: "Ana Reyes last opened the portal 14 days ago · 1 notice unread", quiet: true });
    expect(clientActivityLine("Ana Reyes", { eventId: "e1", lastActiveAt: null, unreadNotices: 0 }, today))
      .toEqual({ text: "Ana Reyes has not signed in to the portal yet", quiet: true });
  });

  it("lists only this event's dated work, soonest first, without the event day itself", () => {
    const item = (id: string, date: string, over: Partial<PrismPmcmCalendarItem> = {}): PrismPmcmCalendarItem =>
      ({ id, kind: "payment_due", eventId: "e1", eventName: "Gala", date, detail: id, ...over });
    const items = [item("balance", "2026-11-30"), item("day", "2026-11-23", { kind: "event" }), item("other", "2026-11-18", { eventId: "e2" }),
      item("arrival-late", "2026-11-20", { kind: "supplier_arrival", startTime: "14:00" }), item("arrival-early", "2026-11-20", { kind: "supplier_arrival", startTime: "07:00" })];
    expect(eventComingUp(items, "e1").map((entry) => entry.id)).toEqual(["arrival-early", "arrival-late", "balance"]);
  });
});
