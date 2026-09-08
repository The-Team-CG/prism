"use client";

import { FormEvent, useState } from "react";
import { prismApi } from "@/lib/prism-api";
import type { PrismSupplierApplicationStatusResult } from "@prism/types";

const labels: Record<PrismSupplierApplicationStatusResult["status"], string> = {
  pending: "Under review",
  under_review: "Under review",
  proposal_requested: "Proposal requested",
  meeting_scheduled: "Meeting scheduled",
  approved: "Approved",
  declined: "Declined",
};

export default function SupplierApplicationStatusPage() {
  const [applicationId, setApplicationId] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<PrismSupplierApplicationStatusResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await prismApi.getSupplierApplicationStatus({ applicationId: applicationId.trim(), email: email.trim() }));
    } catch {
      setError("We could not find an application matching those details.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background px-6 py-16 text-foreground">
      <section className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="text-sm text-muted-foreground">Supplier network</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Check application status</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Use the application reference and submitting email to view the latest review status.</p>
        <form className="mt-8 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium">Application reference<input required value={applicationId} onChange={(event) => setApplicationId(event.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2" placeholder="sap_…" /></label>
          <label className="block text-sm font-medium">Submitting email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2" placeholder="you@company.com" /></label>
          <button disabled={busy} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Checking…" : "Check status"}</button>
        </form>
        {error ? <p className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        {result ? <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-5"><p className="text-sm text-muted-foreground">{result.companyName}</p><p className="mt-1 text-xl font-semibold">{labels[result.status]}</p><p className="mt-2 text-sm text-muted-foreground">Submitted {new Date(result.submittedAt).toLocaleDateString()}</p></div> : null}
      </section>
    </main>
  );
}
