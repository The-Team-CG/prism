"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  isSignInDraftValid,
  mapSignInError,
} from "../model/event-sign-in-rules";
import { nextPathFromSearch } from "../model/event-sign-in-copy";
import { beginEventTwoFactorSetup, signInToEventPortal, verifyEventTwoFactor } from "../use-cases/event-sign-in";

export const EVENT_SAMPLE_ACCOUNTS = [
  { name: "Ms. Mys", role: "PMCM Admin", email: "mys@pmcm.test", password: "prism-admin" },
  { name: "Marco", role: "Coordinator", email: "marco@pmcm.test", password: "prism-coordinator" },
] as const;

function readNextPath() {
  if (typeof window === "undefined") return null;
  return nextPathFromSearch(window.location.search);
}

export function useEventSignInViewModel() {
  const router = useRouter();
  const [email, setEmail] = useState("mys@pmcm.test");
  const [password, setPassword] = useState("prism-admin");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [phase, setPhase] = useState<"password" | "setup" | "verify">("password");
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function submitTwoFactor(next: string | null) {
    if (!twoFactorToken || !/^\d{6}$/.test(code)) {
      setStatus("error");
      setError("Enter the six-digit code from your authenticator app.");
      return;
    }
    const verified = await verifyEventTwoFactor({ token: twoFactorToken, code, nextPath: next });
    if ("error" in verified) {
      setStatus("error");
      setError(verified.error ?? "Two-factor verification failed.");
      return;
    }
    setStatus("ready");
    router.replace(verified.redirectTo);
  }

  async function beginTwoFactor(result: { token: string; setupRequired?: boolean }) {
    setTwoFactorToken(result.token);
    if (result.setupRequired) {
      const setup = await beginEventTwoFactorSetup(result.token);
      setSetupSecret(setup.secret);
      setPhase("setup");
    } else {
      setPhase("verify");
    }
    setStatus("idle");
  }

  async function submitPassword(next: string | null) {
    if (!isSignInDraftValid(email, password)) {
      setStatus("idle");
      return;
    }
    const result = await signInToEventPortal({ email, password, nextPath: next });
    if ("error" in result) {
      setStatus("error");
      setError(result.error);
      return;
    }
    if (result.kind === "two_factor") {
      await beginTwoFactor(result);
      return;
    }
    setStatus("ready");
    router.replace(result.redirectTo);
  }

  async function submit() {
    if (status === "loading") return;
    setStatus("loading");
    setError(null);
    try {
      const next = readNextPath();
      if (phase !== "password") {
        await submitTwoFactor(next);
        return;
      }
      await submitPassword(next);
    } catch (err) {
      setStatus("error");
      setError(mapSignInError(err));
    }
  }

  return {
    email,
    password,
    showPassword,
    phase,
    setupSecret,
    code,
    error,
    status,
    busy: status === "loading",
    sampleAccounts: EVENT_SAMPLE_ACCOUNTS,
    setEmail,
    setPassword,
    setShowPassword,
    setCode,
    applySample: (sample: { email: string; password: string }) => {
      setEmail(sample.email);
      setPassword(sample.password);
    },
    submit,
  };
}
