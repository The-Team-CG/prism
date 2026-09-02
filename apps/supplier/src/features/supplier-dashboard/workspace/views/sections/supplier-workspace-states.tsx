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

export function SupplierWrongPortalView({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <ShieldCheck className="size-12 rounded-xl bg-amber-50 p-2.5 text-amber-600" />
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
        <div className="rounded-xl border border-(--prism-danger)/25 bg-(--prism-danger)/8 px-5 py-3.5 text-sm font-semibold text-(--prism-danger)">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-(--prism-success)/25 bg-(--prism-success)/8 px-5 py-3.5 text-sm font-semibold text-(--prism-success)">
          {notice}
        </div>
      ) : null}
    </>
  );
}
