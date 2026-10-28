"use client";

import { PrismAccountHelp } from "@prism/ui/account-help";
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";
import { FormEvent } from "react";
import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { portalHref } from "@prism/ui/portal-path";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { SupplierNewPasswordFields } from "../../new-password/views/new-password-fields";
import { SUPPLIER_PORTAL_POINTS, SUPPLIER_PORTAL_STATEMENT } from "../../sign-in/model/supplier-portal-copy";
import { ACTIVATION_INVALID_COPY, activationProgress, type ActivateView } from "../model/activate-model";
import { useSupplierActivateViewModel } from "../view-models/use-activate-view-model";

const TITLES: Record<ActivateView, string> = {
  loading: "Activate your account",
  set: "Set your password",
  invalid: "Activate your account",
  done: "You're all set",
};

const DESCRIPTIONS: Partial<Record<ActivateView, string>> = {
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
      steps={vm.view === "set" || vm.view === "done" ? activationProgress(vm.view) : undefined}
      title={TITLES[vm.view]}
      description={DESCRIPTIONS[vm.view]}
    >
      {vm.view === "loading" ? null : vm.view === "done" ? (
        <Button asChild className={prismAuthSubmitClassName("supplier")}>
          <a href={portalHref("/sign-in")}>Sign in</a>
        </Button>
      ) : vm.view === "invalid" ? (
        <div className="flex flex-col gap-5">
          <p role="status" className="text-sm text-foreground">
            {ACTIVATION_INVALID_COPY}
          </p>
          <div className="text-sm text-muted-foreground">
            <PrismAccountHelp contact={pmcmSupportContactFromEnvironment()} topic="an expired invitation link" fallback={null} />
          </div>
          <a href={portalHref("/sign-in")} className="text-center text-sm text-primary transition-colors hover:text-primary/80">
            Back to sign in
          </a>
        </div>
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
