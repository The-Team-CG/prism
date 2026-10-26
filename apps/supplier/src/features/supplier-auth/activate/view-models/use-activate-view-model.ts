"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ActivationTokenRejectedError,
  canSubmitActivation,
  isUsableActivationToken,
  type ActivateView,
} from "../model/activate-model";
import { activateSupplierAccount } from "../use-cases/activate";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useSupplierActivateViewModel() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tokenRejected, setTokenRejected] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  const view: ActivateView = done
    ? "done"
    : token === null
      ? "loading"
      : tokenRejected || !isUsableActivationToken(token)
        ? "invalid"
        : "set";
  const canSubmit = canSubmitActivation(password, confirmPassword);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      await activateSupplierAccount({ token, password });
      setPassword("");
      setConfirmPassword("");
      setDone(true);
    } catch (err) {
      if (err instanceof ActivationTokenRejectedError) setTokenRejected(true);
      else setError(errorMessage(err, "Unable to set your password."));
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
    submit,
  };
}
