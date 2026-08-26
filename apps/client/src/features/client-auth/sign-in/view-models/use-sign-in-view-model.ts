"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PrismUser } from "@prism/types";
import { samplePasswordFor } from "../model/sign-in-rules";
import {
  CLIENT_SAMPLE_USERS,
  INITIAL_SIGN_IN_DRAFT,
  type SignInDraft,
  type SignInStatus,
} from "../model/sign-in-types";
import { requestClientApproval, signInClient } from "../use-cases/sign-in";

export function useSignInViewModel() {
  const router = useRouter();
  const [draft, setDraft] = useState<SignInDraft>(INITIAL_SIGN_IN_DRAFT);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<PrismUser | null>(null);
  const [signedInUser, setSignedInUser] = useState<(PrismUser & { signedInAt: string }) | null>(null);
  const [approvalConsentAccepted, setApprovalConsentAccepted] = useState(false);
  const [status, setStatus] = useState<SignInStatus>("idle");

  const busy = status === "loading";

  function update<K extends keyof SignInDraft>(key: K, value: SignInDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function applySampleUser(user: PrismUser) {
    update("email", user.email);
    update("password", samplePasswordFor(user.email));
  }

  async function submit() {
    setError(null);
    setPendingUser(null);
    setStatus("loading");
    try {
      const next =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null;
      const result = await signInClient({ draft, nextPath: next });
      if (!result.ok) {
        setStatus("error");
        setError(result.error);
        setPendingUser(result.pendingUser);
        return;
      }
      setSignedInUser(result.session);
      setStatus("signed_in");
      toast.success("Signed in", { description: `${result.session.name} is now signed in.` });
      router.replace(result.redirectTo);
    } finally {
      setStatus((current) => (current === "signed_in" ? current : "idle"));
    }
  }

  async function requestApproval(user: PrismUser) {
    try {
      await requestClientApproval(user, approvalConsentAccepted);
      toast.success("Approval requested", {
        description: "A backend approval request has been saved for portal review.",
      });
    } catch (err) {
      toast.error("Approval request failed", {
        description: err instanceof Error ? err.message : "Unable to request approval.",
      });
    }
  }

  return {
    draft,
    showPassword,
    status,
    error,
    pendingUser,
    signedInUser,
    approvalConsentAccepted,
    busy,
    sampleUsers: CLIENT_SAMPLE_USERS,
    update,
    setShowPassword,
    setApprovalConsentAccepted,
    applySampleUser,
    submit,
    requestApproval,
  };
}
