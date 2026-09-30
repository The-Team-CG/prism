import { clientAuthRepository } from "../data/client-auth-repository";
import {
  isClientRole,
  mapSignInError,
  mapSignInFailure,
  portalMessage,
  resolvePostSignInPath,
} from "../model/sign-in-rules";
import type { SignInDraft } from "../model/sign-in-types";
import type { PrismUser } from "@prism/types";

export type SignInResult =
  | { ok: true; session: PrismUser & { signedInAt: string }; redirectTo: string }
  | { ok: false; error: string };

export async function signInClient(input: {
  draft: SignInDraft;
  nextPath?: string | null;
}): Promise<SignInResult> {
  try {
    const session = await clientAuthRepository.login(input.draft);
    if (!isClientRole(session.role)) {
      return { ok: false, error: portalMessage(session.role) };
    }
    clientAuthRepository.saveClientSession(session);
    return {
      ok: true,
      session,
      redirectTo: resolvePostSignInPath(input.nextPath),
    };
  } catch (err) {
    const message = mapSignInError(err);
    const mapped = mapSignInFailure({ message });
    return { ok: false, error: mapped };
  }
}
