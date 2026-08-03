import { describe, expect, it } from "vitest";
import { sanitizePareData } from "./sanitizer.js";

describe("sanitizePareData", () => {
  it("redacts supplier and company names in nested PARE payloads", () => {
    const result = sanitizePareData({
      withdrawnSupplier: {
        supplierName: "SonicLine Technicals",
        company_name: "SonicLine Holdings",
      },
      candidates: [{ supplier_name: "AV Backup Crew", companyName: "Backup Events Inc." }],
    });

    expect(result.data).toMatchObject({
      withdrawnSupplier: { supplierName: "S. [SURNAME]", company_name: "S. [SURNAME]" },
      candidates: [{ supplier_name: "A. [SURNAME]", companyName: "B. [SURNAME]" }],
    });
    expect(result.dataCategories).toContain("name");
    expect(JSON.stringify(result.data)).not.toContain("SonicLine");
    expect(JSON.stringify(result.data)).not.toContain("Backup Events");
  });

  it("replaces emails, phones and contact fields with markers", () => {
    const result = sanitizePareData({
      clientEmail: "ana@example.com",
      mobileNumber: "+63 917 000 0000",
      clientContact: "Ana Reyes",
      contactPhone: "8123456",
    });

    expect(result.data).toEqual({
      clientEmail: "[EMAIL]",
      mobileNumber: "[PHONE]",
      clientContact: "[PHONE]",
      contactPhone: "[PHONE]",
    });
    expect(result.dataCategories).toEqual(expect.arrayContaining(["email", "phone"]));
  });

  it("reduces a single-word name to one initial", () => {
    const result = sanitizePareData({ name: "SonicLine" });

    expect(result.data).toEqual({ name: "S. [NAME]" });
  });

  it("marks an empty name without leaking the key's absence", () => {
    expect(sanitizePareData({ clientName: "" }).data).toEqual({ clientName: "[NAME]" });
    expect(sanitizePareData({ clientName: null }).data).toEqual({ clientName: "[NAME]" });
  });

  it("leaves non-personal fields and numbers untouched", () => {
    const result = sanitizePareData({
      eventName: "Ayala Summit",
      quotedAmount: 145000,
      feasible: true,
      factors: ["Adequate timeline"],
    });

    expect(result.data).toEqual({
      eventName: "Ayala Summit",
      quotedAmount: 145000,
      feasible: true,
      factors: ["Adequate timeline"],
    });
    expect(result.dataCategories).toEqual([]);
  });

  it("deduplicates the reported data categories", () => {
    const result = sanitizePareData({
      clientEmail: "a@example.com",
      supplierEmail: "b@example.com",
    });

    expect(result.dataCategories).toEqual(["email"]);
  });
});
