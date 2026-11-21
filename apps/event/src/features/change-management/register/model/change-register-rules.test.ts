import { describe, expect, it } from "vitest";
import { canRecordDecision, eventDecisionClosedReason } from "./change-register-rules";

const complete = { decision: "postponed" as const, reason: "Venue moved", newEventDate: "2026-12-01", frozen: true, freezeExceptionId: "ex_1", impactReviewed: true };

describe("canRecordDecision", () => {
  it("sends a decision only when it is chosen, explained, reviewed and, if needed, dated and excepted", () => {
    expect(canRecordDecision({ ...complete })).toBe(true);
    expect(canRecordDecision({ ...complete, decision: "" })).toBe(false);
    expect(canRecordDecision({ ...complete, reason: "   " })).toBe(false);
    expect(canRecordDecision({ ...complete, impactReviewed: false })).toBe(false);
    expect(canRecordDecision({ ...complete, newEventDate: "" })).toBe(false);
    expect(canRecordDecision({ ...complete, freezeExceptionId: "" })).toBe(false);
    expect(canRecordDecision({ ...complete, decision: "cancelled", newEventDate: "", frozen: false, freezeExceptionId: "" })).toBe(true);
  });
});

describe("eventDecisionClosedReason", () => {
  const planning = { status: "planning", archived: false, actualEndedAt: null, clientPortalStatus: "unlocked", proposalClientStatus: "approved" };

  it("offers a decision before event day, including on a date-to-be-confirmed event, and explains why it is closed otherwise", () => {
    expect(eventDecisionClosedReason(planning)).toBeNull();
    expect(eventDecisionClosedReason({ ...planning, status: "date_to_be_confirmed" })).toBeNull();
    expect(eventDecisionClosedReason({ ...planning, status: "cancelled" })).toMatch(/cancelled/);
    expect(eventDecisionClosedReason({ ...planning, archived: true })).toMatch(/archived/);
    expect(eventDecisionClosedReason({ ...planning, status: "event_day" })).toMatch(/Event day has started/);
    expect(eventDecisionClosedReason({ ...planning, actualEndedAt: "2026-11-10T20:00:00.000Z" })).toMatch(/Event day has started/);
  });
});
