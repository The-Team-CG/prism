"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EventSession } from "@/app/lib/session";
import { isSignInDraftValid, mapSignInError, signInToEventPortal } from "@/features/event-auth/sign-in";

export type EventCommandLandingStatus = "idle" | "loading" | "success" | "error";

export function useEventCommandLandingViewModel({
  onSignedIn,
}: {
  onSignedIn: (session: EventSession) => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<EventCommandLandingStatus>("idle");
  const [accessOpen, setAccessOpen] = useState(false);

  async function submit() {
    if (status === "loading") return;
    if (!isSignInDraftValid(email, password)) {
      setStatus("error");
      setError("Enter your email and password.");
      return;
    }

    setStatus("loading");
    setError(null);
    try {
      const result = await signInToEventPortal({ email, password });
      if ("error" in result) {
        setStatus("error");
        setError(result.error);
        return;
      }
      if (result.kind === "two_factor") {
        router.replace("/sign-in");
        return;
      }
      setStatus("success");
      onSignedIn(result.session);
    } catch (err) {
      setStatus("error");
      setError(mapSignInError(err));
    }
  }

  return {
    email,
    password,
    error,
    status,
    accessOpen,
    busy: status === "loading",
    setEmail,
    setPassword,
    setAccessOpen,
    submit,
  };
}
