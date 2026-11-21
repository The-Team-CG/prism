"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrismGuestSession } from "@prism/types";
import {
  isOpenDraftValid,
  mapGuestAccessError,
} from "../model/guest-access-open-rules";
import type { GuestAccessOpenDraft, GuestAccessOpenStatus } from "../model/guest-access-open-types";
import {
  loadExistingGuestSession,
  openGuestEventPass,
} from "../use-cases/guest-access-open";

function searchParam(name: string): string | null {
  return typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(name);
}

/**
 * One step: the code opens the pass. A link or QR that carries the code (`/open?code=…`) opens it straight away, so a
 * guest who scans the event's QR types nothing; if that fails, the code stays in the field to try again.
 */
export function useGuestAccessOpenViewModel() {
  const router = useRouter();
  const [draft, setDraft] = useState<GuestAccessOpenDraft>({ accessCode: "" });
  const [existing, setExisting] = useState<PrismGuestSession | null>(null);
  const [status, setStatus] = useState<GuestAccessOpenStatus>("idle");
  const [autoOpening, setAutoOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const open = useCallback(async (accessCode: string) => {
    setStatus("loading");
    setError(null);
    try {
      const result = await openGuestEventPass({ accessCode, nextPath: searchParam("next") });
      setStatus("ready");
      router.replace(result.redirectTo);
    } catch (err) {
      setStatus("error");
      setAutoOpening(false);
      setError(mapGuestAccessError(err));
    }
  }, [router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setExisting(loadExistingGuestSession());
    const code = searchParam("code")?.trim();
    if (!code) return;
    setDraft({ accessCode: code });
    setAutoOpening(true);
    void open(code);
  }, [open]);

  function updateAccessCode(accessCode: string) {
    setDraft({ accessCode });
    setError(null);
  }

  async function submit() {
    if (status === "loading" || !isOpenDraftValid(draft)) return;
    await open(draft.accessCode);
  }

  return {
    draft,
    existing,
    status,
    error,
    autoOpening,
    canSubmit: isOpenDraftValid(draft) && status !== "loading",
    busy: status === "loading",
    updateAccessCode,
    submit,
  };
}
