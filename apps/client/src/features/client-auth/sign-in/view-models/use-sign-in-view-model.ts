"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PrismUser } from "@prism/types";
import {
  INITIAL_SIGN_IN_DRAFT,
  type SignInDraft,
  type SignInStatus,
} from "../model/sign-in-types";
import { signInClient, verifyClientSignInCode, type SignInResult } from "../use-cases/sign-in";

const nextFromLocation = () => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null);

export function useSignInViewModel() {
  const router = useRouter();
  const [draft, setDraft] = useState<SignInDraft>(INITIAL_SIGN_IN_DRAFT);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedInUser, setSignedInUser] = useState<(PrismUser & { signedInAt: string }) | null>(null);
  const [status, setStatus] = useState<SignInStatus>("idle");
  /** Set once the password was right and the account wants a code from its authenticator app. */
  const [twoStepToken, setTwoStepToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const busy = status === "loading";

  function update<K extends keyof SignInDraft>(key: K, value: SignInDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function backToPassword() {
    setTwoStepToken(null);
    setCode("");
    setError(null);
  }

  function apply(result: SignInResult) {
    if (result.kind === "two_step") {
      setTwoStepToken(result.token);
      setCode("");
      setStatus("idle");
      return;
    }
    if (result.kind === "error") {
      if (result.restart) backToPassword();
      setStatus("error");
      setError(result.error);
      return;
    }
    setSignedInUser(result.session);
    setStatus("signed_in");
    toast.success("Signed in", { description: `${result.session.name} is now signed in.` });
    router.replace(result.redirectTo);
  }

  async function submit() {
    setError(null);
    setStatus("loading");
    try {
      const nextPath = nextFromLocation();
      apply(twoStepToken ? await verifyClientSignInCode({ token: twoStepToken, code, nextPath }) : await signInClient({ draft, nextPath }));
    } finally {
      setStatus((current) => (current === "loading" ? "idle" : current));
    }
  }

  return {
    draft,
    showPassword,
    status,
    error,
    signedInUser,
    busy,
    twoStepToken,
    code,
    setCode,
    backToPassword,
    update,
    setShowPassword,
    submit,
  };
}
