"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismPmcmCommandInbox } from "@prism/types";

type LoadCommandInbox = () => Promise<PrismPmcmCommandInbox>;

export function usePmcmCommandInbox({
  loadInbox,
  onError,
}: {
  loadInbox: LoadCommandInbox;
  onError?: (error: unknown) => void;
}) {
  const [inbox, setInbox] = useState<PrismPmcmCommandInbox | null>(null);

  const refresh = useCallback(async () => {
    const next = await loadInbox();
    setInbox(next);
    return next;
  }, [loadInbox]);

  useEffect(() => {
    let cancelled = false;
    loadInbox()
      .then((next) => {
        if (!cancelled) setInbox(next);
      })
      .catch((error) => {
        if (!cancelled) {
          setInbox(null);
          onError?.(error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadInbox, onError]);

  return { inbox, refresh };
}
