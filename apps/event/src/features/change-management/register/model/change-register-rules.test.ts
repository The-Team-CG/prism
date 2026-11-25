import { describe, expect, it } from "vitest";
import { canRecordDecision, emptyIssueAddendumDraft, eventDecisionClosedReason, issueAddendumBody, issueAddendumProblems } from "./change-register-rules";

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

describe("issueAddendumBody", () => {
  const quotes = [
    { id: "q_av", supplierName: "Lights Co", category: "AV", amount: 60000 },
    { id: "q_cater", supplierName: "Feast", category: "Catering", amount: 120000 },
  ];
  const draft = { ...emptyIssueAddendumDraft, title: " Photo booth ", documentId: "doc_1", contractTerms: "Photo booth for 3 hours\n\nPhoto booth for 3 hours\nPrinted strips", financialDeltaPesos: "-5,000", quoteAmounts: { q_av: "65,000" } };

  it("sends the full contract and supplier state, with typed amounts replacing the booked ones and duplicate terms once", () => {
    expect(issueAddendumBody(draft, quotes)).toEqual({
      title: "Photo booth",
      summary: undefined,
      documentId: "doc_1",
      contractSnapshot: [{ key: "Photo booth for 3 hours" }, { key: "Printed strips" }],
      quoteSnapshot: [
        { id: "q_av", supplierName: "Lights Co", category: "AV", amount: 65000 },
        { id: "q_cater", supplierName: "Feast", category: "Catering", amount: 120000 },
      ],
      financialDelta: -5000,
      freezeExceptionId: undefined,
    });
  });

  it("names what blocks issuing, including a frozen event without an approved exception", () => {
    expect(issueAddendumProblems(draft, quotes, false)).toEqual([]);
    expect(issueAddendumProblems({ ...emptyIssueAddendumDraft, financialDeltaPesos: "abc", quoteAmounts: { q_av: "lots" } }, quotes, true)).toEqual([
      "Give the addendum a title.",
      "Choose the addendum document.",
      "Enter the contract change in whole pesos, for example 12,500 or -5,000.",
      "Enter Lights Co's amount in whole pesos.",
      "Scope is frozen: choose the approved freeze exception this addendum uses.",
    ]);
  });
});
