import { describe, expect, it } from "vitest";
import type { PrismPmcmCalendarItem } from "@prism/types";
import { selectInboxToday } from "./inbox-today";

const event = (eventId: string, date: string, extra: Partial<PrismPmcmCalendarItem> = {}): PrismPmcmCalendarItem => ({
  id: `${eventId}:${date}`, kind: "event", eventId, eventName: `Event ${eventId}`, date, detail: "BGC", ...extra,
});

describe("selectInboxToday", () => {
  it("leads with today's event as live and lists the next ones this week", () => {
    const today = selectInboxToday([
      event("later", "2026-11-30"),
      event("live", "2026-11-21"),
      event("soon", "2026-11-24"),
      { ...event("pay", "2026-11-22"), kind: "payment_due" },
    ], "2026-11-21");
    expect(today.lead).toMatchObject({ eventId: "live", live: true });
    // Only events count, and only within seven days of today.
    expect(today.week.map((item) => item.eventId)).toEqual(["soon"]);
  });

  it("leads with the next event when nothing is on today, and names a multi-day event once", () => {
    const today = selectInboxToday([event("gala", "2026-11-25"), event("gala", "2026-11-26"), event("past", "2026-11-20")], "2026-11-21");
    expect(today.lead).toMatchObject({ eventId: "gala", date: "2026-11-25", live: false });
    expect(today.week).toEqual([]);
  });

  it("has no lead when no event is coming up", () => {
    expect(selectInboxToday([], "2026-11-21")).toEqual({ lead: null, week: [] });
  });
});
