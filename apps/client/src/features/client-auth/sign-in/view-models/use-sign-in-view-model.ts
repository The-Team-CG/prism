"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PrismUser } from "@prism/types";
import {
  INITIAL_SIGN_IN_DRAFT,
  type SignInDraft,
  type SignInStatus,
} from "../model/sign-in-types";
import { requestClientEmailCode, signInClient, signInClientWithEmailCode, verifyClientSignInCode, type SignInResult } from "../use-cases/sign-in";

const nextFromLocation = () => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null);

/** Seconds before another emailed code can be asked for, so a double tap does not burn the rate limit. */
export const EMAIL_CODE_RESEND_SECONDS = 45;

/** How the client proves it is them: an emailed code (the default) or their password. */
export type ClientSignInMethod = "code" | "password";

export function useSignInViewModel() {
  const router = useRouter();
  const [draft, setDraft] = useState<SignInDraft>(INITIAL_SIGN_IN_DRAFT);
  const [method, setMethod] = useState<ClientSignInMethod>("code");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedInUser, setSignedInUser] = useState<(PrismUser & { signedInAt: string }) | null>(null);
  const [status, setStatus] = useState<SignInStatus>("idle");
  /** Set once the password or emailed code was right and the account wants a code from its authenticator app. */
  const [twoStepToken, setTwoStepToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  /** The address an emailed code went to; set, the form shows the code boxes. */
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    const sentTo = new URLSearchParams(window.location.search).get("code-sent");
    if (!sentTo) return;
    setDraft((current) => ({ ...current, email: sentTo }));
    setCodeSentTo(sentTo);
    setResendIn(EMAIL_CODE_RESEND_SECONDS);
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const busy = status === "loading";

  function update<K extends keyof SignInDraft>(key: K, value: SignInDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function backToPassword() {
    setTwoStepToken(null);
    setCode("");
    setError(null);
  }

  function changeEmail() {
    setCodeSentTo(null);
    setEmailCode("");
    setError(null);
  }

  function chooseMethod(next: ClientSignInMethod) {
    setMethod(next);
    changeEmail();
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

  async function sendEmailCode() {
    const sent = await requestClientEmailCode(draft.email);
    if (sent.kind === "error") {
      setStatus("error");
      setError(sent.error);
      return;
    }
    setCodeSentTo(draft.email.trim());
    setEmailCode("");
    setResendIn(EMAIL_CODE_RESEND_SECONDS);
  }

  async function run(work: () => Promise<void>) {
    setError(null);
    setStatus("loading");
    try {
      await work();
    } finally {
      setStatus((current) => (current === "loading" ? "idle" : current));
    }
  }

  async function submit() {
    const nextPath = nextFromLocation();
    await run(async () => {
      if (twoStepToken) return apply(await verifyClientSignInCode({ token: twoStepToken, code, nextPath }));
      if (method === "password") return apply(await signInClient({ draft, nextPath }));
      if (!codeSentTo) return sendEmailCode();
      return apply(await signInClientWithEmailCode({ email: codeSentTo, code: emailCode, nextPath }));
    });
  }

  function resendEmailCode() {
    if (resendIn > 0) return;
    void run(sendEmailCode);
  }

  return {
    draft,
    method,
    chooseMethod,
    showPassword,
    status,
    error,
    signedInUser,
    busy,
    twoStepToken,
    code,
    setCode,
    codeSentTo,
    emailCode,
    setEmailCode,
    resendIn,
    resendEmailCode,
    changeEmail,
    backToPassword,
    update,
    setShowPassword,
    submit,
  };
}
