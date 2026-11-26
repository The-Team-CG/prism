"use client";

import { PrismAccountHelp } from "@prism/ui/account-help";
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";
import { FormEvent } from "react";
import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { portalHref } from "@prism/ui/portal-path";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { PrismAuthEmailField, PrismAuthError, PrismAuthSubmit } from "@prism/ui/auth-form";
import { Button } from "@prism/ui/components/button";
import { SupplierNewPasswordFields } from "../../new-password/views/new-password-fields";
import { SUPPLIER_PORTAL_POINTS, SUPPLIER_PORTAL_STATEMENT } from "../../sign-in/model/supplier-portal-copy";
import { ACTIVATION_INVALID_COPY, activationProgress, type ActivateView } from "../model/activate-model";
import { useSupplierActivateViewModel } from "../view-models/use-activate-view-model";

const TITLES: Record<ActivateView, string> = {
  loading: "Activate your account",
  confirm: "Welcome to the supplier portal",
  set: "Set your password",
  invalid: "This link no longer works",
  done: "You're all set",
};

const DESCRIPTIONS: Partial<Record<ActivateView, string>> = {
  confirm: "PMCM approved your supplier account. Your quote requests and bookings are waiting.",
  set: "Choose a password to activate your supplier portal account.",
};

export function SupplierActivateView() {
  const vm = useSupplierActivateViewModel();

  return (
    <PrismAuthShell
      portal="supplier"
      portalName="Supplier portal"
      statement={SUPPLIER_PORTAL_STATEMENT}
      points={SUPPLIER_PORTAL_POINTS}
      homeHref={portalHref("/")}
      steps={vm.view === "confirm" || vm.view === "set" || vm.view === "done" ? activationProgress(vm.view) : undefined}
      title={TITLES[vm.view]}
      description={DESCRIPTIONS[vm.view]}
    >
      {vm.view === "loading" ? null : vm.view === "done" ? (
        <Button asChild className={prismAuthSubmitClassName("supplier")}>
          <a href={portalHref("/sign-in")}>Sign in</a>
        </Button>
      ) : vm.view === "invalid" ? (
        <form className="flex flex-col gap-5" onSubmit={(event) => void vm.emailFreshCode(event)}>
          <p role="status" className="text-sm text-foreground">
            {ACTIVATION_INVALID_COPY}
          </p>
          <PrismAuthEmailField value={vm.email} onChange={vm.setEmail} placeholder="supplier@example.com" errorId={vm.error ? "activate-error" : undefined} />
          <PrismAuthError id="activate-error" message={vm.error} />
          <PrismAuthSubmit portal="supplier" busy={vm.busy} label="Email me a sign-in code" busyLabel="Sending..." />
          <div className="text-sm text-muted-foreground">
            <PrismAccountHelp contact={pmcmSupportContactFromEnvironment()} topic="an expired invitation link" fallback={null} />
          </div>
        </form>
      ) : vm.view === "confirm" ? (
        <form className="flex flex-col gap-5" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void vm.confirm(); }}>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Signing in as</p>
            <p className="text-sm font-semibold text-foreground">{vm.preview?.email}</p>
            <p className="text-sm text-muted-foreground">{vm.preview?.organization}</p>
          </div>
          <PrismAuthError id="activate-error" message={vm.error} />
          <PrismAuthSubmit portal="supplier" busy={vm.busy} label="Confirm and continue" busyLabel="Opening your portal..." />
          <p className="text-sm text-muted-foreground">
            Next: the privacy notice. You can sign in later with a code emailed to you, or{" "}
            <button type="button" onClick={vm.choosePassword} className="text-primary hover:text-primary/80">set a password instead</button>.
          </p>
        </form>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={(event: FormEvent<HTMLFormElement>) => void vm.submit(event)}>
          <SupplierNewPasswordFields
            password={vm.password}
            confirmPassword={vm.confirmPassword}
            showPassword={vm.showPassword}
            onPasswordChange={vm.setPassword}
            onConfirmPasswordChange={vm.setConfirmPassword}
            onToggleShowPassword={() => vm.setShowPassword(!vm.showPassword)}
          />

          {vm.error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{vm.error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={vm.busy || !vm.canSubmit} className={prismAuthSubmitClassName("supplier")}>
            {vm.busy ? "Processing..." : "Activate account"}
          </Button>

          <a href={portalHref("/sign-in")} className="text-center text-sm text-primary transition-colors hover:text-primary/80">
            Back to sign in
          </a>
        </form>
      )}
    </PrismAuthShell>
  );
}
