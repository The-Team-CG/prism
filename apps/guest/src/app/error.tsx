"use client";

import { useEffect } from "react";
import { Button } from "@/app/components/ui/button";

export default function GuestError({
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="max-w-sm text-muted-foreground">
        Refresh the page or try again in a moment. If this keeps happening, contact your administrator.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
