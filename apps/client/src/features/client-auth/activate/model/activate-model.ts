import { activateAccountSchema } from "@prism/types";

export const ACTIVATION_INVALID_COPY =
  "This invitation link has expired or was already used. We can email you a sign-in code instead.";

/** "loading" is the state before the invitation has been read; "confirm" is the first visit, "set" the password option. */
export type ActivateView = "loading" | "confirm" | "set" | "invalid" | "done";

/** Same rule the API applies to the token, so a malformed link never reaches the API. */
export function isUsableActivationToken(token: string): boolean {
  return activateAccountSchema.shape.token.safeParse(token).success;
}

export function canSubmitActivationPassword(password: string, confirmPassword: string): boolean {
  return activateAccountSchema.shape.password.safeParse(password).success && password === confirmPassword;
}

/** First visit: confirm it's you, then the privacy notice. Choosing a password adds no step. */
export function activateProgress(view: Extract<ActivateView, "confirm" | "set" | "done">) {
  if (view === "done") return { current: 2, total: 2, label: "You're all set" };
  if (view === "set") return { current: 1, total: 2, label: "Set your password" };
  return { current: 1, total: 2, label: "Confirm it's you" };
}
