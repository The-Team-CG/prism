import { describe, expect, it } from "vitest";
import {
  inquiryExtraDetailFields,
  inquiryMatchesIntakeFilters,
  isInquiryLogFormReady,
  toLogInquiryInput,
  initialLogForm,
} from "./inquiry-intake-rules";

describe("inquiry-intake-rules", () => {
  it("matches intake filters", () => {
    const inquiry = {
      clientName: "Ada",
      companyName: "Acme",
      email: "ada@acme.test",
      eventName: "Gala",
      status: "new",
      source: "Walk-In",
      clientType: "Corporate",
      eventDate: "2099-01-15",
    };
    expect(inquiryMatchesIntakeFilters(inquiry, {
      query: "ada",
      status: "all",
      source: "all",
      clientType: "all",
      dateRange: "all",
    })).toBe(true);
    expect(inquiryMatchesIntakeFilters(inquiry, {
      query: "",
      status: "accepted",
      source: "all",
      clientType: "all",
      dateRange: "all",
    })).toBe(false);
  });

  it("collects extra detail fields", () => {
    expect(inquiryExtraDetailFields({
      referralDetails: "BNI",
      channel: "Phone",
    } as never)).toEqual([
      { label: "Referral", value: "BNI" },
      { label: "Channel", value: "Phone" },
    ]);
  });

  it("requires a complete log form and trims optional fields", () => {
    expect(isInquiryLogFormReady(initialLogForm)).toBe(false);
    const ready = {
      ...initialLogForm,
      clientName: "Ada",
      email: "ada@acme.test",
      eventName: "Gala",
      eventType: "Gala",
      eventDate: "2099-01-15",
      clientType: "Corporate",
      source: "BNI Referral",
      channel: "Phone",
      companyName: "  Acme  ",
      referralDetails: "  friend  ",
      message: "Need a venue",
    };
    expect(isInquiryLogFormReady(ready)).toBe(true);
    expect(toLogInquiryInput(ready)).toMatchObject({
      companyName: "Acme",
      referralDetails: "friend",
    });
  });
});
