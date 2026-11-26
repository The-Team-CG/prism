"use client";

import { PrismAccountHelp } from "@prism/ui/account-help";
import { FormEvent } from "react";
import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { PrismAuthAlternative, PrismAuthEmailField, PrismAuthError, PrismAuthLinks, PrismAuthPasswordField, PrismAuthSubmit, PrismEmailCodeStep } from "@prism/ui/auth-form";
import { Button } from "@prism/ui/components/button";
import { EMAIL_SIGN_IN_CODE_TTL_MINUTES } from "@prism/types";
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
      {vm.signedInUser ? <SignedInCard user={vm.signedInUser} /> : vm.twoStepToken ? <CodeForm vm={vm} /> : vm.codeSentTo ? <EmailCodeForm vm={vm} /> : <SignInForm vm={vm} />}
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

function EmailCodeForm({ vm }: { vm: SignInVm }) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.submit();
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
      <PrismEmailCodeStep
        email={vm.codeSentTo ?? ""}
        code={vm.emailCode}
        onCodeChange={vm.setEmailCode}
        busy={vm.busy}
        invalid={Boolean(vm.error)}
        errorId={ERROR_ID}
        resendIn={vm.resendIn}
        onResend={vm.resendEmailCode}
        onChangeEmail={vm.changeEmail}
        ttlMinutes={EMAIL_SIGN_IN_CODE_TTL_MINUTES}
      />
      <PrismAuthError id={ERROR_ID} message={vm.error} />
      <PrismAuthSubmit portal="client" busy={vm.busy} disabled={vm.emailCode.length !== 6} label="Continue" busyLabel="Checking..." />
    </form>
  );
}

function SignInForm({ vm }: { vm: SignInVm }) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.submit();
  }
  const errorId = vm.error ? ERROR_ID : undefined;
  const byCode = vm.method === "code";

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <PrismAuthEmailField value={vm.draft.email} onChange={(email) => vm.update("email", email)} errorId={errorId} />
      {byCode ? null : (
        <PrismAuthPasswordField
          value={vm.draft.password}
          onChange={(password) => vm.update("password", password)}
          shown={vm.showPassword}
          onToggleShown={() => vm.setShowPassword((shown) => !shown)}
          forgotHref="/password-reset"
          errorId={errorId}
        />
      )}
      <PrismAuthError id={ERROR_ID} message={vm.error} />
      <PrismAuthSubmit portal="client" busy={vm.busy} label={byCode ? "Email me a sign-in code" : "Sign in"} busyLabel={byCode ? "Sending..." : "Signing in..."} />
      <PrismAuthAlternative>
        <Button type="button" variant="outline" className="h-12 w-full rounded-lg text-sm font-semibold" onClick={() => vm.chooseMethod(byCode ? "password" : "code")}>
          {byCode ? "Sign in with password" : "Email me a code instead"}
        </Button>
      </PrismAuthAlternative>
      <PrismAuthLinks primary={{ href: "/sign-up", label: "Need access? Request here" }} secondary={{ href: "/inquiry", label: "No inquiry yet?" }} />
    </form>
  );
}
