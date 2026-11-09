"use client";
import { formatPortalDate, formatPortalTime } from "@prism/ui/format-date";

import { PrismAccountHelp } from "@prism/ui/account-help";
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";
import type { FormEvent } from "react";
import type { PrismSupplierApplicationStatusResult } from "@prism/types";
import { portalHref } from "@prism/ui/portal-path";
import { PRISM_AUTH_INPUT_CLASS_NAME, PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { SUPPLIER_PORTAL_POINTS, SUPPLIER_PORTAL_STATEMENT } from "@/features/supplier-auth/sign-in/model/supplier-portal-copy";
import { Alert, AlertDescription, AlertTitle } from "@prism/ui/components/alert";
import { Button } from "@prism/ui/components/button";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { useSupplierApplicationStatusViewModel } from "../view-models/use-supplier-application-status-view-model";
import {
  isTerminalSupplierApplicationStatus,
  supplierApplicationStatusDescription,
  supplierApplicationStatusFailureMessage,
  supplierApplicationStatusLabel,
  type SupplierApplicationStatusFailure,
} from "../model/supplier-application-status-rules";

function formatDate(value: string): string {
  return formatPortalDate(value);
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
    <section aria-live="polite" className="mt-6 rounded-lg border border-border bg-card p-5">
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
      {result.status === "declined" ? (
        <div className="mt-3 text-sm text-muted-foreground">
          <PrismAccountHelp contact={pmcmSupportContactFromEnvironment()} topic={`the ${result.companyName} supplier application`} fallback={null} />
        </div>
      ) : null}
      <p className="mt-4 text-xs text-muted-foreground">
        {lastCheckedAt ? `Last checked ${formatPortalTime(lastCheckedAt.toISOString())}.` : "Checking for the latest status…"}
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
    <PrismAuthShell
      portal="supplier"
      portalName="Supplier portal"
      statement={SUPPLIER_PORTAL_STATEMENT}
      points={SUPPLIER_PORTAL_POINTS}
      title="Check application status"
      description="Use the application reference and submitting email to view the latest review status."
      homeHref={portalHref("/")}
      footer={
        <p>
          Not applied yet?{" "}
          <a href={portalHref("/apply")} className="text-primary hover:text-primary/80">Apply to become a PMCM supplier</a>
        </p>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <Field>
          <FieldLabel htmlFor="applicationId">Application reference</FieldLabel>
          <Input
            id="applicationId"
            required
            value={viewModel.applicationId}
            onChange={(event) => viewModel.setApplicationId(event.target.value)}
            placeholder="sap_…"
            autoComplete="off"
            className={`h-12 rounded-lg bg-card text-base ${PRISM_AUTH_INPUT_CLASS_NAME}`}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="applicationEmail">Submitting email</FieldLabel>
          <Input
            id="applicationEmail"
            required
            type="email"
            value={viewModel.email}
            onChange={(event) => viewModel.setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            className={`h-12 rounded-lg bg-card text-base ${PRISM_AUTH_INPUT_CLASS_NAME}`}
          />
        </Field>
        <Button type="submit" disabled={viewModel.busy} className={prismAuthSubmitClassName("supplier")}>
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
    </PrismAuthShell>
  );
}
