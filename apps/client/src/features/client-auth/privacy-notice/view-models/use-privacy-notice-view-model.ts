"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { safeNextPath } from "@prism/types";
import { clientAuthRepository } from "../../sign-in/data/client-auth-repository";

type PrivacyNoticeMode = { kind: "reading" } | { kind: "acknowledge"; nextPath: string };

/** A signed-in person arriving with `next` acknowledges the notice, then continues there. */
export function usePrivacyNoticeViewModel() {
  const router = useRouter();
  const [mode, setMode] = useState<PrivacyNoticeMode>({ kind: "reading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next !== null && clientAuthRepository.hasSignedInSession()) {
      setMode({ kind: "acknowledge", nextPath: safeNextPath(next, "/dashboard") });
    }
  }, []);

  async function acknowledge() {
    if (mode.kind !== "acknowledge") return;
    setBusy(true);
    setError(null);
    try {
      await clientAuthRepository.acknowledgePrivacyNotice();
      router.replace(mode.nextPath);
    } catch {
      setError("We couldn't record that. Try again.");
      setBusy(false);
    }
  }

  return { mode, busy, error, acknowledge };
}
