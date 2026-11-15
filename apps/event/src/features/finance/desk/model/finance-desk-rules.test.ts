import { describe, expect, it } from "vitest";
import type { PrismFinanceDeskEvent, PrismFinanceDeskPayout, PrismStatementMilestone } from "@prism/types";
import { financeHeadline, financeStep, payoutState } from "./finance-desk-rules";

const TODAY = "2026-11-14";

function milestone(overrides: Partial<PrismStatementMilestone>): PrismStatementMilestone {
  return { id: "m", label: "Balance", dueDate: "2026-12-30", amount: 100000, paid: 0, remaining: 100000, status: "pending", checking: 0, disputed: 0, settledOn: null, ...overrides };
}

function event(milestones: PrismStatementMilestone[], overrides: Partial<PrismFinanceDeskEvent> = {}): PrismFinanceDeskEvent {
  return {
    eventId: "e", eventName: "Gala", eventDate: null, clientName: "Ana", statementNumber: "BS-1", statementSent: true, billed: 100000,
    paid: milestones.reduce((sum, item) => sum + item.paid, 0), checking: milestones.reduce((sum, item) => sum + item.checking, 0),
    balance: milestones.reduce((sum, item) => sum + item.remaining, 0), overdue: 0, milestones, ...overrides,
  };
}

const payout = (overrides: Partial<PrismFinanceDeskPayout>): PrismFinanceDeskPayout => ({ id: "p", eventId: "e", eventName: "Gala", supplierName: "X", label: "Deposit", amount: 1000, released: 0, dueDate: "2026-12-30", status: "scheduled", ...overrides });

describe("finance desk rules", () => {
  it("reads a client payment for PMCM: money to verify, disputed amounts and what is still owed", () => {
    expect(financeStep(milestone({ dueDate: "2026-10-19", amount: 126000, paid: 60000, remaining: 66000, checking: 60000 }), TODAY)).toMatchObject({
      state: "overdue", when: "Due Oct 19, 2026 · 26 days late", notes: ["₱60,000 to verify", "₱66,000 still owed"],
    });
    expect(financeStep(milestone({ dueDate: "2026-11-18", disputed: 30000 }), TODAY)).toMatchObject({ state: "due-soon", notes: ["₱30,000 disputed"] });
  });

  it.each([
    ["not sent yet", event([milestone({})], { statementSent: false }), "Statement not sent"],
    ["overdue", event([milestone({ dueDate: "2026-10-15" })], { overdue: 100000 }), "₱100,000 overdue"],
    ["next due", event([milestone({ dueDate: "2026-11-18" })]), "₱100,000 due Nov 18, 2026"],
    ["paid, still verifying", event([milestone({ paid: 100000, remaining: 0, checking: 40000 })]), "Paid, verifying"],
    ["paid and verified", event([milestone({ paid: 100000, remaining: 0 })]), "Paid in full"],
  ])("leads an event's money with what matters when it is %s", (_name, money, title) => {
    expect(financeHeadline(money, TODAY).title).toBe(title);
  });

  it.each([
    [payout({ released: 1000 }), "paid"],
    [payout({ dueDate: "2026-11-09" }), "overdue"],
    [payout({ dueDate: "2026-11-16", released: 300 }), "due-soon"],
    [payout({ released: 300 }), "partly"],
    [payout({}), "upcoming"],
  ])("places a supplier payout by what is left and when it is due", (item, state) => {
    expect(payoutState(item, TODAY)).toBe(state);
  });
});
