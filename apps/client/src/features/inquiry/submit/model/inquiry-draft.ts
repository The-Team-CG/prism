import { PRISM_SESSION_STORAGE_KEYS, readPrismSession, savePrismSession, clearPrismSession } from "@prism/types";
import { INITIAL_INQUIRY_FORM, type InquiryForm } from "./inquiry-submit-types";

/** FR-50: the draft as kept in this browser: its resume token and the form so far. */
export type LocalInquiryDraft = { token: string; form: InquiryForm };

export function newDraftToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function readLocalDraft(): LocalInquiryDraft | null {
  const draft = readPrismSession<LocalInquiryDraft>(PRISM_SESSION_STORAGE_KEYS.inquiryDraft);
  return draft?.token && draft.form ? draft : null;
}

export function saveLocalDraft(draft: LocalInquiryDraft) {
  savePrismSession(PRISM_SESSION_STORAGE_KEYS.inquiryDraft, draft);
}

export function clearLocalDraft() {
  clearPrismSession(PRISM_SESSION_STORAGE_KEYS.inquiryDraft);
}

/** True when the visitor has typed anything worth keeping. */
export function hasDraftContent(form: InquiryForm): boolean {
  return (Object.keys(INITIAL_INQUIRY_FORM) as Array<keyof InquiryForm>).some((key) => key !== "privacyNoticeVersion" && form[key] !== INITIAL_INQUIRY_FORM[key]);
}

/** The server copy only exists once the visitor accepts the privacy notice and gives an email to be reminded at. */
export function serverDraftAllowed(form: InquiryForm): boolean {
  return form.privacyConsentAccepted && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
}

export function draftPayload(form: InquiryForm): Record<string, string | boolean> {
  return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === "boolean" ? value : String(value).slice(0, 2_000)]));
}

/** Applies a saved payload over a fresh form, ignoring fields this version of the form does not have. */
export function formFromPayload(payload: Record<string, string | boolean>): InquiryForm {
  const form: InquiryForm = { ...INITIAL_INQUIRY_FORM };
  for (const key of Object.keys(INITIAL_INQUIRY_FORM) as Array<keyof InquiryForm>) {
    const value = payload[key];
    if (typeof value === typeof INITIAL_INQUIRY_FORM[key]) (form as Record<string, string | boolean>)[key] = value as string | boolean;
  }
  return { ...form, privacyNoticeVersion: INITIAL_INQUIRY_FORM.privacyNoticeVersion };
}
