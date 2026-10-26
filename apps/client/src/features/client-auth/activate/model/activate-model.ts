import { activateAccountSchema } from "@prism/types";

export const ACTIVATION_INVALID_COPY =
  "This invitation link has expired or was already used. Ask PMCM to send a new one.";

/** "loading" is the state before the invitation token has been read from the URL. */
export type ActivateView = "loading" | "set" | "invalid" | "done";

/** Same rule the API applies to the token, so a malformed link never reaches the API. */
export function isUsableActivationToken(token: string): boolean {
  return activateAccountSchema.shape.token.safeParse(token).success;
}

export function canSubmitActivationPassword(password: string, confirmPassword: string): boolean {
  return activateAccountSchema.shape.password.safeParse(password).success && password === confirmPassword;
}

export function activateProgress(view: Extract<ActivateView, "set" | "done">) {
  if (view === "done") return { current: 2, total: 2, label: "You're all set" };
  return { current: 1, total: 2, label: "Set your password" };
}
