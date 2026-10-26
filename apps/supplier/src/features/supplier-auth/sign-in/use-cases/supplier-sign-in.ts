import { supplierAuthRepository } from "../data/supplier-auth-repository";
import {
  isPrismAuthenticatedSession,
  loginSchema,
  parseContract,
  privacyNoticePath,
  type PrismAuthenticatedSession,
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

export async function signInSupplier(input: {
  draft: SupplierSignInDraft;
  nextPath?: string | null;
}): Promise<{ session: PrismAuthenticatedSession; redirectTo: string }> {
  const credentials = parseContract(loginSchema, input.draft, "Supplier sign-in");
  const authResponse = await supplierAuthRepository.login(credentials);
  if (!isPrismAuthenticatedSession(authResponse)) {
    throw new Error(mapWrongPortalMessage("pmcm-admin"));
  }
  const user = authResponse;
  if (!isSupplierRole(user.role)) {
    throw new Error(mapWrongPortalMessage(user.role));
  }
  const session = user;
  supplierAuthRepository.saveSession(session);
  const nextPath = resolvePostSignInPath(input.nextPath);
  return {
    session,
    redirectTo: session.privacyNoticeRequired ? privacyNoticePath(nextPath) : nextPath,
  };
}

export async function requestSupplierApproval(
  email: string,
  privacyConsentAccepted: boolean,
): Promise<void> {
  await supplierAuthRepository.requestApproval(
    approvalRequestPayload(email, privacyConsentAccepted),
  );
}
