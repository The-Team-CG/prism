import { supplierAuthRepository } from "../data/supplier-auth-repository";
import {
  loginSchema,
  parseContract,
  requestEmailSignInCodeSchema,
  verifyEmailSignInCodeSchema,
  privacyNoticePath,
  type PrismAuthenticatedSession,
  type PrismSignInSession,
} from "@prism/types";
import {
  approvalRequestPayload,
  isSupplierRole,
  mapWrongPortalMessage,
  resolvePostSignInPath,
} from "../model/supplier-sign-in-rules";
import type { SupplierSignInDraft } from "../model/supplier-sign-in-types";

export function loadExistingSupplierSession(): PrismAuthenticatedSession | null {
  return supplierAuthRepository.readSession();
}

export type SupplierSignInResult =
  | { session: PrismAuthenticatedSession; redirectTo: string }
  /** The password was right and the account has two-step sign-in on: the code comes next. */
  | { twoStepToken: string };

function finishSignIn(session: PrismSignInSession, nextPath: string | null | undefined) {
  if (!isSupplierRole(session.role)) {
    void supplierAuthRepository.endRejectedSession(session.accessToken);
    throw new Error(mapWrongPortalMessage(session.role));
  }
  supplierAuthRepository.saveSession(session);
  const next = resolvePostSignInPath(nextPath);
  return { session, redirectTo: session.privacyNoticeRequired ? privacyNoticePath(next) : next };
}

export async function signInSupplier(input: {
  draft: SupplierSignInDraft;
  nextPath?: string | null;
}): Promise<SupplierSignInResult> {
  const credentials = parseContract(loginSchema, input.draft, "Supplier sign-in");
  const authResponse = await supplierAuthRepository.login(credentials);
  if (!("kind" in authResponse)) return finishSignIn(authResponse, input.nextPath);
  // Only PMCM admins are asked to set two-step sign-in up while signing in, and they belong in the event portal.
  if (authResponse.kind === "two_factor_setup_required") throw new Error(mapWrongPortalMessage("pmcm-admin"));
  return { twoStepToken: authResponse.token };
}

/** Emails a sign-in code; unknown emails look sent, so only a refused request is an error. */
export async function requestSupplierEmailCode(email: string): Promise<void> {
  const input = parseContract(requestEmailSignInCodeSchema, { email }, "Sign-in code request");
  await supplierAuthRepository.requestEmailCode(input.email);
}

/** Signs in with the emailed code; an account with two-step sign-in on still gets its authenticator step. */
export async function signInSupplierWithEmailCode(input: { email: string; code: string; nextPath?: string | null }): Promise<SupplierSignInResult> {
  const parsed = parseContract(verifyEmailSignInCodeSchema, { email: input.email, code: input.code }, "Sign-in code");
  const authResponse = await supplierAuthRepository.verifyEmailCode(parsed.email, parsed.code);
  if (!("kind" in authResponse)) return finishSignIn(authResponse, input.nextPath);
  if (authResponse.kind === "two_factor_setup_required") throw new Error(mapWrongPortalMessage("pmcm-admin"));
  return { twoStepToken: authResponse.token };
}

/** Finishes signing in with the code from the authenticator app; a PMCM account is turned away like at the password. */
export async function verifySupplierSignInCode(input: {
  token: string;
  code: string;
  nextPath?: string | null;
}): Promise<{ session: PrismAuthenticatedSession; redirectTo: string }> {
  return finishSignIn(await supplierAuthRepository.verifyTwoStep(input.token, input.code), input.nextPath);
}

export async function requestSupplierApproval(
  email: string,
  privacyConsentAccepted: boolean,
): Promise<void> {
  await supplierAuthRepository.requestApproval(
    approvalRequestPayload(email, privacyConsentAccepted),
  );
}
