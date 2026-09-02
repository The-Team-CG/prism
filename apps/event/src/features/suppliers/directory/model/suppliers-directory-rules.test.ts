import { describe, expect, it } from "vitest";
import {
  isQuoteClosed,
  isQuoteRequestReady,
  isSupplierCreateDraftValid,
  normalizeSupplierName,
  quoteAcceptableRangeCopy,
  quoteSelectLabel,
  submittedBidCopy,
  supplierMatchesDirectoryFilters,
  toggleSupplierSelection,
} from "./suppliers-directory-rules";

describe("suppliers-directory-rules", () => {
  it("normalizes names", () => {
    expect(normalizeSupplierName("  Acme   Lights ")).toBe("Acme Lights");
  });

  it("validates create draft", () => {
    expect(isSupplierCreateDraftValid({ name: "Acme" })).toBe(true);
    expect(isSupplierCreateDraftValid({ name: "  " })).toBe(false);
  });

  it("toggles selection", () => {
    expect(toggleSupplierSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleSupplierSelection(["a", "b"], "a")).toEqual(["b"]);
  });

  it("requires suppliers for quote request", () => {
    expect(isQuoteRequestReady({ supplierIds: [] })).toBe(false);
    expect(isQuoteRequestReady({ supplierIds: ["s1"] })).toBe(true);
  });

  it("filters the directory and maps quote copy", () => {
    const supplier = {
      name: "Acme Lights",
      categoryName: "Lighting",
      contactName: "Ada",
      email: "ada@acme.test",
      categoryId: "cat-1",
      tier: "tier_1",
      aggregateRating: 4.6,
    };
    expect(supplierMatchesDirectoryFilters(supplier, { query: "acme", categoryId: "all", tier: "all", rating: "4.5" })).toBe(true);
    expect(supplierMatchesDirectoryFilters(supplier, { query: "", categoryId: "cat-2", tier: "all", rating: "all" })).toBe(false);
    expect(quoteSelectLabel("selected")).toBe("Selected");
    expect(quoteSelectLabel("not_selected")).toBe("Closed");
    expect(isQuoteClosed("locked")).toBe(true);
    expect(submittedBidCopy(0)).toContain("side-by-side");
    expect(submittedBidCopy(1)).toContain("1 submitted bid ");
    expect(quoteAcceptableRangeCopy({ acceptableMin: 10, acceptableMax: 20 }, (amount) => String(amount))).toEqual({
      summary: "Acceptable range: 10 to 20",
      badge: "10 - 20",
    });
    expect(quoteAcceptableRangeCopy({ acceptableMin: 0, acceptableMax: 20 }, String).summary).toBe("Acceptable range not set");
  });
});
