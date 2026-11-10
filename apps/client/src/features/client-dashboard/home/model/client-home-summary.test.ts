import { describe, expect, it } from "vitest";
import type { PrismEvent } from "@prism/types";
import type { ClientDashboardAction } from "../../workspace/model/client-dashboard-view-rules";
import { clientHomeFigures, clientHomeLead, clientHomeSummaryLine, orderClientActionsByUrgency, timeOfDayGreeting } from "./client-home-summary";

function action(id: string, patch: Partial<ClientDashboardAction> = {}): ClientDashboardAction {
  return {
    id, title: id, description: "", detail: "", ctaLabel: "Open", icon: () => null, targetTab: "overview", status: "open", tone: "primary", nextActor: "you", ...patch,
  } as ClientDashboardAction;
}

function figures(actions: ClientDashboardAction[]) {
  return clientHomeFigures({
    actions,
    events: [] as PrismEvent[],
    payments: [],
    todayKey: "2026-11-09",
    hrefFor: () => "/dashboard",
    formatMoney: String,
    formatDate: String,
  });
}

describe("client home attention summary", () => {
  it("describes the items that need the client without contradicting their count", () => {
    expect(figures([action("sign")])[0]).toMatchObject({ label: "Needs you", value: 1, detail: "1 item, none blocking" });
    expect(figures([action("a"), action("b")])[0]).toMatchObject({ value: 2, detail: "2 items, none blocking" });
    expect(figures([action("a", { blocking: true }), action("b")])[0]).toMatchObject({ value: 2, detail: "1 blocking now" });
    expect(figures([])[0]).toMatchObject({ value: 0, detail: "All caught up" });
  });

  it("marks figures with nothing to report as empty so a stat row can leave them out", () => {
    expect(figures([]).map((figure) => Boolean(figure.empty))).toEqual([true, true, true, true]);
    expect(figures([action("a"), action("b", { nextActor: "pmcm" })]).map((figure) => Boolean(figure.empty))).toEqual([false, false, true, true]);
  });

  it("puts blockers first, then what holds a stage back, and keeps the given order otherwise", () => {
    const ordered = orderClientActionsByUrgency([
      action("later"), action("holding", { blocking: true }), action("blocker", { priority: "critical" }), action("later-2"), action("attention", { priority: "attention" }),
    ]);
    expect(ordered.map((item) => item.id)).toEqual(["blocker", "holding", "attention", "later", "later-2"]);
  });

  it("leads the home with the next event still ahead, unless another event has a blocker", () => {
    const event = (id: string, eventDate: string, status = "planning") => ({ id, eventName: id, eventDate, status, archived: false }) as PrismEvent;
    const events = [event("overdue", "2026-10-26"), event("ahead", "2026-11-23"), event("later", "2026-12-20"), event("done", "2026-10-01", "completed")];
    const steps = [action("overdue-step", { eventId: "overdue", priority: "attention" }), action("ahead-later", { eventId: "ahead" }), action("ahead-now", { eventId: "ahead", blocking: true })];

    // The next event on the calendar leads, with its own most urgent step and the days to go.
    expect(clientHomeLead(events, steps, "2026-11-11")).toMatchObject({ event: { id: "ahead" }, action: { id: "ahead-now" }, daysToGo: 12 });
    // A blocker elsewhere is what the client must see first.
    expect(clientHomeLead(events, [...steps, action("pay", { eventId: "overdue", priority: "critical" })], "2026-11-11")).toMatchObject({ event: { id: "overdue" }, action: { id: "pay" }, daysToGo: -16 });
    // With nothing ahead on the calendar, the earliest event still open leads; with no open event there is no lead.
    expect(clientHomeLead([event("overdue", "2026-10-26")], [], "2026-11-11")).toMatchObject({ event: { id: "overdue" }, action: undefined });
    expect(clientHomeLead([event("done", "2026-10-01", "completed")], [], "2026-11-11")).toBeNull();
  });

  it("greets by time of day", () => {
    expect([0, 11, 12, 17, 18, 23].map(timeOfDayGreeting)).toEqual(["Good morning", "Good morning", "Good afternoon", "Good afternoon", "Good evening", "Good evening"]);
  });

  it("sums up what is waiting on the client in one sentence", () => {
    expect(clientHomeSummaryLine([])).toBe("Nothing needs you right now.");
    expect(clientHomeSummaryLine([action("a", { eventId: "e1" })])).toBe("1 thing needs you.");
    expect(clientHomeSummaryLine([action("a", { eventId: "e1" }), action("b", { eventId: "e1" })])).toBe("2 things need you.");
    expect(clientHomeSummaryLine([action("a", { eventId: "e1" }), action("b", { eventId: "e2" })])).toBe("2 things need you across 2 events.");
  });
});
