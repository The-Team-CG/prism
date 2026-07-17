import { describe, expect, it } from "vitest";
import {
  createPrismInquirySchema,
  createGuestFeedbackSchema,
  updateSupplierEventStatusSchema,
  parseContract,
  PrismContractError,
} from "./index.js";

describe("event-ops write schemas", () => {
  it("accepts a valid inquiry payload", () => {
    const parsed = createPrismInquirySchema.parse({
      clientName: "Maria Santos",
      email: "maria@samplecorp.test",
      eventName: "Leadership Forum",
      eventDate: "2026-06-18",
      clientType: "Corporate",
      message: "Need full planning support.",
      privacyConsentAccepted: true,
    });
    expect(parsed.email).toBe("maria@samplecorp.test");
    expect(parsed.eventDate).toBe("2026-06-18");
  });

  it("rejects invalid inquiry email and date", () => {
    const result = createPrismInquirySchema.safeParse({
      clientName: "Maria",
      email: "not-an-email",
      eventName: "Forum",
      eventDate: "18-06-2026",
      clientType: "Corporate",
      message: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("validates guest feedback rating bounds", () => {
    expect(
      createGuestFeedbackSchema.safeParse({
        guestName: "Alex",
        rating: 6,
      }).success,
    ).toBe(false);
    expect(
      createGuestFeedbackSchema.safeParse({
        guestName: "Alex",
        rating: 5,
      }).success,
    ).toBe(true);
  });

  it("validates supplier event-day status enum", () => {
    expect(
      updateSupplierEventStatusSchema.safeParse({ status: "arrived" }).success,
    ).toBe(true);
    expect(
      updateSupplierEventStatusSchema.safeParse({ status: "maybe" }).success,
    ).toBe(false);
  });

  it("parseContract throws PrismContractError with issues", () => {
    expect(() =>
      parseContract(
        createPrismInquirySchema,
        { clientName: "" },
        "Create inquiry",
      ),
    ).toThrow(PrismContractError);
  });
});
