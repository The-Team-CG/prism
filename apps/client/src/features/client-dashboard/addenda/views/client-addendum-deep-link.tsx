"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClientAddendumDialog } from "./client-addendum-dialog";

function AddendumFromQuery({ eventId }: { eventId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const addendumId = useSearchParams().get("addendum");
  if (!addendumId) return null;
  return <ClientAddendumDialog key={addendumId} eventId={eventId} addendumId={addendumId} onClose={() => router.replace(pathname, { scroll: false })} />;
}

/**
 * An addendum opens as a dialog over whichever event page links to it (`?addendum=`), so reading and signing it
 * never leaves the page. Reading the query sits behind Suspense so the page itself can still render statically.
 */
export function ClientAddendumDeepLink({ eventId }: { eventId: string }) {
  return <Suspense fallback={null}><AddendumFromQuery eventId={eventId} /></Suspense>;
}
