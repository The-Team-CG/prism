import { describe, expect, it } from "vitest";
import type { PrismPaymentSubmission, PrismStatementMilestone, PrismStatementOfAccount } from "@prism/types";
import { accountGroups, amountToSend, keptReceipts, milestoneStep, moneyHeadline } from "./client-money-rules";

const TODAY = "2026-11-14";

function milestone(overrides: Partial<PrismStatementMilestone>): PrismStatementMilestone {
  return { id: "m", label: "Balance", dueDate: "2026-12-30", amount: 100000, paid: 0, remaining: 100000, status: "pending", checking: 0, disputed: 0, settledOn: null, ...overrides };
}

function statement(milestones: PrismStatementMilestone[], overrides: Partial<PrismStatementOfAccount> = {}): PrismStatementOfAccount {
  return {
    eventId: "evt", eventName: "Gala", generatedAt: "2026-11-14T00:00:00.000Z", available: true, statementNumber: "BS-1",
    billed: milestones.reduce((sum, item) => sum + item.amount, 0), received: 0, refunded: 0, creditHeld: 0,
    balance: milestones.reduce((sum, item) => sum + item.remaining, 0), disputedOnStatement: 0, paymentMethods: [], submissions: [], lines: [], milestones, ...overrides,
  };
}

const checking = (unapplied: number): PrismPaymentSubmission => ({
  id: "s", amount: unapplied, paidDate: "2026-11-13", method: "GCash", reference: "GC", state: "checking", reason: null, forPayment: null, unapplied, fromClient: true, hasProof: true,
});

describe("client money rules", () => {
  it("asks for everything overdue, else the next payment, less amounts under review and money already sent or held", () => {
    const overdue = [
      milestone({ id: "a", dueDate: "2026-10-15", remaining: 125000, disputed: 30000 }),
      milestone({ id: "b", dueDate: "2026-10-19", amount: 126000, paid: 60000, remaining: 66000, checking: 60000 }),
      milestone({ id: "c", dueDate: "2026-12-30" }),
    ];
    expect(amountToSend(statement(overdue), TODAY)).toBe(95000 + 66000);
    expect(amountToSend(statement(overdue, { submissions: [checking(66000)] }), TODAY)).toBe(95000);
    expect(amountToSend(statement([milestone({ id: "n", dueDate: "2026-11-30", remaining: 40000 }), milestone({ id: "l" })], { creditHeld: 15000 }), TODAY)).toBe(25000);
    expect(amountToSend(statement([milestone({ paid: 100000, remaining: 0 })]), TODAY)).toBe(0);
  });

  it("keeps a receipt for each payment still counted, not for reversed ones or credits", () => {
    const lines = [
      { id: "r1", date: "2026-09-01", kind: "payment" as const, description: "Payment received", method: "GCash", reference: "GC1", amount: 60000, reversed: false },
      { id: "r2", date: "2026-09-02", kind: "payment" as const, description: "Payment received, later reversed by PMCM", method: "GCash", reference: "GC2", amount: 10000, reversed: true },
      { id: "c1", date: "2026-09-03", kind: "credit" as const, description: "Credit", method: "", reference: "", amount: 5000, reversed: false },
    ];
    expect(keptReceipts(statement([], { lines })).map((line) => line.id)).toEqual(["r1"]);
  });

  it.each([
    ["paid and checked", milestone({ paid: 100000, remaining: 0, settledOn: "2026-10-13" }), "paid", "Paid Oct 13, 2026"],
    ["paid, part still being checked", milestone({ paid: 100000, remaining: 0, checking: 40000 }), "checking", "Due Dec 30, 2026"],
    ["past due and owed", milestone({ dueDate: "2026-10-19" }), "overdue", "Due Oct 19, 2026 · 26 days late"],
    ["past due but all of it questioned", milestone({ dueDate: "2026-10-19", disputed: 100000 }), "disputed", "Due Oct 19, 2026 · 26 days late"],
    ["due within two weeks", milestone({ dueDate: "2026-11-18" }), "due-soon", "Due Nov 18, 2026 · in 4 days"],
    ["due later, part paid", milestone({ paid: 30000, remaining: 70000 }), "partly", "Due Dec 30, 2026"],
    ["due later, nothing paid", milestone({}), "upcoming", "Due Dec 30, 2026"],
  ])("reads a payment that is %s", (_name, item, state, when) => {
    expect(milestoneStep(item, TODAY)).toMatchObject({ state, when });
  });

  it("leads with what is overdue, net of what is questioned, and says what is under review or being checked", () => {
    const headline = moneyHeadline(statement([milestone({ label: "Balance", dueDate: "2026-10-15", remaining: 125000, amount: 125000, disputed: 30000 })], { submissions: [checking(20000)] }), TODAY);

    expect(headline).toMatchObject({ tone: "danger", title: "₱95,000 overdue" });
    expect(headline?.detail).toContain("₱30,000 more is under review");
    expect(headline?.detail).toContain("₱20,000 you sent is being checked");
  });

  it("otherwise leads with the next payment, and says what money already sent will count toward it", () => {
    const items = [milestone({ id: "dp", label: "Downpayment", dueDate: "2026-11-18", amount: 432500, remaining: 432500 }), milestone({ id: "bal", dueDate: "2026-11-21" })];

    expect(moneyHeadline(statement(items, { submissions: [checking(100000)] }), TODAY)).toMatchObject({
      tone: "attention", title: "₱432,500 due Nov 18, 2026", milestoneId: "dp", detail: "Downpayment, in 4 days. ₱100,000 you sent is being checked and will count toward it.",
    });
  });

  it("says paid in full when nothing is owed, and that it is being checked while it still is", () => {
    const settled = milestone({ paid: 100000, remaining: 0, settledOn: "2026-10-13" });

    expect(moneyHeadline(statement([settled]), TODAY)).toMatchObject({ tone: "success", title: "Paid in full" });
    expect(moneyHeadline(statement([{ ...settled, checking: 100000 }]), TODAY)).toMatchObject({ tone: "info", title: "Fully paid, being checked" });
    expect(moneyHeadline(statement([], { available: false }), TODAY)).toBeNull();
  });

  it("groups every event's payments by when they need the client, with what is still owed per group, leaving out amounts under review", () => {
    const groups = accountGroups([
      statement([milestone({ id: "late", dueDate: "2026-10-19", amount: 126000, paid: 60000, remaining: 66000, disputed: 6000 }), milestone({ id: "done", paid: 100000, remaining: 0 })]),
      { ...statement([milestone({ id: "soon", dueDate: "2026-11-18" }), milestone({ id: "later" })]), eventId: "evt2", eventName: "Summit" },
    ], TODAY);

    expect(groups.map((group) => [group.id, group.payments.map((payment) => payment.step.id), group.total])).toEqual([
      ["overdue", ["late"], 60000],
      ["due-soon", ["soon"], 100000],
      ["later", ["later"], 100000],
      ["paid", ["done"], 100000],
    ]);
    expect(groups[1].payments[0].eventName).toBe("Summit");
  });
});
