import { describe, expect, it } from "vitest";
import type { PrismSupplierReadinessItem } from "@prism/types";
import { quoteHistory, quoteOutcome } from "./quote-history";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest } from "./supplier-workspace-types";

const quote = (id: string, over: Partial<PrismSupplierQuote> = {}) => ({
  id, eventId: "evt", requestId: `req_${id}`, supplierName: "XPERTO", category: "Digital Registration", amount: 100000, inclusions: [],
  paymentTerms: "", notes: "", outsideAcceptableRange: false, status: "submitted", createdAt: "2026-11-01T00:00:00.000Z", ...over,
}) as PrismSupplierQuote;

describe("quote history", () => {
  it.each([
    ["selected", "sent", "selected"],
    ["locked", "selected", "selected"],
    ["not_selected", "closed", "not-selected"],
    ["submitted", "expired", "closed"],
    ["submitted", "sent", "pending"],
  ])("reads a %s quote on a %s request as %s", (status, requestStatus, outcome) => {
    expect(quoteOutcome({ status }, { status: requestStatus })).toBe(outcome);
  });

  it("lists quotes newest first by their last version, named by event, with what PMCM selected and what it is worth", () => {
    const quotes = [
      quote("a", { status: "selected", amount: 485000, createdAt: "2026-10-01T00:00:00.000Z" }),
      quote("b", { createdAt: "2026-11-02T00:00:00.000Z" }),
      quote("c", { status: "selected", amount: 180000, createdAt: "2026-09-01T00:00:00.000Z", revisedAt: "2026-11-05T00:00:00.000Z" }),
      quote("d", { status: "not_selected", createdAt: "2026-08-01T00:00:00.000Z" }),
    ];
    const requests = [{ id: "req_d", confidentialBid: true, status: "closed" }] as PrismSupplierQuoteRequest[];
    const readiness = [{ requestId: "req_a", eventName: "Harbor Bank Annual Conference" }] as PrismSupplierReadinessItem[];
    const history = quoteHistory(quotes, requests, readiness);
    expect(history.rows.map((row) => row.quote.id)).toEqual(["c", "b", "a", "d"]);
    expect(history.rows.find((row) => row.quote.id === "a")?.eventName).toBe("Harbor Bank Annual Conference");
    expect(history.rows.find((row) => row.quote.id === "d")?.eventName).toBe("Confidential event");
    expect(history.selected).toEqual({ count: 2, amount: 665000 });
    expect(history).toMatchObject({ pending: 1, notSelected: 1 });
  });
});
