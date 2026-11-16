import { describe, expect, it } from "vitest";
import { gettingStartedSteps, ocularVisitLine, showGettingStarted, sinceLastVisitItems, stageReachedMessage, layoutSteps, paymentTotals } from "./client-overview-glance";

const event = { clientPortalStatus: "unlocked" as const, proposalClientStatus: "pending" as const, status: "briefing", archived: false };

describe("client overview at a glance", () => {
  it("checks off a new event's first steps and keeps the checklist until they are done, or the event day arrives", () => {
    const payments = [{ dueDate: "2026-12-20", status: "pending" }, { dueDate: "2026-11-20", status: "paid" }];
    const steps = gettingStartedSteps({ event, hasBriefing: true, hasLayoutIdeas: false, payments });
    expect(steps.map((step) => [step.label, step.done])).toEqual([
      ["Sign the conforme", true],
      ["Tell us about your event", true],
      ["Share your layout ideas", false],
      ["Approve the proposal", false],
      // The downpayment is the earliest milestone, whatever order they arrive in.
      ["Pay the downpayment", true],
    ]);
    expect(showGettingStarted(event, steps)).toBe(true);
    expect(showGettingStarted({ ...event, status: "event_day" }, steps)).toBe(false);
    expect(showGettingStarted(event, steps.map((step) => ({ ...step, done: true })))).toBe(false);
  });

  it("says what is new since the last visit, leaving out zeros and counts still loading", () => {
    expect(sinceLastVisitItems({ unreadMessages: 2, newFiles: 1, unreadNotices: 0 })).toEqual([
      { id: "messages", text: "2 new messages" },
      { id: "files", text: "1 new file" },
    ]);
    expect(sinceLastVisitItems({ unreadMessages: undefined, newFiles: 0, unreadNotices: 3 })).toEqual([{ id: "notices", text: "3 unread notices" }]);
  });

  it("puts an asked-for venue visit in Coming up: dated once scheduled, waiting on PMCM while requested", () => {
    const visit = { eventId: "e1", clientNote: null, scheduleNote: null, requestedAt: "2026-11-10T02:00:00.000Z", scheduledAt: null };
    expect(ocularVisitLine({ ...visit, status: "requested" })).toEqual({ label: "Venue visit requested · PMCM will set the date", at: null });
    expect(ocularVisitLine({ ...visit, status: "scheduled", scheduledAt: "2026-11-20T02:00:00.000Z" })).toEqual({ label: "Venue visit", at: "2026-11-20T02:00:00.000Z" });
    expect(ocularVisitLine({ ...visit, status: "completed" })).toBeNull();
    expect(ocularVisitLine(null)).toBeNull();
  });

  it("totals live payment milestones, ignoring replaced ones and overpayments", () => {
    expect(paymentTotals([
      { amount: 100, amountPaid: 100, supersededAt: null },
      { amount: 300, amountPaid: 50 },
      { amount: 500, amountPaid: 500, supersededAt: "2026-11-01T00:00:00.000Z" },
      { amount: 50, amountPaid: 80 },
    ])).toEqual({ billed: 450, paid: 200 });
    expect(paymentTotals([])).toEqual({ billed: 0, paid: 0 });
  });

  it("walks the floor plan from the client's ideas to PMCM's approved layout", () => {
    const done = (steps: ReturnType<typeof layoutSteps>) => steps.filter((step) => step.done).map((step) => step.id);
    expect(done(layoutSteps({ preferenceDraftCount: 0 }))).toEqual([]);
    expect(done(layoutSteps({ preferenceDraftCount: 2 }))).toEqual(["ideas"]);
    expect(done(layoutSteps({ preferenceDraftCount: 0, officialStatus: "draft" }))).toEqual(["ideas", "official"]);
    expect(done(layoutSteps({ preferenceDraftCount: 1, officialStatus: "approved" }))).toEqual(["ideas", "official", "approved"]);
  });

  it("announces a stage only when the event has moved on since the client last looked", () => {
    expect(stageReachedMessage("briefing_proposal", "planning")).toBe("Your event moved to Planning");
    expect(stageReachedMessage(null, "planning")).toBeNull();
    expect(stageReachedMessage("planning", "planning")).toBeNull();
    expect(stageReachedMessage("event_day", "planning")).toBeNull();
    expect(stageReachedMessage("not-a-stage", "planning")).toBeNull();
  });
});
