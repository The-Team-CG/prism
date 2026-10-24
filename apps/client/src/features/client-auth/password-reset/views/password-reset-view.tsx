"use client";

import { FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { portalHref } from "@prism/ui/portal-path";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Field } from "@/app/components/ui/field";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { CLIENT_PORTAL_POINTS, CLIENT_PORTAL_STATEMENT } from "../../sign-in/model/client-portal-copy";
import { useClientPasswordResetViewModel } from "../view-models/use-password-reset-view-model";

export function ClientPasswordResetView() {
  const vm = useClientPasswordResetViewModel();
  const mismatch = vm.confirmPassword.length > 0 && !vm.passwordsMatch;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.submit();
  }

  return (
    <PrismAuthShell
      portal="client"
      portalName="Client portal"
      statement={CLIENT_PORTAL_STATEMENT}
      points={CLIENT_PORTAL_POINTS}
      homeHref="/"
      title={vm.isSetStep ? "Set a new password" : "Reset your password"}
      description={
        vm.isSetStep
          ? "Choose a new password for your client portal account."
          : "Use the trusted reset link from PMCM, or request a new one."
      }
    >
      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        {vm.isSetStep ? (
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
                  aria-describedby="new-password-hint"
                  className="h-12 rounded-lg bg-card pr-12 text-base"
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
              <p id="new-password-hint" className="text-sm text-muted-foreground">At least 12 characters.</p>
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
                className="h-12 rounded-lg bg-card text-base"
              />
              {mismatch ? (
                <p id="confirm-password-error" className="text-sm text-destructive">
                  Passwords do not match.
                </p>
              ) : null}
            </Field>
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
              className="h-12 rounded-lg bg-card text-base"
            />
          </Field>
        )}

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

        <Button type="submit" disabled={vm.busy} className={prismAuthSubmitClassName("client")}>
          {vm.busy ? "Processing..." : vm.isSetStep ? "Set password" : "Request reset"}
        </Button>

        <a href={portalHref("/sign-in")} className="text-center text-sm text-primary transition-colors hover:text-primary/80">
          Back to sign in
        </a>
      </form>
    </PrismAuthShell>
  );
}
