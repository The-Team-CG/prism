import {
  createPrismInquirySchema,
  parseContract,
  type CreatePrismInquiryInput,
} from "@prism/types";
import type { InquiryForm } from "./inquiry-submit-types";
import { INQUIRY_WIZARD_STEPS } from "./inquiry-submit-types";

export function isInquiryStepValid(form: InquiryForm, step: number): boolean {
  if (step === 0) {
    return Boolean(form.clientName.trim() && form.email.trim() && form.phoneNumber.trim() && form.clientType);
  }
  if (step === 1) {
    return Boolean(form.eventName.trim() && form.eventType && form.eventDate && form.expectedGuests.trim());
  }
  if (step === 2) {
    return Boolean(form.budgetRange && form.inquiryPriority);
  }
  return form.privacyConsentAccepted;
}

export function canAdvanceInquiryStep(form: InquiryForm, step: number): boolean {
  return isInquiryStepValid(form, step) && step < INQUIRY_WIZARD_STEPS.length - 1;
}

export function nextInquiryStep(step: number): number {
  return Math.min(step + 1, INQUIRY_WIZARD_STEPS.length - 1);
}

export function previousInquiryStep(step: number): number {
  return Math.max(step - 1, 0);
}

export function buildInquiryPayload(form: InquiryForm): CreatePrismInquiryInput {
  const reviewNotes = [
    `Phone: ${form.phoneNumber || "Not provided"}`,
    `Expected guests: ${form.expectedGuests || "Not provided"}`,
    `Venue or city: ${form.venueCity || "Not provided"}`,
    `Venue status: ${form.venueStatus || "Not provided"}`,
    `Date flexibility: ${form.dateFlexibility || "Not provided"}`,
    `Budget range: ${form.budgetRange || "Not provided"}`,
    `Inquiry priority: ${form.inquiryPriority || "Not provided"}`,
    "",
    "Client notes:",
    form.message || "No additional notes provided.",
  ].join("\n");

  return parseContract(
    createPrismInquirySchema,
    {
      clientName: form.clientName.trim(),
      companyName: form.companyName.trim() || undefined,
      email: form.email.trim(),
      eventName: form.eventName.trim(),
      eventType: form.eventType || undefined,
      eventDate: form.eventDate,
      clientType: form.clientType,
      source: form.source || undefined,
      message: reviewNotes,
      privacyConsentAccepted: form.privacyConsentAccepted,
      privacyNoticeVersion: form.privacyNoticeVersion,
      marketingConsentAccepted: form.marketingConsentAccepted,
    },
    "Create inquiry",
  );
}

export function mapInquirySubmitError(error: unknown, fallback = "Unable to submit inquiry"): string {
  if (error instanceof Error && error.message.trim()) {
    // Surface first Zod boundary issue without the "Create inquiry failed validation:" prefix when possible.
    const stripped = error.message.replace(/^Create inquiry failed validation:\s*/i, "");
    return stripped || error.message;
  }
  return fallback;
}

export function inquiryMinDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function buildInquiryReference(now: Date = new Date(), random = Math.random()): string {
  const year = now.getFullYear();
  const suffix = Math.floor(1000 + random * 9000);
  return `INQ-${year}-${suffix}`;
}
