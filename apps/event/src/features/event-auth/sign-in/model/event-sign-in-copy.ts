export function signInSubmitLabel(busy: boolean, phase: string) {
  if (busy) return "Checking...";
  if (phase === "password") return "Sign in";
  if (phase === "backup-codes") return "I saved them, continue";
  return "Verify code";
}

export function twoFactorCopy(phase: string) {
  if (phase === "setup") {
    return {
      title: "Set up two-factor authentication",
      detail: "Add this account to an authenticator app, then enter the generated six-digit code.",
    };
  }
  if (phase === "backup-codes") {
    return {
      title: "Save your backup codes",
      detail: "If you lose your phone, each of these codes signs you in once instead of the authenticator. Keep them somewhere safe.",
    };
  }
  return {
    title: "Enter your authenticator code",
    detail: "Enter the current six-digit code from your authenticator app to finish signing in.",
  };
}

export function nextPathFromSearch(search: string | null | undefined) {
  if (!search) return null;
  return new URLSearchParams(search).get("next");
}
