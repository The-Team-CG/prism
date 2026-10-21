import {
  PRISM_PRIVACY_NOTICE_VERSION,
  parseContract,
  requestApprovalSchema,
  type PrismAuthenticatedSession,
  type RequestApprovalInput,
} from "@prism/types";
import type { SupplierSignInDraft } from "./supplier-sign-in-types";

export const SUPPLIER_AUTH_API_OFFLINE_MESSAGE =
  "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";

export const DEFAULT_SIGN_IN_DRAFT: SupplierSignInDraft = {
  email: "",
  password: "",
};

export function isSupplierSignInDraftValid(draft: SupplierSignInDraft): boolean {
  return draft.email.trim().length > 0 && draft.password.length > 0;
}

export function isSupplierRole(role: string): boolean {
  return role === "supplier";
}

export function mapWrongPortalMessage(role: string): string {
  if (role === "client") {
    return "Client accounts belong in the client portal.";
  }
  return "PMCM accounts belong in the event command portal.";
}

export function resolvePostSignInPath(nextParam: string | null | undefined): string {
  if (nextParam && nextParam.startsWith("/")) return nextParam;
  return "/dashboard";
}

export function isExistingSupplierSession(session: PrismAuthenticatedSession | null): session is PrismAuthenticatedSession {
  return Boolean(session && session.role === "supplier");
}

export function mapSupplierSignInError(
  error: unknown,
  fallback = "Supplier sign in failed",
): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function mapApprovalRequestError(
  error: unknown,
  fallback = "Unable to request approval",
): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function approvalRequestPayload(
  email: string,
  privacyConsentAccepted: boolean,
): RequestApprovalInput {
  if (!privacyConsentAccepted) {
    throw new Error("Privacy consent is required before requesting supplier account approval");
  }
  return parseContract(requestApprovalSchema, {
    email,
    privacyConsentAccepted: true,
    privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
    marketingConsentAccepted: false,
  }, "Supplier approval request");
}
