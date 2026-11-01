"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { PortalQueryProvider } from "@prism/portal-query";
import { readClientSession } from "../use-cases/client-dashboard-actions";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** The client portal's data cache, owned by the signed-in client account and kept across dashboard navigation. */
export function ClientPortalQueryProvider({ children }: { children: ReactNode }) {
  const actorKey = useSyncExternalStore(
    subscribe,
    () => readClientSession()?.email.trim().toLowerCase() ?? null,
    () => null,
  );
  return <PortalQueryProvider actorKey={actorKey}>{children}</PortalQueryProvider>;
}
