"use client";

import type { FormEvent } from "react";
import type { PrismSupplierApplicationStatusResult } from "@prism/types";
import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { useSupplierApplicationStatusViewModel } from "../view-models/use-supplier-application-status-view-model";
import {
  isTerminalSupplierApplicationStatus,
  supplierApplicationStatusDescription,
  supplierApplicationStatusFailureMessage,
  supplierApplicationStatusLabel,
  type SupplierApplicationStatusFailure,
} from "../model/supplier-application-status-rules";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StatusFailureAlert({
  failure,
  busy,
  onRetry,
}: {
  failure: SupplierApplicationStatusFailure | null;
  busy: boolean;
  onRetry: () => void;
}) {
  if (!failure) return null;
  const canRetry = !busy;
  return (
    <Alert className="mt-5" variant="destructive">
      <AlertTitle>{failure === "unavailable" ? "Status check unavailable" : "Status not found"}</AlertTitle>
      <AlertDescription>{supplierApplicationStatusFailureMessage(failure)}</AlertDescription>
      {canRetry ? (
        <Button type="button" variant="outline" size="sm" className="col-start-2 mt-2" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </Alert>
  );
}

function StatusResultCard({
  result,
  lastCheckedAt,
}: {
  result: PrismSupplierApplicationStatusResult;
  lastCheckedAt: Date | null;
}) {
  const isTerminal = isTerminalSupplierApplicationStatus(result.status);
  return (
    <section aria-live="polite" className="mt-6 rounded-2xl border border-border bg-muted/30 p-5">
      <p className="text-sm text-muted-foreground">{result.companyName}</p>
      <h2 className="mt-1 text-xl font-semibold">{supplierApplicationStatusLabel(result.status)}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {supplierApplicationStatusDescription(result.status)}
      </p>
      <dl className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Submitted</dt>
          <dd className="mt-1 font-medium">{formatDate(result.submittedAt)}</dd>
        </div>
        {result.reviewedAt ? (
          <div>
            <dt className="text-muted-foreground">Last reviewed</dt>
            <dd className="mt-1 font-medium">{formatDate(result.reviewedAt)}</dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">
        {lastCheckedAt ? `Last checked ${lastCheckedAt.toLocaleTimeString()}.` : "Checking for the latest status…"}
        {!isTerminal ? " This page checks for updates while it remains open." : ""}
      </p>
    </section>
  );
}

export function SupplierApplicationStatusView() {
  const viewModel = useSupplierApplicationStatusViewModel();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void viewModel.submit();
  }

  return (
    <main className="min-h-dvh bg-background px-6 py-16 text-foreground">
      <section className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="text-sm text-muted-foreground">Supplier network</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Check application status</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Use the application reference and submitting email to view the latest review status.
        </p>

        <form className="mt-8 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium" htmlFor="applicationId">
            Application reference
            <Input
              id="applicationId"
              required
              value={viewModel.applicationId}
              onChange={(event) => viewModel.setApplicationId(event.target.value)}
              className="mt-2"
              placeholder="sap_…"
              autoComplete="off"
            />
          </label>
          <label className="block text-sm font-medium" htmlFor="applicationEmail">
            Submitting email
            <Input
              id="applicationEmail"
              required
              type="email"
              value={viewModel.email}
              onChange={(event) => viewModel.setEmail(event.target.value)}
              className="mt-2"
              placeholder="you@company.com"
              autoComplete="email"
            />
          </label>
          <Button type="submit" disabled={viewModel.busy} className="w-full">
            {viewModel.phase === "refreshing" ? "Refreshing…" : viewModel.busy ? "Checking…" : "Check status"}
          </Button>
        </form>

        <StatusFailureAlert
          failure={viewModel.failure}
          busy={viewModel.busy}
          onRetry={() => void viewModel.retry()}
        />
        {viewModel.result ? (
          <StatusResultCard result={viewModel.result} lastCheckedAt={viewModel.lastCheckedAt} />
        ) : null}
      </section>
    </main>
  );
}
