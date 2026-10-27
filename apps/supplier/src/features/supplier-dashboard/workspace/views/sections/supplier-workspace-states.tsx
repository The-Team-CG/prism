"use client";

import { ShieldCheck } from "lucide-react";
import { Button } from "@/app/components/ui/button";

export function SupplierWorkspaceLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" />
    </main>
  );
}

/** Placeholder rows inside the shell while the workspace loads. */
export function SupplierWorkspaceSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your workspace" className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-24 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-lg border border-border bg-card" />
    </div>
  );
}

export function SupplierWrongPortalView({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <ShieldCheck className="size-12 rounded-xl bg-attention-soft p-2.5 text-attention" />
        <h1 className="mt-5 text-xl font-bold text-foreground">Wrong portal for this account.</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Supplier dashboard access requires an approved supplier account.
        </p>
        <Button className="mt-5 rounded-xl font-bold" onClick={onSignIn}>
          Use supplier sign-in
        </Button>
      </div>
    </main>
  );
}

export function SupplierWorkspaceBanners({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error ? (
        <div role="alert" className="rounded-xl border border-danger/25 bg-danger/8 px-5 py-3.5 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="rounded-xl border border-success/25 bg-success/8 px-5 py-3.5 text-sm font-semibold text-success">
          {notice}
        </div>
      ) : null}
    </>
  );
}
