import { describe, expect, it } from "vitest";
import { eventPortalNavItems } from "../../view-models/use-event-dashboard-nav";
import { isEventDayClose } from "./event-overview";

describe("event workspace stage signals", () => {
  it("offers the event-day start only from the day before the event", () => {
    const now = new Date("2026-11-01T02:00:00Z"); // Nov 1, 10:00 Manila
    expect(isEventDayClose("2027-06-15", now)).toBe(false);
    expect(isEventDayClose("2026-11-03", now)).toBe(false);
    expect(isEventDayClose("2026-11-02", now)).toBe(true);
    expect(isEventDayClose("2026-11-01T09:00:00+08:00", now)).toBe(true);
  });

  it("groups event-day tabs after preparation and hides closure counts before the event", () => {
    const counts = { inEventWorkspace: true, closeoutCount: 11 };
    const planning = eventPortalNavItems({ ...counts, eventStage: "briefing_proposal" });
    const closure = planning.find((item) => item.id === "event-report");
    expect(closure).toMatchObject({ section: "Event day & after", badge: undefined });
    expect(planning.find((item) => item.id === "event-overview")?.section).toBe("Prepare");

    const live = eventPortalNavItems({ ...counts, eventStage: "event_day" });
    expect(live.find((item) => item.id === "event-report")?.badge).toBe(11);
  });
});
