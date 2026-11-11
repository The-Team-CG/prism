import { describe, expect, it } from "vitest";
import type { PrismStatementOfAccount } from "@prism/types";
import { statementFigures, statementFileName, statementHighlights, statementLineAmount, statementLineLabel, statementPdfLines } from "./statement-of-account-rules";

const format = (amount: number) => `PHP ${amount.toLocaleString("en-PH")}`;

function statement(overrides: Partial<PrismStatementOfAccount> = {}): PrismStatementOfAccount {
  return {
    eventId: "evt_1", eventName: "Summit", generatedAt: "2026-11-11T01:00:00.000Z", available: true, statementNumber: "BS-1",
    billed: 150000, received: 100000, refunded: 0, creditHeld: 0, balance: 50000,
    milestones: [{ id: "m1", label: "Deposit", dueDate: "2026-10-15", amount: 100000, paid: 100000, remaining: 0, status: "paid" }],
    lines: [{ id: "r1", date: "2026-10-10", kind: "payment", description: "Payment received", method: "Bank Transfer", reference: "BDO-1", amount: 100000, reversed: false }],
    ...overrides,
  };
}

describe("statement of account rules", () => {
  it("leads with what was billed and received, and shows refunds and held credit only when there are any", () => {
    expect(statementFigures(statement(), format).map((figure) => figure.label)).toEqual(["Billed", "Received", "Balance due"]);
    expect(statementFigures(statement({ refunded: 5000, creditHeld: 15000 }), format).map((figure) => [figure.label, figure.value])).toEqual([
      ["Billed", "PHP 150,000"], ["Received", "PHP 100,000"], ["Paid back to you", "PHP 5,000"], ["Credit held for you", "PHP 15,000"], ["Balance due", "PHP 50,000"],
    ]);
    expect(statementFigures(statement({ balance: 0 }), format).at(-1)?.label).toBe("Balance");
  });

  it("shows on the page only what the billing page does not already say: money paid back and credit held", () => {
    expect(statementHighlights(statement(), format)).toEqual([]);
    expect(statementHighlights(statement({ refunded: 5000 }), format).map((figure) => figure.label)).toEqual(["Paid back to you"]);
    expect(statementHighlights(statement({ refunded: 5000, creditHeld: 15000 }), format).map((figure) => [figure.label, figure.value])).toEqual([
      ["Paid back to you", "PHP 5,000"], ["Credit held for you", "PHP 15,000"],
    ]);
  });

  it("labels and signs each line so a reversed payment is never read as money received", () => {
    const payment = statement().lines[0];

    expect(statementLineLabel(payment)).toBe("Payment");
    expect(statementLineAmount(payment, format)).toBe("+PHP 100,000");
    expect(statementLineLabel({ ...payment, reversed: true })).toBe("Payment (reversed)");
    expect(statementLineAmount({ ...payment, reversed: true }, format)).toBe("PHP 100,000");
    expect(statementLineAmount({ ...payment, kind: "refund" }, format)).toBe("−PHP 100,000");
    expect(statementLineLabel({ ...payment, kind: "credit" })).toBe("Credit");
  });

  it("names the file after the statement, falling back to the event, with nothing a file system dislikes", () => {
    expect(statementFileName(statement())).toBe("statement-of-account-BS-1.pdf");
    expect(statementFileName(statement({ statementNumber: null }))).toBe("statement-of-account-evt_1.pdf");
    expect(statementFileName(statement({ statementNumber: "BS/2026 #1" }))).toBe("statement-of-account-BS-2026--1.pdf");
  });

  it("prints every part of the statement, including the payments and a note about reversed ones", () => {
    const lines = statementPdfLines(statement(), format);

    expect(lines).toContain("Event: Summit");
    expect(lines).toContain("Billed: PHP 150,000");
    expect(lines).toContain("Deposit (due 2026-10-15): PHP 100,000 of PHP 100,000, PHP 0 remaining");
    expect(lines).toContain("2026-10-10  Payment  +PHP 100,000  Bank Transfer  Ref BDO-1");
    expect(lines.at(-1)).toMatch(/reversed payment is listed/);
    expect(statementPdfLines(statement({ lines: [] }), format)).toContain("Nothing received yet.");
  });
});
