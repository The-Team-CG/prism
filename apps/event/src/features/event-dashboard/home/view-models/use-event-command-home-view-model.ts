"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { readStoredEventSession, type EventSession } from "@/app/lib/session";

export type EventCommandHomeStatus = "idle" | "loading";

export function useEventCommandHomeViewModel() {
  const router = useRouter();
  const [session, setSession] = useState<EventSession | null>(null);
  const [status, setStatus] = useState<EventCommandHomeStatus>("idle");

  useEffect(() => {
    const current = readStoredEventSession();
    if (!current) return;

    setSession(current);
    setStatus("loading");
    router.replace("/dashboard");
  }, [router]);

  const onSignedIn = useCallback(
    (nextSession: EventSession) => {
      setSession(nextSession);
      setStatus("loading");
      router.replace("/dashboard");
    },
    [router],
  );

  return { session, status, onSignedIn };
}
