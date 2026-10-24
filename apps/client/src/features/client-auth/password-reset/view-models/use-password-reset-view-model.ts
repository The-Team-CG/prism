"use client";

import { FormEvent, useEffect, useState } from "react";
import { passwordResetChecks, type PasswordResetView } from "../model/password-reset-model";
import { consumeClientPasswordReset, requestClientPasswordReset } from "../use-cases/password-reset";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useClientPasswordResetViewModel() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  const view: PasswordResetView = done
    ? "done"
    : token === null
      ? "loading"
      : token
        ? "set"
        : sentTo
          ? "check"
          : "request";
  const checks = passwordResetChecks(password, confirmPassword);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSetPassword = checks.every((check) => check.met);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSentTo(await requestClientPasswordReset(email));
    } catch (err) {
      setError(errorMessage(err, "Unable to request a password reset."));
    } finally {
      setBusy(false);
    }
  }

  async function consumeReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !canSetPassword) return;
    setBusy(true);
    setError(null);
    try {
      await consumeClientPasswordReset({ token, password });
      setPassword("");
      setConfirmPassword("");
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, "Unable to set a new password."));
    } finally {
      setBusy(false);
    }
  }

  function useDifferentEmail() {
    setSentTo(null);
    setEmail("");
    setError(null);
  }

  return {
    view,
    email,
    sentTo,
    password,
    confirmPassword,
    showPassword,
    passwordsMatch,
    checks,
    canSetPassword,
    busy,
    error,
    setEmail,
    setPassword,
    setConfirmPassword,
    setShowPassword,
    requestReset,
    consumeReset,
    useDifferentEmail,
  };
}
