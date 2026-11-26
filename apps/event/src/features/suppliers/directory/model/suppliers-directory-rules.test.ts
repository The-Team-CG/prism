import { describe, expect, it } from "vitest";
import {
  isQuoteClosed,
  loggedQuoteInput,
  requestsAwaitingQuote,
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

  it("maps each supplier category route to its seeded category and keeps missing presets empty", () => {
    const categories = [
      { id: "cat-catering", slug: "catering", name: "Catering", sortOrder: 1, active: true, reviewDimensions: [] },
      { id: "cat-photo", slug: "photo-and-video", name: "Photo and Video", sortOrder: 2, active: true, reviewDimensions: [] },
      { id: "cat-lights", slug: "lights-and-sound", name: "Lights and Sound", sortOrder: 3, active: true, reviewDimensions: [] },
    ];
    const categoryFor = (view: string) => normalizeSupplierDirectoryRoute(view, new URLSearchParams(), categories).query.categoryId;
    expect(categoryFor("catering")).toBe("cat-catering");
    expect(categoryFor("photography-videography")).toBe("cat-photo");
    expect(categoryFor("lights-sounds")).toBe("cat-lights");
    expect(categoryFor("venues")).toBe("unmatched-preset:venues");
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

describe("quotes PMCM logs by hand", () => {
  const requests = [
    { id: "req_open", status: "open", supplierId: "sup_a", categoryId: "cat_av", supplierName: "Lights Co", category: "AV" },
    { id: "req_answered", status: "open", supplierName: "Sound Co", category: "AV" },
    { id: "req_closed", status: "closed", supplierName: "Old Co", category: "AV" },
  ];

  it("offers only open requests that have no quote yet", () => {
    expect(requestsAwaitingQuote(requests, [{ requestId: "req_answered" }, {}]).map((request) => request.id)).toEqual(["req_open"]);
  });

  it("ties the quote to its request and supplier, reads pesos and lists one inclusion per line", () => {
    expect(loggedQuoteInput(requests[0], { amount: "₱45,000", inclusions: "Two kiosks\n\n On-site tech ", paymentTerms: " 50% down ", notes: "" })).toEqual({
      requestId: "req_open", supplierId: "sup_a", categoryId: "cat_av", supplierName: "Lights Co", category: "AV",
      amount: 45000, inclusions: ["Two kiosks", "On-site tech"], paymentTerms: "50% down", notes: undefined, status: "received",
    });
    expect(loggedQuoteInput(requests[0], { amount: "about 40k", inclusions: "", paymentTerms: "", notes: "" }).amount).toBeNaN();
  });
});
