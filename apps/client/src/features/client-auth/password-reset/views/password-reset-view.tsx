"use client";

import { FormEvent } from "react";
import { PRISM_AUTH_INPUT_CLASS_NAME, PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { portalHref } from "@prism/ui/portal-path";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Field } from "@/app/components/ui/field";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { CLIENT_PORTAL_POINTS, CLIENT_PORTAL_STATEMENT } from "../../sign-in/model/client-portal-copy";
import {
  PASSWORD_RESET_DONE_LABEL,
  passwordResetProgress,
  passwordResetSentCopy,
  type PasswordResetView,
} from "../model/password-reset-model";
import { useClientPasswordResetViewModel } from "../view-models/use-password-reset-view-model";
import { PasswordSetFields } from "./password-set-fields";

const TITLES: Record<PasswordResetView, string> = {
  loading: "Reset your password",
  request: "Reset your password",
  check: "Check your email",
  set: "Set a new password",
  done: "Password updated",
};

const DESCRIPTIONS: Partial<Record<PasswordResetView, string>> = {
  request: "Enter the email on your client account and PMCM will send a reset link.",
  set: "Choose a new password for your client portal account.",
  done: "Your password is updated. Sign in with the new password.",
};

export function ClientPasswordResetView() {
  const vm = useClientPasswordResetViewModel();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (vm.view === "set") void vm.consumeReset(event);
    else void vm.requestReset(event);
  }

  return (
    <PrismAuthShell
      portal="client"
      portalName="Client portal"
      statement={CLIENT_PORTAL_STATEMENT}
      points={CLIENT_PORTAL_POINTS}
      homeHref="/"
      steps={vm.view === "loading" ? undefined : passwordResetProgress(vm.view)}
      title={TITLES[vm.view]}
      description={DESCRIPTIONS[vm.view]}
    >
      {vm.view === "loading" ? null : vm.view === "done" ? (
        <div className="flex flex-col gap-5">
          <p role="status" className="text-sm text-foreground">
            {PASSWORD_RESET_DONE_LABEL}. You can sign in now.
          </p>
          <Button asChild className={prismAuthSubmitClassName("client")}>
            <a href={portalHref("/sign-in")}>Sign in</a>
          </Button>
        </div>
      ) : vm.view === "check" ? (
        <div className="flex flex-col gap-5">
          <p role="status" className="text-sm text-foreground">
            {passwordResetSentCopy(vm.sentTo ?? "")}
          </p>
          <Button type="button" variant="ghost" onClick={vm.useDifferentEmail} className="self-start px-0 text-primary">
            Use a different email
          </Button>
          <a href={portalHref("/sign-in")} className="text-center text-sm text-primary transition-colors hover:text-primary/80">
            Back to sign in
          </a>
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          {vm.view === "set" ? (
            <PasswordSetFields
              password={vm.password}
              confirmPassword={vm.confirmPassword}
              showPassword={vm.showPassword}
              onPasswordChange={vm.setPassword}
              onConfirmPasswordChange={vm.setConfirmPassword}
              onShowPasswordChange={vm.setShowPassword}
            />
          ) : (
            <Field>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={vm.email}
                onChange={(e) => vm.setEmail(e.target.value)}
                placeholder="name@company.com"
                className={`h-12 rounded-lg bg-card text-base ${PRISM_AUTH_INPUT_CLASS_NAME}`}
              />
            </Field>
          )}

          {vm.error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{vm.error}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="submit"
            disabled={vm.busy || (vm.view === "set" && !vm.canSetPassword)}
            className={prismAuthSubmitClassName("client")}
          >
            {vm.busy ? "Processing..." : vm.view === "set" ? "Set password" : "Send reset link"}
          </Button>

          <a href={portalHref("/sign-in")} className="text-center text-sm text-primary transition-colors hover:text-primary/80">
            Back to sign in
          </a>
        </form>
      )}
    </PrismAuthShell>
  );
}
