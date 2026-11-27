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
import {
  finishFrontDoorSignIn,
  requestClientEmailCode,
  resumeClientCookieSession,
  signInClient,
  signInClientWithEmailCode,
  verifyClientSignInCode,
  type SignInResult,
} from "../use-cases/sign-in";

const nextFromLocation = () => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null);

/** Seconds before another emailed code can be asked for, so a double tap does not burn the rate limit. */
export const EMAIL_CODE_RESEND_SECONDS = 45;

/** How the client proves it is them: an emailed code (the default) or their password. */
export type ClientSignInMethod = "code" | "password";

/** `frontDoor`: the shared "Sign in to P.R.I.S.M." page, which signs in anyone and sends them to their own portal. */
export function useSignInViewModel({ frontDoor = false }: { frontDoor?: boolean } = {}) {
  const router = useRouter();
  const finish = frontDoor ? finishFrontDoorSignIn : undefined;
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

  // Signed in on the shared sign-in page: the API's cookie already holds this portal's session, so continue with it.
  useEffect(() => {
    if (frontDoor) return;
    let active = true;
    void resumeClientCookieSession(nextFromLocation()).then((result) => {
      if (active && result?.kind === "signed_in") apply(result);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [frontDoor]);

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
    // The shared sign-in page sends suppliers and PMCM staff on to their own portal.
    if (/^https?:\/\//.test(result.redirectTo)) window.location.assign(result.redirectTo);
    else router.replace(result.redirectTo);
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
      if (twoStepToken) return apply(await verifyClientSignInCode({ token: twoStepToken, code, nextPath, finish }));
      if (method === "password") return apply(await signInClient({ draft, nextPath, finish }));
      if (!codeSentTo) return sendEmailCode();
      return apply(await signInClientWithEmailCode({ email: codeSentTo, code: emailCode, nextPath, finish }));
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
