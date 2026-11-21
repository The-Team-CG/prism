"use client";

import { useEffect, type ReactNode } from "react";
import { AlertTriangle, SearchX } from "lucide-react";

import { Button } from "./components/ui/button";
import { EmptyState } from "./components/ui/empty-state";

function CenteredPage({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

/** The fallback for an unexpected runtime error in a portal route. Wire it from a route's `error.tsx`. */
export function PortalErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <CenteredPage>
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        description="Try again in a moment. If this keeps happening, contact your administrator."
        action={<Button onClick={retry}>Try again</Button>}
      />
    </CenteredPage>
  );
}

/** The page for a URL no route matches. Wire it from a route's `not-found.tsx`. */
export function PortalNotFoundPage({ homeHref, homeLabel }: { homeHref: string; homeLabel: string }) {
  return (
    <CenteredPage>
      <EmptyState
        icon={SearchX}
        title="Page not found"
        description="This page doesn't exist or has moved. Check the address or go back to the start."
        action={
          <Button asChild>
            <a href={homeHref}>{homeLabel}</a>
          </Button>
        }
      />
    </CenteredPage>
  );
}
