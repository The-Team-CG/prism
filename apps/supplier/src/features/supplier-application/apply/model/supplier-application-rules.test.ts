import { describe, expect, it } from "vitest";
import { INITIAL_SUPPLIER_APPLICATION_FORM } from "./supplier-application-types";
import { isSupplierApplicationStepValid } from "./supplier-application-rules";

describe("isSupplierApplicationStepValid", () => {
  it("allows the optional certifications step before review consent is available", () => {
    expect(isSupplierApplicationStepValid(INITIAL_SUPPLIER_APPLICATION_FORM, 2)).toBe(true);
  });

  it("requires privacy consent on the review step", () => {
    expect(isSupplierApplicationStepValid(INITIAL_SUPPLIER_APPLICATION_FORM, 3)).toBe(false);
    expect(isSupplierApplicationStepValid({ ...INITIAL_SUPPLIER_APPLICATION_FORM, privacyConsentAccepted: true }, 3)).toBe(true);
  });
});
