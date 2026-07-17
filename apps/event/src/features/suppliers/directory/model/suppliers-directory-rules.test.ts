import { describe, expect, it } from "vitest";
import {
  isQuoteRequestReady,
  isSupplierCreateDraftValid,
  normalizeSupplierName,
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
});
