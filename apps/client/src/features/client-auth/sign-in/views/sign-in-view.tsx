"use client";

import { FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PRISM_AUTH_INPUT_CLASS_NAME, PrismAuthShell, PrismWrongPortalLinks, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Field } from "@/app/components/ui/field";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { CLIENT_PORTAL_POINTS, CLIENT_PORTAL_STATEMENT } from "../model/client-portal-copy";
import { portalUrlsFromEnvironment, wrongPortalLinks } from "../model/wrong-portal-links";
import { useSignInViewModel } from "../view-models/use-sign-in-view-model";

export function SignInView() {
  const vm = useSignInViewModel();
  const otherPortals = wrongPortalLinks("client", portalUrlsFromEnvironment());

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
      title="Sign in to the client portal"
      description="Access opens after your inquiry is accepted and your conforme is signed."
      footer={
        <>
          <p>Approved clients only. Access requires a signed conforme.</p>
          <p>Contact PMCM for account issues or access requests.</p>
          <PrismWrongPortalLinks links={otherPortals} />
        </>
      }
    >
      {vm.signedInUser ? (
        <div className="flex flex-col gap-4">
          <div className="border-l-2 border-primary py-1 pl-4">
            <p className="text-sm font-semibold text-foreground">{vm.signedInUser.name}</p>
            <p className="text-sm text-muted-foreground">{vm.signedInUser.organization}</p>
          </div>
          <Button asChild className={prismAuthSubmitClassName("client")}>
            <a href="/dashboard">Continue to dashboard</a>
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <Field>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={vm.draft.email}
              onChange={(e) => vm.update("email", e.target.value)}
              placeholder="name@company.com"
              aria-invalid={vm.error ? true : undefined}
              aria-describedby={vm.error ? "sign-in-error" : undefined}
              className={`h-12 rounded-lg bg-card text-base ${PRISM_AUTH_INPUT_CLASS_NAME}`}
            />
          </Field>

          <Field>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={vm.showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={vm.draft.password}
                onChange={(e) => vm.update("password", e.target.value)}
                placeholder="Enter your password"
                aria-invalid={vm.error ? true : undefined}
                aria-describedby={vm.error ? "sign-in-error" : undefined}
                className={`h-12 rounded-lg bg-card pr-12 text-base ${PRISM_AUTH_INPUT_CLASS_NAME}`}
              />
              <button
                type="button"
                onClick={() => vm.setShowPassword((v) => !v)}
                className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label={vm.showPassword ? "Hide password" : "Show password"}
              >
                {vm.showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
            <a href="/password-reset" className="self-end text-sm text-primary transition-colors hover:text-primary/80">
              Forgot password?
            </a>
          </Field>

          {vm.error ? (
            <Alert variant="destructive" id="sign-in-error" role="alert">
              <AlertDescription>{vm.error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={vm.busy} className={prismAuthSubmitClassName("client")}>
            {vm.busy ? "Signing in..." : "Sign in"}
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
            <a href="/sign-up" className="text-primary transition-colors hover:text-primary/80">
              Need access? Request here
            </a>
            <a href="/inquiry" className="text-muted-foreground transition-colors hover:text-foreground">
              No inquiry yet?
            </a>
          </div>
        </form>
      )}
    </PrismAuthShell>
  );
}
