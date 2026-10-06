"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrismGuestEventPass } from "@prism/types";
import {
  isOpenDraftValid,
  mapGuestAccessError,
} from "../model/guest-access-open-rules";
import type { GuestAccessOpenDraft, GuestAccessOpenStatus, GuestSession } from "../model/guest-access-open-types";
import {
  loadExistingGuestSession,
  openGuestEventPass,
  previewGuestEvent,
} from "../use-cases/guest-access-open";

export function useGuestAccessOpenViewModel() {
  const router = useRouter();
  const [draft, setDraft] = useState<GuestAccessOpenDraft>({
    accessCode: "",
  });
  const [preview, setPreview] = useState<PrismGuestEventPass | null>(null);
  const [existing, setExisting] = useState<GuestSession | null>(null);
  const [status, setStatus] = useState<GuestAccessOpenStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setExisting(loadExistingGuestSession());
  }, []);

  function updateAccessCode(accessCode: string) {
    setDraft((prev) => ({ ...prev, accessCode }));
    setPreview(null);
  }

  async function submit() {
    if (status === "loading" || !isOpenDraftValid(draft)) return;
    setStatus("loading");
    setError(null);
    try {
      if (!preview) {
        const event = await previewGuestEvent(draft.accessCode);
        setPreview(event);
        setStatus("ready");
        return;
      }
      const next =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null;
      const result = await openGuestEventPass({
        accessCode: draft.accessCode,
        preview,
        nextPath: next,
      });
      setStatus("ready");
      router.replace(result.redirectTo);
    } catch (err) {
      setStatus("error");
      setError(mapGuestAccessError(err));
    }
  }

  return {
    draft,
    preview,
    existing,
    status,
    error,
    canSubmit: isOpenDraftValid(draft) && status !== "loading",
    busy: status === "loading",
    updateAccessCode,
    submit,
  };
}
