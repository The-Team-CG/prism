"use client";

import { portalHref } from "@prism/ui/portal-path";
import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Field } from "@/app/components/ui/field";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { EVENT_PORTAL_POINTS, EVENT_PORTAL_STATEMENT } from "../model/event-portal-copy";
import { signInSubmitLabel, twoFactorCopy } from "../model/event-sign-in-copy";
import { useEventSignInViewModel } from "../view-models/use-event-sign-in-view-model";

const COPY_UNAVAILABLE_MESSAGE = "Copy is not available here. Select the key and copy it manually.";

function SetupSecretBox({ secret }: { secret: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "unavailable">("idle");

  async function copySecret() {
    if (!navigator.clipboard?.writeText) {
      setCopyState("unavailable");
      return;
    }
    try {
      await navigator.clipboard.writeText(secret);
      setCopyState("copied");
    } catch {
      setCopyState("unavailable");
    }
  }

  return (
    <div className="rounded-lg bg-muted p-4">
      <p className="text-sm text-muted-foreground">Setup key</p>
      <div className="mt-2 flex items-center gap-3">
        <code className="min-w-0 flex-1 break-all font-mono text-sm text-foreground">{secret}</code>
        <Button type="button" variant="outline" size="sm" onClick={copySecret} className="shrink-0">
          {copyState === "copied" ? "Copied" : "Copy"}
        </Button>
      </div>
      {copyState === "unavailable" ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {COPY_UNAVAILABLE_MESSAGE}
        </p>
      ) : null}
    </div>
  );
}

export function EventSignInView() {
  const vm = useEventSignInViewModel();
  const passwordPhase = vm.phase === "password";
  const copy = twoFactorCopy(vm.phase);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.submit();
  }

  return (
    <PrismAuthShell
      portal="event"
      portalName="Event Command Portal"
      statement={EVENT_PORTAL_STATEMENT}
      points={EVENT_PORTAL_POINTS}
      homeHref={portalHref("/")}
      title="Sign in to the event command portal"
      description={passwordPhase ? undefined : copy.detail}
      footer={
        <>
          <p>Authorized PMCM team access only.</p>
          <p>Admin and coordinator accounts only. Other roles have separate portals.</p>
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        <div hidden={!passwordPhase} className="flex flex-col gap-5">
          <Field>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required={passwordPhase}
              value={vm.email}
              onChange={(e) => vm.setEmail(e.target.value)}
              placeholder="name@company.com"
              className="h-12 rounded-lg bg-card text-base"
            />
          </Field>

          <Field>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={vm.showPassword ? "text" : "password"}
                autoComplete="current-password"
                required={passwordPhase}
                value={vm.password}
                onChange={(e) => vm.setPassword(e.target.value)}
                placeholder="Enter your password"
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
            <a href={portalHref("/password-reset")} className="self-end text-sm text-primary transition-colors hover:text-primary/80">
              Forgot password?
            </a>
          </Field>
        </div>

        {passwordPhase ? null : (
          <div className="flex flex-col gap-5">
            <p className="text-base font-semibold text-foreground">{copy.title}</p>
            {vm.setupSecret ? <SetupSecretBox secret={vm.setupSecret} /> : null}
            <Field>
              <Label htmlFor="two-factor-code">Authenticator code</Label>
              <Input
                id="two-factor-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={vm.code}
                onChange={(e) => vm.setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="h-12 rounded-lg bg-card text-base tracking-[0.3em]"
              />
            </Field>
          </div>
        )}

        {vm.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{vm.error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" disabled={vm.busy} className={prismAuthSubmitClassName("event")}>
          {signInSubmitLabel(vm.busy, vm.phase)}
        </Button>
      </form>
    </PrismAuthShell>
  );
}
