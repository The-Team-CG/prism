import { clientAuthRepository } from "../data/client-auth-repository";
import {
  isClientRole,
  mapSignInError,
  mapSignInFailure,
  portalMessage,
  resolvePostSignInPath,
} from "../model/sign-in-rules";
import type { SignInDraft } from "../model/sign-in-types";
import { privacyNoticePath, requestEmailSignInCodeSchema, type PrismSignInSession, type PrismUser } from "@prism/types";
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

/** Asks for an emailed sign-in code. Only a refused request (network, rate limit) is an error; unknown emails look sent. */
export async function requestClientEmailCode(email: string): Promise<{ kind: "sent" } | { kind: "error"; error: string }> {
  const parsed = requestEmailSignInCodeSchema.safeParse({ email });
  if (!parsed.success) return { kind: "error", error: "Enter the email address PMCM has for you." };
  try {
    await clientAuthRepository.requestEmailCode(parsed.data.email);
    return { kind: "sent" };
  } catch (err) {
    return { kind: "error", error: mapSignInFailure({ message: mapSignInError(err) }) };
  }
}

/** Signs in with the emailed code; an account with two-step sign-in on still gets its authenticator step. */
export async function signInClientWithEmailCode(input: { email: string; code: string; nextPath?: string | null }): Promise<SignInResult> {
  try {
    const response = await clientAuthRepository.verifyEmailCode(input.email, input.code);
    if (!("kind" in response)) return finishSignIn(response, input.nextPath);
    if (response.kind === "two_factor_setup_required") return { kind: "error", error: portalMessage("pmcm-admin") };
    return { kind: "two_step", token: response.token };
  } catch (err) {
    return { kind: "error", error: mapSignInError(err) };
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
