"use client";

import { PrismAccountHelp } from "@prism/ui/account-help";
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";
import { FormEvent } from "react";
import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { PrismAuthEmailField, PrismAuthError, PrismAuthSubmit } from "@prism/ui/auth-form";
import { portalHref } from "@prism/ui/portal-path";
import { Button } from "@prism/ui/components/button";
import { CLIENT_PORTAL_POINTS, CLIENT_PORTAL_STATEMENT } from "../../sign-in/model/client-portal-copy";
import { PasswordSetFields } from "../../password-reset/views/password-set-fields";
import { ACTIVATION_INVALID_COPY, activateProgress } from "../model/activate-model";
import { useClientActivateViewModel } from "../view-models/use-activate-view-model";

type ActivateVm = ReturnType<typeof useClientActivateViewModel>;

function firstName(name: string | undefined) {
  return name?.trim().split(/\s+/)[0] ?? "";
}

export function ClientActivateView() {
  const vm = useClientActivateViewModel();
  const greeting = vm.preview ? `Welcome, ${firstName(vm.preview.name)}` : "Activate your account";

  return (
    <PrismAuthShell
      portal="client"
      portalName="Client portal"
      statement={CLIENT_PORTAL_STATEMENT}
      points={CLIENT_PORTAL_POINTS}
      homeHref="/"
      steps={vm.view === "confirm" || vm.view === "set" || vm.view === "done" ? activateProgress(vm.view) : undefined}
      title={vm.view === "done" ? "You're all set" : vm.view === "invalid" ? "This link no longer works" : greeting}
      description={
        vm.view === "confirm"
          ? "PMCM accepted your inquiry. Your briefing and proposal are ready for you."
          : vm.view === "set"
            ? "Choose a password to finish setting up your client portal account."
            : undefined
      }
    >
      {vm.view === "loading" ? null : vm.view === "done" ? (
        <ActivateDoneStep />
      ) : vm.view === "invalid" ? (
        <ActivateInvalidStep vm={vm} />
      ) : vm.view === "confirm" ? (
        <ConfirmStep vm={vm} />
      ) : (
        <ActivateSetForm vm={vm} />
      )}
    </PrismAuthShell>
  );
}

function ConfirmStep({ vm }: { vm: ActivateVm }) {
  return (
    <form className="flex flex-col gap-5" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void vm.confirm(); }}>
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Signing in as</p>
        <p className="text-sm font-semibold text-foreground">{vm.preview?.email}</p>
        <p className="text-sm text-muted-foreground">{vm.preview?.organization}</p>
      </div>
      <PrismAuthError id="activate-error" message={vm.error} />
      <PrismAuthSubmit portal="client" busy={vm.busy} label="Confirm and continue" busyLabel="Opening your portal..." />
      <p className="text-sm text-muted-foreground">
        Next: the privacy notice, then your briefing. You can sign in later with a code emailed to you, or{" "}
        <button type="button" onClick={vm.choosePassword} className="text-primary hover:text-primary/80">set a password instead</button>.
      </p>
    </form>
  );
}

function ActivateDoneStep() {
  return (
    <Button asChild className={prismAuthSubmitClassName("client")}>
      <a href={portalHref("/sign-in")}>Sign in</a>
    </Button>
  );
}

function ActivateInvalidStep({ vm }: { vm: ActivateVm }) {
  return (
    <form className="flex flex-col gap-5" onSubmit={(event) => void vm.emailFreshCode(event)}>
      <p role="alert" className="text-sm text-foreground">
        {ACTIVATION_INVALID_COPY}
      </p>
      <PrismAuthEmailField value={vm.email} onChange={vm.setEmail} errorId={vm.error ? "activate-error" : undefined} />
      <PrismAuthError id="activate-error" message={vm.error} />
      <PrismAuthSubmit portal="client" busy={vm.busy} label="Email me a sign-in code" busyLabel="Sending..." />
      <div className="text-sm text-muted-foreground">
        <PrismAccountHelp contact={pmcmSupportContactFromEnvironment()} topic="an expired invitation link" fallback={null} />
      </div>
    </form>
  );
}

function ActivateSetForm({ vm }: { vm: ActivateVm }) {
  return (
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
      <PrismAuthError id="activate-error" message={vm.error} />
      <PrismAuthSubmit portal="client" busy={vm.busy} disabled={!vm.canSubmit} label="Set password" busyLabel="Processing..." />
      <a href={portalHref("/sign-in")} className="text-center text-sm text-primary transition-colors hover:text-primary/80">
        Back to sign in
      </a>
    </form>
  );
}
