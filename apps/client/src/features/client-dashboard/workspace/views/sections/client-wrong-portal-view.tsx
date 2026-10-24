"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import { portalUrlFor } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { portalUrlsFromEnvironment } from "@/lib/portal-urls";
import { signOutClientSession } from "../../use-cases/client-dashboard-actions";
import type { ClientSession } from "../../model/client-dashboard-types";

function isEventTeamRole(role: ClientSession["role"]) {
  return role === "pmcm-admin" || role === "coordinator";
}

export function ClientWrongPortalView({
  session,
  onUseClientSignIn,
}: {
  session: ClientSession;
  onUseClientSignIn: () => void;
}) {
  const eventTeam = isEventTeamRole(session.role);
  const supplier = session.role === "supplier";
  const destination = eventTeam
    ? "Event team and coordinator accounts belong in the event operations portal."
    : "Supplier accounts belong in the supplier portal.";

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <span className="grid size-12 place-items-center rounded-xl bg-amber-50 text-amber-600">
          <ShieldCheck className="size-5" />
        </span>
        <h1 className="mt-5 text-xl font-bold text-foreground">Wrong portal for this account.</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{destination}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {eventTeam ? (
            <Button asChild className="rounded-lg font-bold">
              <a href={portalUrlFor("event", portalUrlsFromEnvironment())}>
                Open event portal <ArrowRight className="size-4" />
              </a>
            </Button>
          ) : null}
          {supplier ? (
            <Button asChild className="rounded-lg font-bold">
              <a href={portalUrlFor("supplier", portalUrlsFromEnvironment())}>
                Open supplier portal <ArrowRight className="size-4" />
              </a>
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="rounded-lg"
            onClick={() => {
              signOutClientSession();
              onUseClientSignIn();
            }}
          >
            Use client sign-in
          </Button>
        </div>
      </section>
    </main>
  );
}
