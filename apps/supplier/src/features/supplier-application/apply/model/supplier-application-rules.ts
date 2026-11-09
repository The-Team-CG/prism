import type { CreateSupplierApplicationInput } from "@prism/types";
import type { SupplierApplicationForm } from "./supplier-application-types";

/** Required items that are still missing, in form order. An empty list means the application can be submitted. */
export function missingSupplierApplicationItems(form: SupplierApplicationForm): string[] {
  const missing: string[] = [];
  if (!form.companyName.trim()) missing.push("company name");
  if (!form.contactName.trim()) missing.push("contact person");
  if (!form.email.trim()) missing.push("email address");
  if (!form.categoryId) missing.push("service category");
  if (!form.privacyConsentAccepted) missing.push("privacy notice consent");
  return missing;
}

export function isSupplierApplicationReady(form: SupplierApplicationForm): boolean {
  return missingSupplierApplicationItems(form).length === 0;
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
