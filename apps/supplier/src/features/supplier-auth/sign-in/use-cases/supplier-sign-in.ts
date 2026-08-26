import { supplierAuthRepository } from "../data/supplier-auth-repository";
import type { PrismAuthenticatedSession } from "@prism/types";
import {
  approvalRequestPayload,
  buildSupplierSession,
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
  const user = await supplierAuthRepository.login(input.draft.email, input.draft.password);
  if (!isSupplierRole(user.role)) {
    throw new Error(mapWrongPortalMessage(user.role));
  }
  const session = buildSupplierSession(user);
  supplierAuthRepository.saveSession(session);
  return {
    session,
    redirectTo: resolvePostSignInPath(input.nextPath),
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
