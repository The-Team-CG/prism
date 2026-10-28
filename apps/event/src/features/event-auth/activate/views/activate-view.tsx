"use client";

import { PrismAccountHelp } from "@prism/ui/account-help";
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";
import { FormEvent } from "react";
import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { portalHref } from "@prism/ui/portal-path";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { EVENT_PORTAL_POINTS, EVENT_PORTAL_STATEMENT } from "../../sign-in/model/event-portal-copy";
import { NewPasswordFields } from "../../password-setup/views/new-password-fields";
import { ACTIVATION_INVALID_COPY, activationProgress, type ActivateView } from "../model/activate-model";
import { useEventActivateViewModel } from "../view-models/use-activate-view-model";

const TITLES: Record<ActivateView, string> = {
  loading: "Set your password",
  set: "Set your password",
  invalid: "Invitation unavailable",
  done: "You're all set",
};

export function EventActivateView() {
  const vm = useEventActivateViewModel();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void vm.activate(event);
  }

  return (
    <PrismAuthShell
      portal="event"
      portalName="Event Command Portal"
      statement={EVENT_PORTAL_STATEMENT}
      points={EVENT_PORTAL_POINTS}
      homeHref={portalHref("/")}
      steps={vm.view === "set" || vm.view === "done" ? activationProgress(vm.view) : undefined}
      title={TITLES[vm.view]}
      description={vm.view === "set" ? "Choose a password for your event portal account." : undefined}
    >
      {vm.view === "loading" ? null : vm.view === "done" ? (
        <Button asChild className={prismAuthSubmitClassName("event")}>
          <a href={portalHref("/sign-in")}>Sign in</a>
        </Button>
      ) : vm.view === "invalid" ? (
        <div className="flex flex-col gap-5">
          <p role="alert" className="text-sm text-foreground">
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
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <NewPasswordFields
            password={vm.password}
            confirmPassword={vm.confirmPassword}
            showPassword={vm.showPassword}
            checks={vm.checks}
            onPasswordChange={vm.setPassword}
            onConfirmPasswordChange={vm.setConfirmPassword}
            onShowPasswordChange={vm.setShowPassword}
          />

          {vm.error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{vm.error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={vm.busy || !vm.canSubmit} className={prismAuthSubmitClassName("event")}>
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
