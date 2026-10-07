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
  normalizeSupplierDirectoryRoute,
} from "./suppliers-directory-rules";

describe("suppliers-directory-rules", () => {
  it("normalizes names", () => {
    expect(normalizeSupplierName("  Acme   Lights ")).toBe("Acme Lights");
  });

  it("maps supplier presets to Prism category IDs and keeps missing presets empty", () => {
    const categories = [
      { id: "cat-food", slug: "food-and-beverages", name: "Food and beverages", sortOrder: 1, active: true, reviewDimensions: [] },
      { id: "cat-tech", slug: "technicals", name: "Technicals", sortOrder: 2, active: true, reviewDimensions: [] },
    ];
    expect(normalizeSupplierDirectoryRoute("catering", new URLSearchParams(), categories).query.categoryId).toBe("cat-food");
    expect(normalizeSupplierDirectoryRoute("lights-sounds", new URLSearchParams(), categories).query.categoryId).toBe("cat-tech");
    expect(normalizeSupplierDirectoryRoute("venues", new URLSearchParams(), categories).query.categoryId).toBe("unmatched-preset:venues");
  });

  it("normalizes malformed URL filters and retains explicit filters over route presets", () => {
    const categories = [{ id: "cat-food", slug: "food-and-beverages", name: "Food and beverages", sortOrder: 1, active: true, reviewDimensions: [] }];
    const preferred = normalizeSupplierDirectoryRoute("preferred", new URLSearchParams("q=  catering  "), categories);
    expect(preferred.query).toMatchObject({ q: "catering", tier: "tier_1", page: 0, pageSize: 25 });
    const explicit = normalizeSupplierDirectoryRoute("catering", new URLSearchParams("categoryId=cat-tech&page=bad&rating=invalid"), categories);
    expect(explicit.query.categoryId).toBe("cat-tech");
    expect(explicit.query.page).toBe(0);
    expect(explicit.query.rating).toBe("all");
    expect(normalizeSupplierDirectoryRoute("old-unknown-view", new URLSearchParams("supplierId=sup_1"), categories)).toMatchObject({ view: "all", supplierId: "sup_1" });
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
