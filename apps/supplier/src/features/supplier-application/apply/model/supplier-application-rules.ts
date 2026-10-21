import type { CreateSupplierApplicationInput } from "@prism/types";
import type { SupplierApplicationForm } from "./supplier-application-types";
import { APPLICATION_WIZARD_STEPS } from "./supplier-application-types";

export function isSupplierApplicationStepValid(form: SupplierApplicationForm, step: number): boolean {
  if (step === 0) {
    return Boolean(form.companyName.trim() && form.contactName.trim() && form.email.trim());
  }
  if (step === 1) {
    return Boolean(form.categoryId);
  }
  return form.privacyConsentAccepted;
}

export function canAdvanceSupplierApplicationStep(form: SupplierApplicationForm, step: number): boolean {
  return isSupplierApplicationStepValid(form, step) && step < APPLICATION_WIZARD_STEPS.length - 1;
}

export function nextSupplierApplicationStep(step: number): number {
  return Math.min(step + 1, APPLICATION_WIZARD_STEPS.length - 1);
}

export function previousSupplierApplicationStep(step: number): number {
  return Math.max(step - 1, 0);
}

export function buildSupplierApplicationPayload(form: SupplierApplicationForm): CreateSupplierApplicationInput {
  if (!form.privacyConsentAccepted) {
    throw new Error("Privacy consent is required before submitting an application");
  }
  return {
    companyName: form.companyName.trim(),
    contactName: form.contactName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim() || undefined,
    categoryId: form.categoryId || undefined,
    pastEvents: form.pastEvents.trim() || undefined,
    serviceInclusions: form.serviceInclusions.trim() || undefined,
    priceRange: form.priceRange || undefined,
    certifications: form.certifications.trim() || undefined,
    portfolioUrl: form.portfolioUrl.trim() || undefined,
    additionalNotes: form.additionalNotes.trim() || undefined,
    bniMember: form.bniMember,
    privacyConsentAccepted: true,
    privacyNoticeVersion: form.privacyNoticeVersion,
  };
}

export function mapSupplierApplicationSubmitError(error: unknown, fallback = "Unable to submit application"): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function buildSupplierApplicationReference(now: Date = new Date(), random = Math.random()): string {
  const year = now.getFullYear();
  const suffix = Math.floor(1000 + random * 9000);
  return `SAP-${year}-${suffix}`;
}
