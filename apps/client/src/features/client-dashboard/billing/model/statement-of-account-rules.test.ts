import { describe, expect, it } from "vitest";
import type { PrismStatementOfAccount } from "@prism/types";
import { statementLineAmount, statementLineLabel } from "./statement-of-account-rules";

const format = (amount: number) => `PHP ${amount.toLocaleString("en-PH")}`;

function statement(overrides: Partial<PrismStatementOfAccount> = {}): PrismStatementOfAccount {
  return {
    eventId: "evt_1", eventName: "Summit", generatedAt: "2026-11-11T01:00:00.000Z", available: true, statementNumber: "BS-1",
    billed: 150000, received: 100000, refunded: 0, creditHeld: 0, balance: 50000,
    milestones: [{ id: "m1", label: "Deposit", dueDate: "2026-10-15", amount: 100000, paid: 100000, remaining: 0, status: "paid", checking: 0, disputed: 0, settledOn: "2026-10-10" }],
    disputedOnStatement: 0, paymentMethods: [], submissions: [],
    lines: [{ id: "r1", date: "2026-10-10", kind: "payment", description: "Payment received", method: "Bank Transfer", reference: "BDO-1", amount: 100000, reversed: false }],
    ...overrides,
  };
}

describe("statement of account rules", () => {
  it("labels and signs each line so a reversed payment is never read as money received", () => {
    const payment = statement().lines[0];

    expect(statementLineLabel(payment)).toBe("Payment");
    expect(statementLineAmount(payment, format)).toBe("+PHP 100,000");
    expect(statementLineLabel({ ...payment, reversed: true })).toBe("Payment (reversed)");
    expect(statementLineAmount({ ...payment, reversed: true }, format)).toBe("PHP 100,000");
    expect(statementLineAmount({ ...payment, kind: "refund" }, format)).toBe("−PHP 100,000");
    expect(statementLineLabel({ ...payment, kind: "credit" })).toBe("Credit");
  });
});
