import { activateAccountSchema } from "@prism/types";
import { supplierAuthRepository } from "../../sign-in/data/supplier-auth-repository";
import { ActivationTokenRejectedError } from "../model/activate-model";
import { finishSignIn, requestSupplierEmailCode } from "../../sign-in/use-cases/supplier-sign-in";
import { mapWrongPortalMessage } from "../../sign-in/model/supplier-sign-in-rules";

export function previewSupplierInvitation(token: string) {
  return supplierAuthRepository.previewInvitation(token);
}

/** Uses the invitation and signs the supplier straight in; the privacy notice is the next step. */
export async function confirmSupplierInvitation(token: string): Promise<{ redirectTo: string } | { twoStepToken: string }> {
  const response = await supplierAuthRepository.confirmInvitation(token);
  if (!("kind" in response)) return finishSignIn(response, "/dashboard");
  if (response.kind === "two_factor_setup_required") throw new Error(mapWrongPortalMessage("pmcm-admin"));
  return { twoStepToken: response.token };
}

export { requestSupplierEmailCode };

export async function activateSupplierAccount(input: { token: string; password: string }): Promise<void> {
  const parsed = activateAccountSchema.safeParse(input);
  if (!parsed.success) {
    const badToken = parsed.error.issues.some((issue) => issue.path[0] === "token");
    if (badToken) throw new ActivationTokenRejectedError();
    throw new Error("Password must be 12 to 128 characters.");
  }
  await supplierAuthRepository.activateAccount(parsed.data);
}
