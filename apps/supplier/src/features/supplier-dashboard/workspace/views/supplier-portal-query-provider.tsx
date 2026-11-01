"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { PortalQueryProvider } from "@prism/portal-query";
import { loadSupplierDashboardSession } from "../use-cases/supplier-workspace-actions";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** The supplier portal's data cache, owned by the signed-in supplier account and kept across section navigation. */
export function SupplierPortalQueryProvider({ children }: { children: ReactNode }) {
  const actorKey = useSyncExternalStore(
    subscribe,
    () => loadSupplierDashboardSession()?.email.trim().toLowerCase() ?? null,
    () => null,
  );
  return <PortalQueryProvider actorKey={actorKey}>{children}</PortalQueryProvider>;
}
