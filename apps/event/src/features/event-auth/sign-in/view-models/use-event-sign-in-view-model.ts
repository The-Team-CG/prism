"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TWO_FACTOR_BACKUP_CODE_PATTERN } from "@prism/types";
import {
  isSignInDraftValid,
  mapSignInError,
} from "../model/event-sign-in-rules";
import { nextPathFromSearch } from "../model/event-sign-in-copy";
import { beginEventTwoFactorSetup, getDevelopmentEventTwoFactorQr, signInToEventPortal, verifyEventTwoFactor } from "../use-cases/event-sign-in";

function readNextPath() {
  if (typeof window === "undefined") return null;
  return nextPathFromSearch(window.location.search);
}

export function useEventSignInViewModel() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [phase, setPhase] = useState<"password" | "setup" | "verify" | "backup-codes">("password");
  /** Skip the authenticator step on this browser for 30 days. */
  const [trustDevice, setTrustDevice] = useState(false);
  /** Typing a backup code instead of the six digits, for a lost phone. */
  const [usingBackupCode, setUsingBackupCode] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function toggleDevelopmentQr() {
    if (process.env.NODE_ENV !== "development" || phase !== "verify" || !twoFactorToken || status === "loading") return;
    if (otpauthUri) {
      setOtpauthUri(null);
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const qr = await getDevelopmentEventTwoFactorQr(twoFactorToken);
      setOtpauthUri(qr.otpauthUri);
      setStatus("idle");
    } catch (err) {
      setError(mapSignInError(err));
      setStatus("error");
    }
  }

  async function submitTwoFactor(next: string | null) {
    if (phase === "backup-codes") {
      setStatus("ready");
      router.replace(pendingRedirect ?? "/dashboard");
      return;
    }
    const valid = usingBackupCode ? TWO_FACTOR_BACKUP_CODE_PATTERN.test(code.trim()) : /^\d{6}$/.test(code);
    if (!twoFactorToken || !valid) {
      setStatus("error");
      setError(usingBackupCode ? "Enter one of your backup codes, like k7p2-9xqm." : "Enter the six-digit code from your authenticator app.");
      return;
    }
    const verified = await verifyEventTwoFactor({ token: twoFactorToken, code, nextPath: next, email, trustDevice: phase === "verify" && trustDevice });
    if ("error" in verified) {
      setStatus("error");
      setError(verified.error ?? "Two-factor verification failed.");
      return;
    }
    if (verified.backupCodes?.length) {
      setBackupCodes(verified.backupCodes);
      setPendingRedirect(verified.redirectTo);
      setPhase("backup-codes");
      setStatus("idle");
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
      setOtpauthUri(setup.otpauthUri);
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
    otpauthUri,
    code,
    trustDevice,
    setTrustDevice,
    usingBackupCode,
    toggleBackupCode: () => {
      setUsingBackupCode((current) => !current);
      setCode("");
      setError(null);
    },
    backupCodes,
    error,
    status,
    busy: status === "loading",
    setEmail,
    setPassword,
    setShowPassword,
    setCode,
    toggleDevelopmentQr,
    submit,
  };
}
