import { clientAuthRepository } from "../data/client-auth-repository";
import {
  isClientRole,
  mapSignInError,
  mapSignInFailure,
  portalMessage,
  resolvePostSignInPath,
} from "../model/sign-in-rules";
import type { SignInDraft } from "../model/sign-in-types";
import { privacyNoticePath, type PrismSignInSession, type PrismUser } from "@prism/types";
import { signInCodeProblem } from "@prism/ui/sign-in-code-step";

export type SignInResult =
  | { kind: "signed_in"; session: PrismUser & { signedInAt: string }; redirectTo: string }
  /** The password was right and the account has two-step sign-in on: the code comes next. */
  | { kind: "two_step"; token: string }
  /** `restart` sends the person back to email and password. */
  | { kind: "error"; error: string; restart?: boolean };

function finishSignIn(session: PrismSignInSession, nextPath: string | null | undefined): SignInResult {
  if (!isClientRole(session.role)) {
    void clientAuthRepository.endRejectedSession(session.accessToken);
    return { kind: "error", error: portalMessage(session.role), restart: true };
  }
  clientAuthRepository.saveClientSession(session);
  const next = resolvePostSignInPath(nextPath);
  return { kind: "signed_in", session, redirectTo: session.privacyNoticeRequired ? privacyNoticePath(next) : next };
}

export async function signInClient(input: {
  draft: SignInDraft;
  nextPath?: string | null;
}): Promise<SignInResult> {
  try {
    const response = await clientAuthRepository.login(input.draft);
    if (!("kind" in response)) return finishSignIn(response, input.nextPath);
    // Only PMCM admins are asked to set two-step sign-in up while signing in, and they belong in the event portal.
    if (response.kind === "two_factor_setup_required") return { kind: "error", error: portalMessage("pmcm-admin") };
    return { kind: "two_step", token: response.token };
  } catch (err) {
    return { kind: "error", error: mapSignInFailure({ message: mapSignInError(err) }) };
  }
}

export async function verifyClientSignInCode(input: {
  token: string;
  code: string;
  nextPath?: string | null;
}): Promise<SignInResult> {
  try {
    return finishSignIn(await clientAuthRepository.verifyTwoStep(input.token, input.code), input.nextPath);
  } catch (err) {
    const problem = signInCodeProblem(mapSignInError(err));
    return { kind: "error", error: problem.text, restart: problem.restart };
  }
}
