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
import { signInClient } from "../use-cases/sign-in";

export function useSignInViewModel() {
  const router = useRouter();
  const [draft, setDraft] = useState<SignInDraft>(INITIAL_SIGN_IN_DRAFT);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedInUser, setSignedInUser] = useState<(PrismUser & { signedInAt: string }) | null>(null);
  const [status, setStatus] = useState<SignInStatus>("idle");

  const busy = status === "loading";

  function update<K extends keyof SignInDraft>(key: K, value: SignInDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setError(null);
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

  return {
    draft,
    showPassword,
    status,
    error,
    signedInUser,
    busy,
    update,
    setShowPassword,
    submit,
  };
}
