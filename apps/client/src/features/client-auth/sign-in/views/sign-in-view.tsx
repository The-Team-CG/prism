"use client";

import { PrismAccountHelp } from "@prism/ui/account-help";
import { FormEvent } from "react";
import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { PrismAuthEmailField, PrismAuthError, PrismAuthLinks, PrismAuthPasswordField, PrismAuthSubmit } from "@prism/ui/auth-form";
import { Button } from "@prism/ui/components/button";
import { SignInCodeStep } from "@prism/ui/sign-in-code-step";
import { CLIENT_PORTAL_POINTS, CLIENT_PORTAL_STATEMENT } from "../model/client-portal-copy";
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";
import { useSignInViewModel } from "../view-models/use-sign-in-view-model";

type SignInVm = ReturnType<typeof useSignInViewModel>;

const ERROR_ID = "sign-in-error";

export function SignInView() {
  const vm = useSignInViewModel();

  return (
    <PrismAuthShell
      portal="client"
      portalName="Client portal"
      statement={CLIENT_PORTAL_STATEMENT}
      points={CLIENT_PORTAL_POINTS}
      homeHref="/"
      title="Sign in to the client portal"
      description="Access opens when PMCM accepts your inquiry: first your briefing and proposal, then the full portal once your conforme is signed."
      footer={
        <>
          <p>Clients whose inquiry PMCM has accepted.</p>
          <PrismAccountHelp contact={pmcmSupportContactFromEnvironment()} topic="client portal access" />
        </>
      }
    >
      {vm.signedInUser ? <SignedInCard user={vm.signedInUser} /> : vm.twoStepToken ? <CodeForm vm={vm} /> : <SignInForm vm={vm} />}
    </PrismAuthShell>
  );
}

function SignedInCard({ user }: { user: NonNullable<SignInVm["signedInUser"]> }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border-l-2 border-primary py-1 pl-4">
        <p className="text-sm font-semibold text-foreground">{user.name}</p>
        <p className="text-sm text-muted-foreground">{user.organization}</p>
      </div>
      <Button asChild className={prismAuthSubmitClassName("client")}>
        <a href="/dashboard">Continue to dashboard</a>
      </Button>
    </div>
  );
}

function CodeForm({ vm }: { vm: SignInVm }) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.submit();
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
      <SignInCodeStep code={vm.code} onCodeChange={vm.setCode} busy={vm.busy} invalid={Boolean(vm.error)} errorId={ERROR_ID} onBack={vm.backToPassword} />
      <PrismAuthError id={ERROR_ID} message={vm.error} />
      <PrismAuthSubmit portal="client" busy={vm.busy} disabled={vm.code.length !== 6} label="Verify code" busyLabel="Checking..." />
    </form>
  );
}

function SignInForm({ vm }: { vm: SignInVm }) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.submit();
  }
  const errorId = vm.error ? ERROR_ID : undefined;

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <PrismAuthEmailField value={vm.draft.email} onChange={(email) => vm.update("email", email)} errorId={errorId} />
      <PrismAuthPasswordField
        value={vm.draft.password}
        onChange={(password) => vm.update("password", password)}
        shown={vm.showPassword}
        onToggleShown={() => vm.setShowPassword((shown) => !shown)}
        forgotHref="/password-reset"
        errorId={errorId}
      />
      <PrismAuthError id={ERROR_ID} message={vm.error} />
      <PrismAuthSubmit portal="client" busy={vm.busy} label="Sign in" busyLabel="Signing in..." />
      <PrismAuthLinks primary={{ href: "/sign-up", label: "Need access? Request here" }} secondary={{ href: "/inquiry", label: "No inquiry yet?" }} />
    </form>
  );
}
