import { activateAccountSchema, parseContract, type ActivateAccountInput } from "@prism/types";
import { clientAuthRepository } from "../../sign-in/data/client-auth-repository";
import { finishSignIn, type SignInResult } from "../../sign-in/use-cases/sign-in";
import { mapSignInError, portalMessage } from "../../sign-in/model/sign-in-rules";

export async function activateClientAccount(input: ActivateAccountInput) {
  const payload = parseContract(activateAccountSchema, input, "Account activation");
  return clientAuthRepository.activateAccount(payload);
}

export function previewClientInvitation(token: string) {
  return clientAuthRepository.previewInvitation(token);
}

/** Uses the invitation and signs the client straight in; the privacy notice is the next step. */
export async function confirmClientInvitation(token: string): Promise<SignInResult> {
  try {
    const response = await clientAuthRepository.confirmInvitation(token);
    if (!("kind" in response)) return finishSignIn(response, "/dashboard");
    if (response.kind === "two_factor_setup_required") return { kind: "error", error: portalMessage("pmcm-admin") };
    return { kind: "two_step", token: response.token };
  } catch (err) {
    return { kind: "error", error: mapSignInError(err, "Could not open your account. Try the link again.") };
  }
}
