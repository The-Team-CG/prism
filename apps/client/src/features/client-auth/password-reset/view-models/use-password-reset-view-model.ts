"use client";

import { useEffect, useState } from "react";
import { consumePasswordResetSchema, requestPasswordResetSchema } from "@prism/types";
import { clientAuthRepository } from "../../sign-in/data/client-auth-repository";

export const PASSWORDS_MISMATCH_MESSAGE = "Passwords do not match.";

export function useClientPasswordResetViewModel() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  const isSetStep = token.length > 0;
  const passwordsMatch = password === confirmPassword;

  async function submit() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      if (isSetStep) {
        if (!passwordsMatch) throw new Error(PASSWORDS_MISMATCH_MESSAGE);
        const parsed = consumePasswordResetSchema.safeParse({ token, password });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the new password.");
        const result = await clientAuthRepository.consumePasswordReset(parsed.data);
        setNotice(result.message);
        return;
      }
      const parsed = requestPasswordResetSchema.safeParse({ email });
      if (!parsed.success) throw new Error("Enter a valid email address.");
      const result = await clientAuthRepository.requestPasswordReset(parsed.data.email);
      setNotice(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to process password reset");
    } finally {
      setBusy(false);
    }
  }

  return {
    isSetStep,
    email,
    password,
    confirmPassword,
    passwordsMatch,
    showPassword,
    notice,
    error,
    busy,
    setEmail,
    setPassword,
    setConfirmPassword,
    setShowPassword,
    submit,
  };
}
