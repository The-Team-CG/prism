"use client";

import { FormEvent } from "react";
import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { portalHref } from "@prism/ui/portal-path";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { CLIENT_PORTAL_POINTS, CLIENT_PORTAL_STATEMENT } from "../../sign-in/model/client-portal-copy";
import { PasswordSetFields } from "../../password-reset/views/password-set-fields";
import { ACTIVATION_INVALID_COPY, activateProgress } from "../model/activate-model";
import { useClientActivateViewModel } from "../view-models/use-activate-view-model";

export function ClientActivateView() {
  const vm = useClientActivateViewModel();

  return (
    <PrismAuthShell
      portal="client"
      portalName="Client portal"
      statement={CLIENT_PORTAL_STATEMENT}
      points={CLIENT_PORTAL_POINTS}
      homeHref="/"
      steps={vm.view === "set" || vm.view === "done" ? activateProgress(vm.view) : undefined}
      title={vm.view === "done" ? "You're all set" : "Activate your account"}
      description={
        vm.view === "set" ? "Choose a password to finish setting up your client portal account." : undefined
      }
    >
      {vm.view === "loading" ? null : vm.view === "done" ? (
        <Button asChild className={prismAuthSubmitClassName("client")}>
          <a href={portalHref("/sign-in")}>Sign in</a>
        </Button>
      ) : vm.view === "invalid" ? (
        <div className="flex flex-col gap-5">
          <p role="alert" className="text-sm text-foreground">
            {ACTIVATION_INVALID_COPY}
          </p>
          <a href={portalHref("/sign-in")} className="text-center text-sm text-primary transition-colors hover:text-primary/80">
            Back to sign in
          </a>
        </div>
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(event: FormEvent<HTMLFormElement>) => void vm.activate(event)}
        >
          <PasswordSetFields
            password={vm.password}
            confirmPassword={vm.confirmPassword}
            showPassword={vm.showPassword}
            onPasswordChange={vm.setPassword}
            onConfirmPasswordChange={vm.setConfirmPassword}
            onShowPasswordChange={vm.setShowPassword}
          />

          {vm.error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{vm.error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={vm.busy || !vm.canSubmit} className={prismAuthSubmitClassName("client")}>
            {vm.busy ? "Processing..." : "Set password"}
          </Button>

          <a href={portalHref("/sign-in")} className="text-center text-sm text-primary transition-colors hover:text-primary/80">
            Back to sign in
          </a>
        </form>
      )}
    </PrismAuthShell>
  );
}
