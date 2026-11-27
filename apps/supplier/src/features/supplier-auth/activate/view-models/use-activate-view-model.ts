"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { portalHref } from "@prism/ui/portal-path";
import type { PrismInvitationPreview } from "@prism/types";
import {
  ActivationTokenRejectedError,
  canSubmitActivation,
  isUsableActivationToken,
  type ActivateView,
} from "../model/activate-model";
import { activateSupplierAccount, confirmSupplierInvitation, previewSupplierInvitation, requestSupplierEmailCode } from "../use-cases/activate";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useSupplierActivateViewModel() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<PrismInvitationPreview | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [wantsPassword, setWantsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tokenRejected, setTokenRejected] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const found = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(found);
    if (!isUsableActivationToken(found)) {
      setPreviewLoaded(true);
      return;
    }
    previewSupplierInvitation(found)
      .then((loaded) => {
        setPreview(loaded);
        if (!loaded) setTokenRejected(true);
      })
      .catch(() => setTokenRejected(true))
      .finally(() => setPreviewLoaded(true));
  }, []);

  const view: ActivateView = done
    ? "done"
    : token === null || !previewLoaded
      ? "loading"
      : tokenRejected || !isUsableActivationToken(token)
        ? "invalid"
        : wantsPassword || preview?.passwordRequired
          ? "set"
          : "confirm";
  const canSubmit = canSubmitActivation(password, confirmPassword);

  async function confirm() {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await confirmSupplierInvitation(token);
      router.replace("redirectTo" in result ? result.redirectTo : portalHref("/sign-in"));
    } catch (err) {
      setError(errorMessage(err, "Could not open your account. Try the link again."));
    } finally {
      setBusy(false);
    }
  }

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

  /** An expired link sends a fresh sign-in code and opens the code step on the sign-in page. */
  async function emailFreshCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestSupplierEmailCode(email);
      router.push(portalHref(`/sign-in?code-sent=${encodeURIComponent(email.trim())}`));
    } catch (err) {
      setError(errorMessage(err, "Could not send a sign-in code."));
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
    submit,
    emailFreshCode,
  };
}
