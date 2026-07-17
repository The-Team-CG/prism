import { describe, expect, it } from "vitest";
import {
  createPrismInquirySchema,
  createGuestFeedbackSchema,
  updateSupplierEventStatusSchema,
  submitSupplierQuoteSchema,
  updateInquiryStatusSchema,
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
      eventDate: "not-a-date",
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
    expect(updateSupplierEventStatusSchema.safeParse({ status: "arrived" }).success).toBe(true);
    expect(updateSupplierEventStatusSchema.safeParse({ status: "maybe" }).success).toBe(false);
  });

  it("validates supplier quote amount", () => {
    expect(submitSupplierQuoteSchema.safeParse({ amount: 12000 }).success).toBe(true);
    expect(submitSupplierQuoteSchema.safeParse({ amount: -1 }).success).toBe(false);
  });

  it("validates inquiry status transitions", () => {
    expect(updateInquiryStatusSchema.safeParse({ status: "accepted" }).success).toBe(true);
    expect(updateInquiryStatusSchema.safeParse({ status: "nope" }).success).toBe(false);
  });

  it("parseContract throws PrismContractError with issues", () => {
    expect(() =>
      parseContract(createPrismInquirySchema, { clientName: "" }, "Create inquiry"),
    ).toThrow(PrismContractError);
  });
});
