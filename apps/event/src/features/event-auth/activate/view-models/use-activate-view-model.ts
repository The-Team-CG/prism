"use client";

import { FormEvent, useEffect, useState } from "react";
import { passwordSetupChecks } from "../../password-setup/model/password-setup-model";
import { activationPasswordError, isActivationTokenUsable, type ActivateView } from "../model/activate-model";
import { activateEventAccount } from "../use-cases/activate";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useEventActivateViewModel() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [outcome, setOutcome] = useState<"editing" | "activated" | "expired">("editing");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  const view: ActivateView =
    token === null
      ? "loading"
      : !isActivationTokenUsable(token) || outcome === "expired"
        ? "invalid"
        : outcome === "activated"
          ? "done"
          : "set";
  const checks = passwordSetupChecks(password, confirmPassword);
  const passwordError = activationPasswordError(password, confirmPassword);

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || passwordError !== null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await activateEventAccount({ token, password });
      setPassword("");
      setConfirmPassword("");
      setOutcome(result === "activated" ? "activated" : "expired");
    } catch (err) {
      setError(errorMessage(err, "Unable to set your password."));
    } finally {
      setBusy(false);
    }
  }

  return {
    view,
    password,
    confirmPassword,
    showPassword,
    checks,
    canSubmit: passwordError === null,
    busy,
    error,
    setPassword,
    setConfirmPassword,
    setShowPassword,
    activate,
  };
}
