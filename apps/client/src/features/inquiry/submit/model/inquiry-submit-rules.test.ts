import { describe, expect, it } from "vitest";
import {
  applyInquiryPrefill,
  buildInquiryPayload,
  buildInquiryReference,
  canAdvanceInquiryStep,
  formatInquiryPhone,
  inquiryMinDate,
  isInquiryStepValid,
  mapInquirySubmitError,
  missingInquiryFields,
  nextInquiryStep,
  previousInquiryStep,
} from "./inquiry-submit-rules";
import { INITIAL_INQUIRY_FORM, type InquiryForm } from "./inquiry-submit-types";

function form(overrides: Partial<InquiryForm> = {}): InquiryForm {
  return { ...INITIAL_INQUIRY_FORM, ...overrides };
}

describe("inquiry-submit-rules", () => {
  it("validates contact step fields", () => {
    expect(isInquiryStepValid(form(), 2)).toBe(false);
    expect(
      isInquiryStepValid(
        form({
          clientName: "Ana",
          email: "ana@test.com",
          phoneNumber: "0917",
          clientType: "Corporate",
          source: "PMCM Facebook",
        }),
        2,
      ),
    ).toBe(true);
  });

  it("validates event details step", () => {
    const base = form({
      eventName: "Summit",
      eventType: "Conference",
      eventDate: "2026-08-01",
      expectedGuests: "150",
    });
    expect(isInquiryStepValid(base, 0)).toBe(true);
    expect(isInquiryStepValid(form({ eventName: "Summit" }), 0)).toBe(false);
  });

  it("requires privacy consent on confirm step", () => {
    expect(isInquiryStepValid(form({ privacyConsentAccepted: false }), 3)).toBe(false);
    expect(isInquiryStepValid(form({ privacyConsentAccepted: true }), 3)).toBe(true);
  });

  it("advances and retreats wizard steps within bounds", () => {
    expect(canAdvanceInquiryStep(form({ clientName: "A", email: "a@b.c", phoneNumber: "1", clientType: "Corporate", source: "PMCM Facebook" }), 2)).toBe(true);
    expect(canAdvanceInquiryStep(form({ privacyConsentAccepted: true }), 3)).toBe(false);
    expect(nextInquiryStep(0)).toBe(1);
    expect(nextInquiryStep(3)).toBe(3);
    expect(previousInquiryStep(2)).toBe(1);
    expect(previousInquiryStep(0)).toBe(0);
  });

  it("builds API payload with review notes", () => {
    const payload = buildInquiryPayload(
      form({
        clientName: "  Ana Reyes ",
        email: " ana@ayala.test ",
        phoneNumber: "0917",
        clientType: "Corporate",
        eventName: "Leadership Summit",
        eventType: "Conference",
        eventDate: "2026-08-01",
        expectedGuests: "200",
        source: "PMCM Facebook",
        message: "Need staging",
        privacyConsentAccepted: true,
      }),
    );
    expect(payload.clientName).toBe("Ana Reyes");
    expect(payload.email).toBe("ana@ayala.test");
    expect(payload.eventDate).toBe("2026-08-01");
    expect(payload.message).toContain("Phone: 0917");
    expect(payload.message).toContain("Need staging");
    expect(payload.privacyConsentAccepted).toBe(true);
  });

  it("requires and sends the client's own words when they pick Other", () => {
    const event = form({ eventName: "Night", eventType: "Other", eventDate: "2026-08-01", expectedGuests: "80" });
    expect(isInquiryStepValid(event, 0)).toBe(false);
    expect(missingInquiryFields(event, 0)).toEqual(["what kind of event it is"]);
    expect(isInquiryStepValid({ ...event, eventTypeOther: "Awards night" }, 0)).toBe(true);

    const payload = buildInquiryPayload(
      form({
        clientName: "Ana",
        email: "ana@test.com",
        clientType: "Individual",
        eventName: "Night",
        eventType: "Other",
        eventTypeOther: " Awards night ",
        eventDate: "2026-08-01",
        source: "Other",
        sourceOther: " Instagram ",
        privacyConsentAccepted: true,
      }),
    );
    expect(payload.eventType).toBe("Awards night");
    expect(payload.source).toBe("Other");
    expect(payload.referralDetails).toBe("Instagram");
  });

  it.each([
    ["09171234567", "0917 123 4567"],
    ["0917-abc-123", "0917 123"],
    ["091712345678999", "0917 123 4567"],
    ["+639171234567", "+63 917 123 4567"],
    ["+1 (415) 555", "+1415555"],
  ])("keeps only digits in the mobile number: %s", (typed, shown) => {
    expect(formatInquiryPhone(typed)).toBe(shown);
  });

  it("maps errors and builds reference ids", () => {
    expect(mapInquirySubmitError(new Error("boom"))).toBe("boom");
    expect(mapInquirySubmitError({})).toBe("Unable to submit inquiry");
    expect(inquiryMinDate(new Date("2026-05-10T12:00:00.000Z"))).toBe("2026-05-10");
    expect(buildInquiryReference(new Date("2026-01-01T00:00:00.000Z"), 0.5)).toBe("INQ-2026-5500");
  });

  it("prefills source and channel from a public inquiry link", () => {
    const next = applyInquiryPrefill(form(), new URLSearchParams("source=Colleague+or+Friend&channel=pmcm-inquiry-link"));
    expect(next.source).toBe("Colleague or Friend");
    expect(next.channel).toBe("pmcm-inquiry-link");
  });
});
