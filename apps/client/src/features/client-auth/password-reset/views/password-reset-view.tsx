"use client";

import { FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
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
  const mismatch = vm.confirmPassword.length > 0 && !vm.passwordsMatch;

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
            <>
              <Field>
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={vm.showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                    value={vm.password}
                    onChange={(e) => vm.setPassword(e.target.value)}
                    aria-describedby="password-checklist"
                    className={`h-12 rounded-lg bg-card pr-12 text-base ${PRISM_AUTH_INPUT_CLASS_NAME}`}
                  />
                  <button
                    type="button"
                    onClick={() => vm.setShowPassword(!vm.showPassword)}
                    className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    aria-label={vm.showPassword ? "Hide password" : "Show password"}
                  >
                    {vm.showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </Field>
              <Field>
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type={vm.showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  value={vm.confirmPassword}
                  onChange={(e) => vm.setConfirmPassword(e.target.value)}
                  aria-invalid={mismatch ? true : undefined}
                  aria-describedby={mismatch ? "confirm-password-error" : undefined}
                  className={`h-12 rounded-lg bg-card text-base ${PRISM_AUTH_INPUT_CLASS_NAME}`}
                />
                {mismatch ? (
                  <p id="confirm-password-error" className="text-sm text-destructive">
                    Passwords do not match.
                  </p>
                ) : null}
              </Field>
              <ul id="password-checklist" className="flex flex-col gap-1.5 text-sm">
                {vm.checks.map((check) => (
                  <li key={check.id} className={check.met ? "text-foreground" : "text-muted-foreground"}>
                    <span aria-hidden="true">{check.met ? "✓ " : "○ "}</span>
                    {check.label}
                  </li>
                ))}
              </ul>
            </>
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
