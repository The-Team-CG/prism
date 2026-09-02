import {
  createPrismInquirySchema,
  parseContract,
  type CreatePrismInquiryInput,
} from "@prism/types";
import type { InquiryForm } from "./inquiry-submit-types";
import { INQUIRY_WIZARD_STEPS } from "./inquiry-submit-types";

function hasText(value: string) {
  return Boolean(value.trim());
}

function isContactStepValid(form: InquiryForm) {
  return hasText(form.clientName) && hasText(form.email) && hasText(form.phoneNumber) && Boolean(form.clientType) && Boolean(form.source);
}

function isEventStepValid(form: InquiryForm) {
  return hasText(form.eventName) && Boolean(form.eventType) && Boolean(form.eventDate) && hasText(form.expectedGuests);
}

function isBudgetStepValid(form: InquiryForm) {
  return Boolean(form.budgetRange && form.inquiryPriority);
}

const INQUIRY_STEP_VALIDATORS: Record<number, (form: InquiryForm) => boolean> = {
  0: isContactStepValid,
  1: isEventStepValid,
  2: isBudgetStepValid,
};

export function isInquiryStepValid(form: InquiryForm, step: number): boolean {
  const validator = INQUIRY_STEP_VALIDATORS[step];
  if (validator) return validator(form);
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

function noteOrFallback(value: string, fallback = "Not provided") {
  return value || fallback;
}

function buildInquiryReviewNotes(form: InquiryForm) {
  return [
    `Phone: ${noteOrFallback(form.phoneNumber)}`,
    `Expected guests: ${noteOrFallback(form.expectedGuests)}`,
    `Venue or city: ${noteOrFallback(form.venueCity)}`,
    `Venue status: ${noteOrFallback(form.venueStatus)}`,
    `Date flexibility: ${noteOrFallback(form.dateFlexibility)}`,
    `Budget range: ${noteOrFallback(form.budgetRange)}`,
    `Inquiry priority: ${noteOrFallback(form.inquiryPriority)}`,
    "",
    "Client notes:",
    noteOrFallback(form.message, "No additional notes provided."),
  ].join("\n");
}

export function buildInquiryPayload(form: InquiryForm): CreatePrismInquiryInput {
  const reviewNotes = buildInquiryReviewNotes(form);

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
      source: form.source,
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
