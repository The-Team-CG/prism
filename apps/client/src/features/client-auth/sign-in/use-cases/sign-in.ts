import { clientAuthRepository } from "../data/client-auth-repository";
import {
  frontDoorPortalSignInUrl,
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

export function finishSignIn(session: PrismSignInSession, nextPath: string | null | undefined): SignInResult {
  if (!isClientRole(session.role)) {
    void clientAuthRepository.endRejectedSession(session.accessToken);
    return { kind: "error", error: portalMessage(session.role), restart: true };
  }
  clientAuthRepository.saveClientSession(session);
  const next = resolvePostSignInPath(nextPath);
  return { kind: "signed_in", session, redirectTo: session.privacyNoticeRequired ? privacyNoticePath(next) : next };
}

/** How a finished sign-in is handled: the client portal keeps clients only; the shared front door sends anyone home. */
export type FinishSignIn = (session: PrismSignInSession, nextPath: string | null | undefined) => SignInResult;

/**
 * The shared "Sign in to P.R.I.S.M." page: clients continue here, suppliers and PMCM staff go to their portal, whose
 * sign-in page picks up the session cookie the API set for it. Nobody signs in twice.
 */
export function finishFrontDoorSignIn(session: PrismSignInSession, nextPath: string | null | undefined): SignInResult {
  if (isClientRole(session.role)) return finishSignIn(session, nextPath);
  const portalSignIn = frontDoorPortalSignInUrl(session.role);
  if (!portalSignIn) {
    void clientAuthRepository.endRejectedSession(session.accessToken);
    return { kind: "error", error: portalMessage(session.role), restart: true };
  }
  return { kind: "signed_in", session, redirectTo: portalSignIn };
}

/** A client already signed in by the API's cookie (from the shared sign-in page) continues without signing in again. */
export async function resumeClientCookieSession(nextPath: string | null | undefined): Promise<SignInResult | null> {
  if (clientAuthRepository.hasSignedInSession()) return null;
  const session = await clientAuthRepository.cookieSession();
  if (!session || !isClientRole(session.role)) return null;
  return finishSignIn(session, nextPath);
}

export async function signInClient(input: {
  draft: SignInDraft;
  nextPath?: string | null;
  finish?: FinishSignIn;
}): Promise<SignInResult> {
  const finish = input.finish ?? finishSignIn;
  try {
    const response = await clientAuthRepository.login(input.draft);
    if (!("kind" in response)) return finish(response, input.nextPath);
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
export async function signInClientWithEmailCode(input: { email: string; code: string; nextPath?: string | null; finish?: FinishSignIn }): Promise<SignInResult> {
  const finish = input.finish ?? finishSignIn;
  try {
    const response = await clientAuthRepository.verifyEmailCode(input.email, input.code);
    if (!("kind" in response)) return finish(response, input.nextPath);
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
  finish?: FinishSignIn;
}): Promise<SignInResult> {
  const finish = input.finish ?? finishSignIn;
  try {
    return finish(await clientAuthRepository.verifyTwoStep(input.token, input.code), input.nextPath);
  } catch (err) {
    const problem = signInCodeProblem(mapSignInError(err));
    return { kind: "error", error: problem.text, restart: problem.restart };
  }
}
