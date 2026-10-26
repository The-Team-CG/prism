import { activateAccountSchema } from "@prism/types";
import { passwordsMatch } from "../../new-password/model/new-password-rules";

export const ACTIVATION_INVALID_COPY =
  "This invitation link has expired or was already used. Ask PMCM to send a new one.";

/** "loading" is the state before the activation token has been read from the URL. */
export type ActivateView = "loading" | "set" | "invalid" | "done";

/** The API answers 400 for an invalid, expired or used token. The view shows the invalid state for it. */
export class ActivationTokenRejectedError extends Error {
  constructor() {
    super(ACTIVATION_INVALID_COPY);
    this.name = "ActivationTokenRejectedError";
  }
}

export function isUsableActivationToken(token: string): boolean {
  return activateAccountSchema.shape.token.safeParse(token).success;
}

export function canSubmitActivation(password: string, confirmPassword: string): boolean {
  return activateAccountSchema.shape.password.safeParse(password).success && passwordsMatch(password, confirmPassword);
}

export function activationProgress(view: "set" | "done") {
  const total = 2;
  if (view === "done") return { current: 2, total, label: "You're all set" };
  return { current: 1, total, label: "Set your password" };
}
