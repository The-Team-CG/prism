"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrismAuthenticatedSession } from "@prism/types";
import {
  DEFAULT_SIGN_IN_DRAFT,
  isExistingSupplierSession,
  isSupplierSignInDraftValid,
  mapApprovalRequestError,
  mapSupplierSignInError,
} from "../model/supplier-sign-in-rules";
import type { SupplierSignInDraft, SupplierSignInStatus } from "../model/supplier-sign-in-types";
import {
  loadExistingSupplierSession,
  requestSupplierApproval,
  requestSupplierEmailCode,
  signInSupplier,
  signInSupplierWithEmailCode,
  verifySupplierSignInCode,
} from "../use-cases/supplier-sign-in";

/** Seconds before another emailed code can be asked for, so a double tap does not burn the rate limit. */
export const EMAIL_CODE_RESEND_SECONDS = 45;

/** How the supplier proves it is them: an emailed code (the default) or their password. */
export type SupplierSignInMethod = "code" | "password";
import { signInCodeProblem } from "@prism/ui/sign-in-code-step";

const nextFromLocation = () => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null);

export function useSupplierSignInViewModel() {
  const router = useRouter();
  const [draft, setDraft] = useState<SupplierSignInDraft>(DEFAULT_SIGN_IN_DRAFT);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approvalConsentAccepted, setApprovalConsentAccepted] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [status, setStatus] = useState<SupplierSignInStatus>("idle");
  const [existing, setExisting] = useState<PrismAuthenticatedSession | null>(null);
  /** Set once the password was right and the account wants a code from its authenticator app. */
  const [twoStepToken, setTwoStepToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<SupplierSignInMethod>("code");
  /** The address an emailed code went to; set, the form shows the code boxes. */
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    const current = loadExistingSupplierSession();
    if (isExistingSupplierSession(current)) setExisting(current);
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function changeEmail() {
    setCodeSentTo(null);
    setEmailCode("");
    setError(null);
  }

  function chooseMethod(next: SupplierSignInMethod) {
    setMethod(next);
    changeEmail();
  }

  async function sendEmailCode() {
    await requestSupplierEmailCode(draft.email);
    setCodeSentTo(draft.email.trim());
    setEmailCode("");
    setResendIn(EMAIL_CODE_RESEND_SECONDS);
    setStatus("idle");
  }

  async function submitEmailCode(email: string) {
    const result = await signInSupplierWithEmailCode({ email, code: emailCode, nextPath: nextFromLocation() });
    if ("twoStepToken" in result) {
      setTwoStepToken(result.twoStepToken);
      setCode("");
      setStatus("idle");
      return;
    }
    setStatus("ready");
    router.replace(result.redirectTo);
  }

  function resendEmailCode() {
    if (resendIn > 0 || status === "loading") return;
    setStatus("loading");
    setError(null);
    sendEmailCode().catch((err: unknown) => {
      setStatus("error");
      setError(mapSupplierSignInError(err));
    });
  }

  function updateEmail(email: string) {
    setDraft((prev) => ({ ...prev, email }));
  }

  function updatePassword(password: string) {
    setDraft((prev) => ({ ...prev, password }));
  }

  function backToPassword() {
    setTwoStepToken(null);
    setCode("");
    setError(null);
  }

  async function submitPassword() {
    const result = await signInSupplier({ draft, nextPath: nextFromLocation() });
    if ("twoStepToken" in result) {
      setTwoStepToken(result.twoStepToken);
      setCode("");
      setStatus("idle");
      return;
    }
    setStatus("ready");
    router.replace(result.redirectTo);
  }

  async function submitCode(token: string) {
    try {
      const result = await verifySupplierSignInCode({ token, code, nextPath: nextFromLocation() });
      setStatus("ready");
      router.replace(result.redirectTo);
    } catch (err) {
      const problem = signInCodeProblem(mapSupplierSignInError(err));
      if (problem.restart) backToPassword();
      setStatus("error");
      setError(problem.text);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading") return;
    if (twoStepToken && code.length !== 6) return;
    if (!twoStepToken && method === "password" && !isSupplierSignInDraftValid(draft)) return;
    if (!twoStepToken && method === "code" && (codeSentTo ? emailCode.length !== 6 : !draft.email.trim())) return;
    setStatus("loading");
    setError(null);
    setNotice(null);
    try {
      if (twoStepToken) await submitCode(twoStepToken);
      else if (method === "password") await submitPassword();
      else if (codeSentTo) await submitEmailCode(codeSentTo);
      else await sendEmailCode();
    } catch (err) {
      setStatus("error");
      setError(mapSupplierSignInError(err));
    }
  }

  async function requestApproval() {
    if (status === "loading" || !approvalConsentAccepted) return;
    setStatus("loading");
    setError(null);
    setNotice(null);
    try {
      await requestSupplierApproval(draft.email, approvalConsentAccepted);
      setNotice("Approval request saved for PMCM review in the event command portal.");
      setShowApproval(false);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(mapApprovalRequestError(err));
    }
  }

  return {
    draft,
    showPassword,
    setShowPassword,
    error,
    notice,
    approvalConsentAccepted,
    setApprovalConsentAccepted,
    showApproval,
    setShowApproval,
    existing,
    twoStepToken,
    code,
    setCode,
    method,
    chooseMethod,
    codeSentTo,
    emailCode,
    setEmailCode,
    resendIn,
    resendEmailCode,
    changeEmail,
    backToPassword,
    status,
    busy: status === "loading",
    updateEmail,
    updatePassword,
    submit,
    requestApproval,
  };
}
