"use client";

import { ShieldCheck } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { wrongEventPortalCopy } from "../../model/event-dashboard-shell-copy";
import { portalUrlsFromEnvironment } from "@/lib/portal-urls";
import type { EventSession } from "@/app/lib/session";

export function EventWrongPortalView({
  session,
  onSignOut,
}: {
  session: EventSession;
  onSignOut: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <ShieldCheck className="size-12 rounded-xl bg-amber-50 p-2.5 text-amber-600" />
        <h1 className="mt-5 text-xl font-bold text-foreground">Wrong portal for this account.</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {wrongEventPortalCopy(session.role, portalUrlsFromEnvironment())}
        </p>
        <Button className="mt-5 rounded-lg font-bold" onClick={onSignOut}>
          Use event team sign-in
        </Button>
      </section>
    </main>
  );
}
