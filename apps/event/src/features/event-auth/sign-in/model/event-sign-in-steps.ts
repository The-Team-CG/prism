import type { PrismAuthStepProgress } from "@prism/ui/auth-shell";

export const EVENT_SIGN_IN_STEPS = [
  { id: "password", label: "Password" },
  { id: "two-factor", label: "Authenticator code" },
] as const;

export type EventSignInPhase = "password" | "setup" | "verify" | "backup-codes";

/** Step indicator for the two-factor phases; the password step has no indicator. */
export function eventSignInProgress(phase: EventSignInPhase): PrismAuthStepProgress | undefined {
  if (phase === "password") return undefined;
  if (phase === "backup-codes") return { current: EVENT_SIGN_IN_STEPS.length, total: EVENT_SIGN_IN_STEPS.length, label: "Save your backup codes" };
  const index = EVENT_SIGN_IN_STEPS.findIndex((step) => step.id === "two-factor");
  return { current: index + 1, total: EVENT_SIGN_IN_STEPS.length, label: EVENT_SIGN_IN_STEPS[index].label };
}
