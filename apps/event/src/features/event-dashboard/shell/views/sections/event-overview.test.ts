import { describe, expect, it } from "vitest";
import { eventPortalNavItems } from "../../view-models/use-event-dashboard-nav";
import type { PrismDefenseReadinessAction } from "@prism/types";
import { isEventDayClose, needsCloseOut, overviewNeedsYouLines, overviewNextActions } from "./event-overview";

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
    expect(closure).toMatchObject({ section: "Onsite & post-event", badge: undefined });
    expect(planning.find((item) => item.id === "event-overview")?.section).toBe("Prepare");

    const live = eventPortalNavItems({ ...counts, eventStage: "event_day" });
    expect(live.find((item) => item.id === "event-report")?.badge).toBe(11);

    // FR-24: the Floorplans tab follows the event's module switch.
    expect(planning.some((item) => item.id === "event-floorplans")).toBe(true);
    expect(eventPortalNavItems({ ...counts, eventStage: "briefing_proposal", disabledModules: ["floorplans"] }).some((item) => item.id === "event-floorplans")).toBe(false);
  });

  it("leads a past, unarchived event with its close-out and keeps only billing and closure work", () => {
    const action = (key: string, targetTab: PrismDefenseReadinessAction["targetTab"]): PrismDefenseReadinessAction => ({ key, label: key, detail: key, status: "attention", targetTab });
    const pending = [action("briefing", "briefing"), action("floorplan", "floorplans"), action("suppliers", "suppliers"), action("coordinators", "coordinators"), action("billing", "billing"), action("closure", "closure")];
    const next = overviewNextActions(pending, needsCloseOut({ eventDate: "2026-06-18", archived: false }, "2026-11-02"));

    expect(next.map((entry) => entry.key)).toEqual(["close-out", "billing", "closure"]);
    expect(next[0]).toMatchObject({ label: "This event has ended — close it out", targetTab: "closure" });
  });

  it("keeps the planning to-dos for upcoming events and does not re-open archived ones", () => {
    const pending: PrismDefenseReadinessAction[] = [
      { key: "briefing", label: "Client briefing", detail: "Submit the venue.", status: "blocked", targetTab: "briefing" },
    ];
    expect(needsCloseOut({ eventDate: "2026-11-02", archived: false }, "2026-11-02")).toBe(false);
    expect(overviewNextActions(pending, false)).toBe(pending);
    expect(needsCloseOut({ eventDate: "2026-06-18", archived: true }, "2026-11-02")).toBe(false);
  });
});

describe("what the overview says needs PMCM", () => {
  const inbox = (id: string, over: Record<string, string>) => ({ id, kind: "payment", severity: "warning", label: id, description: "", status: "open", href: `/x/${id}`, ...over }) as never;

  it("leads with the close-out and a requested venue visit, then the Inbox items with how long each has waited", () => {
    const attention = { eventId: "e1", counts: { critical: 0, warning: 3, attention: 0, info: 0 }, total: 3, top: [
      inbox("overdue", { dueAt: "2026-11-14T08:00:00.000Z" }),
      inbox("tomorrow", { dueAt: "2026-11-17T08:00:00.000Z" }),
      inbox("stale", { createdAt: "2026-11-10T02:00:00.000Z" }),
      inbox("fresh", { createdAt: "2026-11-16T01:00:00.000Z" }),
    ] };
    const lines = overviewNeedsYouLines({ event: { id: "e1", clientName: "Ana Reyes" }, attention, closeOut: true, visitRequested: true, todayKey: "2026-11-16" });

    expect(lines.map((line) => [line.text, line.age, line.late])).toEqual([
      ["This event has ended — close it out", undefined, undefined],
      ["Schedule the venue visit Ana Reyes asked for", undefined, undefined],
      ["overdue", "overdue 2 days", true],
      ["tomorrow", "due tomorrow", undefined],
      ["stale", "waiting 6 days", true],
      ["fresh", "new today", undefined],
    ]);
    expect(lines[0].href).toBe("/dashboard/events/e1/closure");
    expect(lines[1].href).toBe("#overview-ocular-visit");
  });

  it("is empty when nothing waits and the visit is not pending", () => {
    expect(overviewNeedsYouLines({ event: { id: "e1", clientName: "Ana" }, attention: null, closeOut: false, visitRequested: false, todayKey: "2026-11-16" })).toEqual([]);
  });
});
