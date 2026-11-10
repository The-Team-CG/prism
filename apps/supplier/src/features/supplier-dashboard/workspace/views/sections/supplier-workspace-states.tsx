"use client";

import { ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";

export function SupplierWorkspaceLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
    </main>
  );
}

/** Placeholder rows inside the shell while the workspace loads. */
export function SupplierWorkspaceSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your workspace" className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Card key={key} className="h-24 animate-pulse" />
        ))}
      </div>
      <Card className="h-72 animate-pulse" />
    </div>
  );
}

export function SupplierWrongPortalView({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <Card className="w-full max-w-md p-8">
        <ShieldCheck className="size-12 rounded-lg bg-attention-soft p-2.5 text-attention" />
        <h1 className="mt-5 text-xl font-semibold text-foreground">Wrong portal for this account.</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Supplier dashboard access requires an approved supplier account.
        </p>
        <Button className="mt-5 rounded-lg font-semibold" onClick={onSignIn}>
          Use supplier sign-in
        </Button>
      </Card>
    </main>
  );
}

export function SupplierWorkspaceBanners({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert role="status" className="border-success/25 bg-success/8 text-success">
          <AlertDescription className="text-success">{notice}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
