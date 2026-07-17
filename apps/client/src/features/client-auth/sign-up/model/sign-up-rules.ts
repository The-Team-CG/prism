import type { AccessRequestDraft } from "./sign-up-types";

export function isAccessRequestValid(draft: AccessRequestDraft): boolean {
  return (
    draft.fullName.trim().length > 0 &&
    draft.email.trim().length > 0 &&
    draft.organization.trim().length > 0 &&
    draft.eventName.trim().length > 0
  );
}

export function normalizeAccessRequest(draft: AccessRequestDraft): AccessRequestDraft {
  return {
    fullName: draft.fullName.trim(),
    email: draft.email.trim(),
    organization: draft.organization.trim(),
    eventName: draft.eventName.trim(),
    inquiryCode: draft.inquiryCode.trim(),
    message: draft.message.trim(),
  };
}
