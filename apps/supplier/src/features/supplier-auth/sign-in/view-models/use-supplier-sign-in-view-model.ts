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
  signInSupplier,
  verifySupplierSignInCode,
} from "../use-cases/supplier-sign-in";
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

  useEffect(() => {
    const current = loadExistingSupplierSession();
    if (isExistingSupplierSession(current)) setExisting(current);
  }, []);

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
    if (twoStepToken ? code.length !== 6 : !isSupplierSignInDraftValid(draft)) return;
    setStatus("loading");
    setError(null);
    setNotice(null);
    try {
      await (twoStepToken ? submitCode(twoStepToken) : submitPassword());
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
    backToPassword,
    status,
    busy: status === "loading",
    updateEmail,
    updatePassword,
    submit,
    requestApproval,
  };
}
