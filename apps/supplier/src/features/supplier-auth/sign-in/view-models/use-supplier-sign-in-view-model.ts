"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_SIGN_IN_DRAFT,
  isExistingSupplierSession,
  isSupplierSignInDraftValid,
  mapApprovalRequestError,
  mapSupplierSignInError,
  SAMPLE_SUPPLIER_ACCOUNTS,
} from "../model/supplier-sign-in-rules";
import type { SupplierSession, SupplierSignInDraft, SupplierSignInStatus } from "../model/supplier-sign-in-types";
import {
  loadExistingSupplierSession,
  requestSupplierApproval,
  signInSupplier,
} from "../use-cases/supplier-sign-in";

export function useSupplierSignInViewModel() {
  const router = useRouter();
  const [draft, setDraft] = useState<SupplierSignInDraft>(DEFAULT_SIGN_IN_DRAFT);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approvalConsentAccepted, setApprovalConsentAccepted] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [status, setStatus] = useState<SupplierSignInStatus>("idle");
  const [existing, setExisting] = useState<SupplierSession | null>(null);

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

  function applySampleAccount(email: string, password: string) {
    setDraft({ email, password });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading" || !isSupplierSignInDraftValid(draft)) return;
    setStatus("loading");
    setError(null);
    setNotice(null);
    try {
      const next =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null;
      const result = await signInSupplier({ draft, nextPath: next });
      setStatus("ready");
      router.replace(result.redirectTo);
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
    busy: status === "loading",
    sampleAccounts: SAMPLE_SUPPLIER_ACCOUNTS,
    updateEmail,
    updatePassword,
    applySampleAccount,
    submit,
    requestApproval,
  };
}
