import { describe, expect, it } from "vitest";
import type { PrismStatementOfAccount } from "@prism/types";
import { createStatementOfAccountPdf, createTextPdf } from "./statement-pdf";

/** Every cross-reference offset must point at its own object, or a PDF reader refuses the file. */
function assertWellFormed(text: string) {
  const startxref = Number(text.match(/startxref\n(\d+)\n%%EOF$/)?.[1]);
  expect(text.slice(startxref, startxref + 4)).toBe("xref");
  const entries = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map((match) => Number(match[1]));
  entries.forEach((offset, index) => expect(text.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`));
  return entries.length;
}

describe("statement pdf", () => {
  it("writes a well-formed PDF whose pages hold every line, however many there are", async () => {
    const lines = Array.from({ length: 120 }, (_, index) => `Line ${index + 1}`);

    const blob = createTextPdf(lines);
    const text = await blob.text();

    expect(blob.type).toBe("application/pdf");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    const pages = Number(text.match(/\/Count (\d+)/)?.[1]);
    expect(pages).toBeGreaterThan(1);
    expect(assertWellFormed(text)).toBe(3 + pages * 2);
    for (const index of [1, 60, 120]) expect(text).toContain(`(Line ${index}) Tj`);
  });

  it("wraps a long line instead of running off the page, and keeps characters a PDF cannot hold from breaking it", async () => {
    const text = await createTextPdf([`Payment ${"word ".repeat(60)}end`, "Refund −PHP 5,000 (net) \\ ₱"]).text();

    assertWellFormed(text);
    expect(text.match(/word word/g)?.length).toBeGreaterThan(1);
    expect(text).toContain("Refund -PHP 5,000 \\(net\\) \\\\ ?");
  });

  it("names the statement file and carries the statement's own figures", async () => {
    const statement: PrismStatementOfAccount = {
      eventId: "evt_1", eventName: "Winter Gala", generatedAt: "2026-11-11T00:00:00.000Z", available: true, statementNumber: "BS-7", billed: 150000, received: 100000,
      refunded: 0, creditHeld: 0, balance: 50000, milestones: [], lines: [{ id: "r1", date: "2026-10-10", kind: "payment", description: "Payment received", method: "GCash", reference: "GC-1", amount: 100000, reversed: false }],
    };

    const { blob, fileName } = createStatementOfAccountPdf(statement);
    const text = await blob.text();

    expect(fileName).toBe("statement-of-account-BS-7.pdf");
    assertWellFormed(text);
    for (const expected of ["Event: Winter Gala", "Billed: PHP 150,000", "Balance due: PHP 50,000", "Ref GC-1"]) expect(text).toContain(expected);
  });

  it("still writes a valid one-page file when there is nothing to print", async () => {
    const text = await createTextPdf([]).text();

    expect(assertWellFormed(text)).toBe(5);
  });
});
