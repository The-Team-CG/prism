import type { SupplierAuthUser, SupplierSampleAccount, SupplierSession, SupplierSignInDraft } from "./supplier-sign-in-types";

export const SUPPLIER_AUTH_API_OFFLINE_MESSAGE =
  "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";

export const PRIVACY_NOTICE_VERSION = "2026-05-01";

export const SAMPLE_SUPPLIER_ACCOUNTS: SupplierSampleAccount[] = [
  {
    email: "ops@xperto.test",
    password: "prism-supplier",
    label: "Xperto Events",
    tier: "Tier 1 supplier",
  },
  {
    email: "flowers@bloom.test",
    password: "prism-supplier",
    label: "Bloom Florals",
    tier: "Tier 2 supplier",
  },
];

export const DEFAULT_SIGN_IN_DRAFT: SupplierSignInDraft = {
  email: "ops@xperto.test",
  password: "prism-supplier",
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

export function buildSupplierSession(
  user: SupplierAuthUser,
  signedInAt: string = new Date().toISOString(),
): SupplierSession {
  return {
    ...user,
    signedInAt,
  };
}

export function resolvePostSignInPath(nextParam: string | null | undefined): string {
  if (nextParam && nextParam.startsWith("/")) return nextParam;
  return "/dashboard";
}

export function isExistingSupplierSession(session: SupplierSession | null): session is SupplierSession {
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

export function approvalRequestPayload(email: string, privacyConsentAccepted: boolean) {
  return {
    email,
    privacyConsentAccepted,
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    marketingConsentAccepted: false,
  };
}
