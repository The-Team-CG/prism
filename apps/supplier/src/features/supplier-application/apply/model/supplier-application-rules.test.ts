import { describe, expect, it } from "vitest";
import { INITIAL_SUPPLIER_APPLICATION_FORM } from "./supplier-application-types";
import { isSupplierApplicationReady, missingSupplierApplicationItems } from "./supplier-application-rules";

const COMPLETE_FORM = {
  ...INITIAL_SUPPLIER_APPLICATION_FORM,
  companyName: "Lumen Staging Co",
  contactName: "Ana Cruz",
  email: "ana@example.com",
  categoryId: "cat-lights",
  privacyConsentAccepted: true,
};

describe("single-screen application readiness", () => {
  it("reports every required item still missing, in form order, from a blank form", () => {
    expect(missingSupplierApplicationItems(INITIAL_SUPPLIER_APPLICATION_FORM)).toEqual([
      "company name",
      "contact person",
      "email address",
      "service category",
      "privacy notice consent",
    ]);
    expect(isSupplierApplicationReady(INITIAL_SUPPLIER_APPLICATION_FORM)).toBe(false);
  });

  it("treats whitespace-only required text as missing and keeps optional fields out of the check", () => {
    const form = { ...COMPLETE_FORM, companyName: "   ", phone: "", pastEvents: "", portfolioUrl: "" };
    expect(missingSupplierApplicationItems(form)).toEqual(["company name"]);
    expect(isSupplierApplicationReady(form)).toBe(false);
  });

  it("is ready once company, contact, email, category and privacy consent are all present", () => {
    expect(missingSupplierApplicationItems(COMPLETE_FORM)).toEqual([]);
    expect(isSupplierApplicationReady(COMPLETE_FORM)).toBe(true);
  });

  it("requires privacy consent even when every other field is complete", () => {
    expect(isSupplierApplicationReady({ ...COMPLETE_FORM, privacyConsentAccepted: false })).toBe(false);
  });
});
