import { describe, expect, it } from "vitest";
import { INITIAL_INQUIRY_FORM } from "./inquiry-submit-types";
import { draftPayload, formFromPayload, hasDraftContent, serverDraftAllowed } from "./inquiry-draft";

describe("FR-50 inquiry drafts in the browser", () => {
  it("keeps a draft only once something is typed, and on the server only after consent and an email", () => {
    expect(hasDraftContent(INITIAL_INQUIRY_FORM)).toBe(false);
    const typed = { ...INITIAL_INQUIRY_FORM, eventName: "Acme Gala", email: "ana@acme.test" };
    expect(hasDraftContent(typed)).toBe(true);
    expect(serverDraftAllowed(typed)).toBe(false);
    expect(serverDraftAllowed({ ...typed, privacyConsentAccepted: true })).toBe(true);
    expect(serverDraftAllowed({ ...typed, privacyConsentAccepted: true, email: "not-an-email" })).toBe(false);
  });

  it("round-trips the form through the saved payload and ignores fields the form no longer has", () => {
    const typed = { ...INITIAL_INQUIRY_FORM, eventName: "Acme Gala", privacyConsentAccepted: true };
    const restored = formFromPayload({ ...draftPayload(typed), retiredField: "x", eventDate: 42 as unknown as string });
    expect(restored.eventName).toBe("Acme Gala");
    expect(restored.privacyConsentAccepted).toBe(true);
    expect(restored).not.toHaveProperty("retiredField");
    expect(restored.eventDate).toBe(INITIAL_INQUIRY_FORM.eventDate);
  });
});
