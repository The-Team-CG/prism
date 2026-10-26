export const PASSWORD_RESET_STEPS = [
  { id: "request", label: "Enter your email" },
  { id: "check", label: "Check your email" },
  { id: "set", label: "Set a new password" },
] as const;

export const PASSWORD_RESET_DONE_LABEL = "Password updated";

export type PasswordResetStepId = (typeof PASSWORD_RESET_STEPS)[number]["id"];
/** "loading" is the state before the reset token has been read from the URL. */
export type PasswordResetView = "loading" | PasswordResetStepId | "done";

export function passwordResetProgress(view: Exclude<PasswordResetView, "loading">) {
  const total = PASSWORD_RESET_STEPS.length;
  if (view === "done") return { current: total, total, label: PASSWORD_RESET_DONE_LABEL };
  const index = PASSWORD_RESET_STEPS.findIndex((step) => step.id === view);
  return { current: index + 1, total, label: PASSWORD_RESET_STEPS[index].label };
}

/** Same copy whether or not the account exists, so the page never reveals account membership. */
export function passwordResetSentCopy(email: string) {
  return `If an account exists for ${email}, we sent a reset link. It expires in 15 minutes.`;
}
