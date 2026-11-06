import { describe, expect, it } from "vitest";
import { canRecordDecision } from "./change-register-rules";

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
