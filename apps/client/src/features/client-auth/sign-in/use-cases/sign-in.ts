import { clientAuthRepository } from "../data/client-auth-repository";
import {
  findClientSampleUser,
  isClientRole,
  mapSignInError,
  mapSignInFailure,
  portalMessage,
  resolvePostSignInPath,
} from "../model/sign-in-rules";
import type { SignInDraft } from "../model/sign-in-types";
import { PRIVACY_NOTICE_VERSION } from "../model/sign-in-types";
import type { PrismUser } from "@/lib/prism-api";

export type SignInResult =
  | { ok: true; session: PrismUser & { signedInAt: string }; redirectTo: string }
  | { ok: false; error: string; pendingUser: PrismUser | null };

export async function signInClient(input: {
  draft: SignInDraft;
  nextPath?: string | null;
}): Promise<SignInResult> {
  try {
    const session = await clientAuthRepository.login(input.draft);
    if (!isClientRole(session.role)) {
      return { ok: false, error: portalMessage(session.role), pendingUser: null };
    }
    clientAuthRepository.saveClientSession(session);
    return {
      ok: true,
      session,
      redirectTo: resolvePostSignInPath(input.nextPath),
    };
  } catch (err) {
    const message = mapSignInError(err);
    const sampleUser = findClientSampleUser(input.draft.email);
    const mapped = mapSignInFailure({ message, sampleUser });
    return { ok: false, error: mapped.error, pendingUser: mapped.pendingUser };
  }
}

export async function requestClientApproval(user: PrismUser, consentAccepted: boolean) {
  return clientAuthRepository.requestApproval(user.email, {
    privacyConsentAccepted: consentAccepted,
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    marketingConsentAccepted: false,
  });
}
