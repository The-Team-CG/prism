import {
  createPrismInquirySchema,
  inquiryPrefillFromSearchParams,
  parseContract,
  type CreatePrismInquiryInput,
} from "@prism/types";
import type { InquiryForm } from "./inquiry-submit-types";
import { INQUIRY_REFERRAL_SOURCES, INQUIRY_WIZARD_STEPS } from "./inquiry-submit-types";

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
  0: isEventStepValid,
  1: isBudgetStepValid,
  2: isContactStepValid,
};

export function isInquiryStepValid(form: InquiryForm, step: number): boolean {
  const validator = INQUIRY_STEP_VALIDATORS[step];
  if (validator) return validator(form);
  return form.privacyConsentAccepted;
}

export function canAdvanceInquiryStep(form: InquiryForm, step: number): boolean {
  return isInquiryStepValid(form, step) && step < INQUIRY_WIZARD_STEPS.length - 1;
}

export function applyInquiryPrefill(
  form: InquiryForm,
  params: { get(name: string): string | null },
): InquiryForm {
  const prefill = inquiryPrefillFromSearchParams(params);
  const source =
    prefill.source && (INQUIRY_REFERRAL_SOURCES as readonly string[]).includes(prefill.source)
      ? prefill.source
      : form.source;
  return {
    ...form,
    source,
    channel: prefill.channel ?? form.channel,
  };
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
      channel: form.channel.trim() || undefined,
      message: reviewNotes,
      privacyConsentAccepted: form.privacyConsentAccepted,
      privacyNoticeVersion: form.privacyNoticeVersion,
      marketingConsentAccepted: form.marketingConsentAccepted,
    },
    "Create inquiry",
  );
}

export function mapInquirySubmitError(error: unknown, fallback = "Unable to submit inquiry"): string {
  // fetch rejects with a TypeError when the network or the API is unreachable.
  if (error instanceof TypeError) {
    return "PMCM could not be reached. Check your connection and send again; your answers are still here.";
  }
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

export function formatInquiryDate(value: string): string {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export type InquiryBriefRow = { label: string; value: string };

/** The brief PMCM receives, in the order PMCM reads it. Empty values stay empty so the view can show a dash. */
export function inquiryBriefRows(form: InquiryForm): InquiryBriefRow[] {
  const flexibility = form.dateFlexibility && form.dateFlexibility !== "Fixed date" ? ` (${form.dateFlexibility.toLowerCase()})` : "";
  const date = form.eventDate ? `${formatInquiryDate(form.eventDate)}${flexibility}` : "";
  const guests = form.expectedGuests.trim() ? `${form.expectedGuests.trim()} guests` : "";
  const venue = [form.venueCity.trim(), form.venueStatus].filter(Boolean).join(", ");
  const contact = [form.clientName.trim(), form.companyName.trim() || form.clientType].filter(Boolean).join(", ");
  return [
    { label: "Type", value: form.eventType },
    { label: "Date", value: date },
    { label: "Guests", value: guests },
    { label: "Venue", value: venue },
    { label: "Budget", value: form.budgetRange },
    { label: "Contact", value: contact },
  ];
}

const REQUIRED_BY_STEP: Record<number, Array<[keyof InquiryForm, string]>> = {
  0: [["eventType", "the kind of event"], ["eventName", "an event name"], ["eventDate", "a date"], ["expectedGuests", "the guest count"]],
  1: [["budgetRange", "a budget range"], ["inquiryPriority", "how soon you need a reply"]],
  2: [["clientName", "your name"], ["email", "your email"], ["phoneNumber", "a mobile number"], ["clientType", "who you are booking as"], ["source", "how you heard about PMCM"]],
  3: [["privacyConsentAccepted", "your consent"]],
};

/** What still blocks this step, in words, so the action can say why it cannot continue. */
export function missingInquiryFields(form: InquiryForm, step: number): string[] {
  return (REQUIRED_BY_STEP[step] ?? [])
    .filter(([key]) => {
      const value = form[key];
      return typeof value === "boolean" ? !value : !String(value).trim();
    })
    .map(([, label]) => label);
}

/** One line for small screens: the event name and whatever is already known about it. */
export function inquiryBriefLine(form: InquiryForm): string {
  return [form.eventName.trim(), formatInquiryDate(form.eventDate), form.expectedGuests.trim() && `${form.expectedGuests.trim()} guests`]
    .filter(Boolean)
    .join(" · ");
}
