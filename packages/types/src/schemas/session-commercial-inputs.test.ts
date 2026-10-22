import { describe, expect, it } from "vitest";
import {
  archiveEventSchema,
  approveBillingSourceSchema,
  createSupplierCertificationSchema,
  createSupplierSchema,
  updateSupplierSchema,
  createBillingSourceSchema,
  recordPaymentSchema,
  resolveComplianceSchema,
} from "./session-commercial-inputs.js";

describe("session commercial write schemas", () => {
  it("requires a truthful billing source label and preserves optional details", () => {
    const parsed = createBillingSourceSchema.parse({
      sourceType: "approved_conforme",
      sourceLabel: "Signed conforme",
      lineItems: [{ label: "Venue", amount: 100000 }],
      paymentMethods: [{ label: "Bank Transfer" }],
    });

    expect(parsed.paymentMethods?.[0].details).toBe("");
    expect(createBillingSourceSchema.safeParse({ lineItems: [] }).success).toBe(false);
  });

  it("rejects invalid payment values while accepting an ISO date", () => {
    expect(recordPaymentSchema.safeParse({
      amountReceived: 40000,
      paymentDate: "2026-06-20",
      paymentMethod: "Bank Transfer",
    }).success).toBe(true);
    expect(recordPaymentSchema.safeParse({
      amountReceived: 0,
      paymentDate: "2026-06-20",
      paymentMethod: "Bank Transfer",
    }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({
      amountReceived: 40000,
      paymentDate: "not-a-date",
      paymentMethod: "Bank Transfer",
    }).success).toBe(false);
  });

  it("removes caller-controlled compliance actor and closure fields", () => {
    const compliance = resolveComplianceSchema.parse({
      action: "resolve",
      actorName: "Spoofed operator",
    });
    const archive = archiveEventSchema.parse({ actorName: "Spoofed operator" });

    expect(compliance).not.toHaveProperty("actorName");
    expect(archive).not.toHaveProperty("actorName");
  });

  it("removes caller-controlled billing approver identity", () => {
    const parsed = approveBillingSourceSchema.parse({ approvedBy: "Spoofed approver", approvalNotes: "Checked" });
    expect(parsed).toEqual({ approvalNotes: "Checked" });
    expect(parsed).not.toHaveProperty("approvedBy");
  });

  it("prevents profile edits from changing tier and validates optional certification expiry dates", () => {
    expect(createSupplierSchema.safeParse({ categoryId: "cat_av", name: " Acme AV " }).success).toBe(true);
    expect(updateSupplierSchema.safeParse({ phone: "+63 900 111 2222" }).success).toBe(true);
    expect(updateSupplierSchema.safeParse({ tier: "tier_1" }).success).toBe(false);
    expect(updateSupplierSchema.safeParse({ unsupported: "field" }).success).toBe(false);

    expect(createSupplierCertificationSchema.safeParse({
      fileName: "permit.pdf",
      documentType: "permit",
      expiresAt: "2027-06-30",
    }).success).toBe(true);
    expect(createSupplierCertificationSchema.safeParse({
      fileName: "permit.pdf",
      documentType: "permit",
      expiresAt: "2027-02-30",
    }).success).toBe(false);
  });
});
