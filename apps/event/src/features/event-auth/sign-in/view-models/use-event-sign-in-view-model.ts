"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  isSignInDraftValid,
  mapSignInError,
} from "../model/event-sign-in-rules";
import { signInToEventPortal } from "../use-cases/event-sign-in";

export const EVENT_SAMPLE_ACCOUNTS = [
  { name: "Ms. Mys", role: "PMCM Admin", email: "mys@pmcm.test", password: "prism-admin" },
  { name: "Marco", role: "Coordinator", email: "marco@pmcm.test", password: "prism-coordinator" },
] as const;

export function useEventSignInViewModel() {
  const router = useRouter();
  const [email, setEmail] = useState("mys@pmcm.test");
  const [password, setPassword] = useState("prism-admin");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  async function submit() {
    if (status === "loading" || !isSignInDraftValid(email, password)) return;
    setStatus("loading");
    setError(null);
    try {
      const next =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null;
      const result = await signInToEventPortal({ email, password, nextPath: next });
      if ("error" in result) {
        setStatus("error");
        setError(result.error);
        return;
      }
      setStatus("ready");
      router.replace(result.redirectTo);
    } catch (err) {
      setStatus("error");
      setError(mapSignInError(err));
    }
  }

  return {
    email,
    password,
    showPassword,
    error,
    status,
    busy: status === "loading",
    sampleAccounts: EVENT_SAMPLE_ACCOUNTS,
    setEmail,
    setPassword,
    setShowPassword,
    applySample: (sample: { email: string; password: string }) => {
      setEmail(sample.email);
      setPassword(sample.password);
    },
    submit,
  };
}
