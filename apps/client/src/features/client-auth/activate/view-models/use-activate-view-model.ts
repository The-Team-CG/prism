"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  canSubmitActivationPassword,
  isUsableActivationToken,
  type ActivateView,
} from "../model/activate-model";
import { activateClientAccount } from "../use-cases/activate";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useClientActivateViewModel() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rejectedByApi, setRejectedByApi] = useState(false);
  const [activated, setActivated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  const view: ActivateView =
    token === null
      ? "loading"
      : activated
        ? "done"
        : rejectedByApi || !isUsableActivationToken(token)
          ? "invalid"
          : "set";
  const canSubmit = canSubmitActivationPassword(password, confirmPassword);

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await activateClientAccount({ token, password });
      if (outcome.status === "invalid_token") {
        setRejectedByApi(true);
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setActivated(true);
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
    canSubmit,
    busy,
    error,
    setPassword,
    setConfirmPassword,
    setShowPassword,
    activate,
  };
}
