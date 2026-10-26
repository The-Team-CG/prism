import { activateAccountSchema } from "@prism/types";

export const ACTIVATION_INVALID_COPY =
  "This invitation link has expired or was already used. Ask PMCM to send a new one.";

export const ACTIVATION_STEPS = [
  { id: "set", label: "Set your password" },
  { id: "done", label: "You're all set" },
] as const;

/** "loading" is the state before the activation token has been read from the URL. */
export type ActivateView = "loading" | "set" | "invalid" | "done";

/** A link is usable only if its token passes the same rule the API enforces on submit. */
export function isActivationTokenUsable(token: string) {
  return activateAccountSchema.shape.token.safeParse(token).success;
}

/** The first rule the new password breaks, or null when it can be submitted. */
export function activationPasswordError(password: string, confirmPassword: string): string | null {
  const parsed = activateAccountSchema.shape.password.safeParse(password);
  if (!parsed.success) return parsed.error.issues[0].message;
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
}

export function activationProgress(view: Exclude<ActivateView, "loading" | "invalid">) {
  const index = ACTIVATION_STEPS.findIndex((step) => step.id === view);
  return { current: index + 1, total: ACTIVATION_STEPS.length, label: ACTIVATION_STEPS[index].label };
}
