"use client";

import { portalHref } from "@prism/ui/portal-path";
import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Field } from "@/app/components/ui/field";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { SUPPLIER_PORTAL_POINTS, SUPPLIER_PORTAL_STATEMENT } from "../model/supplier-portal-copy";
import { useSupplierSignInViewModel } from "../view-models/use-supplier-sign-in-view-model";

function ExistingSessionBanner({ name, organization }: { name: string; organization: string }) {
  return (
    <a
      href={portalHref("/dashboard")}
      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
    >
      <div>
        <p className="text-sm font-semibold text-foreground">Continue as {name}</p>
        <p className="text-sm text-muted-foreground">{organization}</p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </a>
  );
}

function ApprovalRequestPanel({
  showApproval,
  busy,
  consentAccepted,
  onToggle,
  onConsentChange,
  onRequest,
}: {
  showApproval: boolean;
  busy: boolean;
  consentAccepted: boolean;
  onToggle: () => void;
  onConsentChange: (accepted: boolean) => void;
  onRequest: () => void;
}) {
  return (
    <div className="border-t border-border pt-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={showApproval}
        className="flex w-full items-center justify-between text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
      >
        <span>Need supplier access?</span>
        <span className="text-muted-foreground">{showApproval ? "Close" : "Request"}</span>
      </button>
      {showApproval ? (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Request PMCM approval for a new supplier account. A coordinator will review and activate your access.
          </p>
          <label className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(e) => onConsentChange(e.target.checked)}
              className="mt-1 size-4 accent-primary"
            />
            <span>I consent to PMCM processing this request for supplier portal access review.</span>
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !consentAccepted}
            onClick={onRequest}
            className="h-12 w-full rounded-lg text-sm font-semibold"
          >
            <ShieldCheck className="size-4" /> Request PMCM approval
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function SupplierSignInView() {
  const vm = useSupplierSignInViewModel();

  return (
    <PrismAuthShell
      portal="supplier"
      portalName="Supplier portal"
      statement={SUPPLIER_PORTAL_STATEMENT}
      points={SUPPLIER_PORTAL_POINTS}
      homeHref={portalHref("/")}
      title="Sign in to the supplier portal"
      footer={
        <>
          <p>Approved supplier accounts only.</p>
          <p>Contact PMCM for account issues or access requests.</p>
        </>
      }
    >
      {vm.existing ? (
        <div className="mb-6">
          <ExistingSessionBanner name={vm.existing.name} organization={vm.existing.organization} />
        </div>
      ) : null}

      <form className="flex flex-col gap-5" onSubmit={vm.submit}>
        <Field>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={vm.draft.email}
            onChange={(e) => vm.updateEmail(e.target.value)}
            placeholder="supplier@example.com"
            required
            className="h-12 rounded-lg bg-card text-base"
          />
        </Field>

        <Field>
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={vm.showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={vm.draft.password}
              onChange={(e) => vm.updatePassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="h-12 rounded-lg bg-card pr-12 text-base"
            />
            <button
              type="button"
              onClick={() => vm.setShowPassword((v) => !v)}
              className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              aria-label={vm.showPassword ? "Hide password" : "Show password"}
            >
              {vm.showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          <a href={portalHref("/password-reset")} className="self-end text-sm text-primary transition-colors hover:text-primary/80">
            Forgot password?
          </a>
        </Field>

        {vm.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{vm.error}</AlertDescription>
          </Alert>
        ) : null}
        {vm.notice ? (
          <p role="status" className="text-sm text-foreground">
            {vm.notice}
          </p>
        ) : null}

        <Button type="submit" disabled={vm.busy} className={prismAuthSubmitClassName("supplier")}>
          {vm.busy ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="mt-8">
        <ApprovalRequestPanel
          showApproval={vm.showApproval}
          busy={vm.busy}
          consentAccepted={vm.approvalConsentAccepted}
          onToggle={() => vm.setShowApproval((v) => !v)}
          onConsentChange={vm.setApprovalConsentAccepted}
          onRequest={() => void vm.requestApproval()}
        />
      </div>
    </PrismAuthShell>
  );
}
