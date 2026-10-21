"use client";

import { useEffect } from "react";
import { Button } from "../../components/ui/button";

export default function ClientDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        <h1 className="text-xl font-bold text-foreground">Something went wrong.</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Refresh the page or try again in a moment. If this keeps happening, contact your administrator.
        </p>
        <Button className="mt-5 rounded-lg font-bold" onClick={reset}>
          Try again
        </Button>
      </section>
    </main>
  );
}
