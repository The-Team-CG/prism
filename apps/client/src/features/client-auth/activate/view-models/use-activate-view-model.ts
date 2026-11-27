"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrismInvitationPreview } from "@prism/types";
import {
  canSubmitActivationPassword,
  isUsableActivationToken,
  type ActivateView,
} from "../model/activate-model";
import { activateClientAccount, confirmClientInvitation, previewClientInvitation } from "../use-cases/activate";
import { requestClientEmailCode } from "../../sign-in/use-cases/sign-in";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useClientActivateViewModel() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<PrismInvitationPreview | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [wantsPassword, setWantsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rejectedByApi, setRejectedByApi] = useState(false);
  const [activated, setActivated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** For an expired link: where to email a fresh sign-in code. */
  const [email, setEmail] = useState("");

  useEffect(() => {
    const found = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(found);
    if (!isUsableActivationToken(found)) {
      setPreviewLoaded(true);
      return;
    }
    previewClientInvitation(found)
      .then((loaded) => {
        setPreview(loaded);
        if (!loaded) setRejectedByApi(true);
      })
      .catch(() => setRejectedByApi(true))
      .finally(() => setPreviewLoaded(true));
  }, []);

  const view: ActivateView =
    token === null || !previewLoaded
      ? "loading"
      : activated
        ? "done"
        : rejectedByApi || !isUsableActivationToken(token)
          ? "invalid"
          : wantsPassword || preview?.passwordRequired
            ? "set"
            : "confirm";
  const canSubmit = canSubmitActivationPassword(password, confirmPassword);

  async function confirm() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const result = await confirmClientInvitation(token);
      if (result.kind === "signed_in") {
        router.replace(result.redirectTo);
        return;
      }
      if (result.kind === "two_step") {
        router.replace("/sign-in");
        return;
      }
      setError(result.error);
    } finally {
      setBusy(false);
    }
  }

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

  /** An expired link sends a fresh sign-in code and opens the code step on the sign-in page. */
  async function emailFreshCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const sent = await requestClientEmailCode(email);
      if (sent.kind === "error") {
        setError(sent.error);
        return;
      }
      router.push(`/sign-in?code-sent=${encodeURIComponent(email.trim())}`);
    } finally {
      setBusy(false);
    }
  }

  return {
    view,
    preview,
    password,
    confirmPassword,
    showPassword,
    canSubmit,
    busy,
    error,
    email,
    setEmail,
    setPassword,
    setConfirmPassword,
    setShowPassword,
    choosePassword: () => setWantsPassword(true),
    confirm,
    activate,
    emailFreshCode,
  };
}
