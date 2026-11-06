"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { PortalQueryProvider } from "@prism/portal-query";
import { readStoredEventSession } from "@/app/lib/session";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function signedInActorKey() {
  const session = readStoredEventSession();
  return session ? `${session.role}:${session.email.trim().toLowerCase()}` : null;
}

/** The event portal's data cache, owned by the signed-in PMCM or coordinator account and kept across navigation. */
export function EventPortalQueryProvider({ children }: { children: ReactNode }) {
  const actorKey = useSyncExternalStore(subscribe, signedInActorKey, () => null);
  return <PortalQueryProvider actorKey={actorKey}>{children}</PortalQueryProvider>;
}
