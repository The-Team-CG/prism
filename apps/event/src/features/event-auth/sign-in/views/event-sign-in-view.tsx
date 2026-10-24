"use client";

import { portalHref } from "@prism/ui/portal-path";
import { PRISM_AUTH_INPUT_CLASS_NAME, PrismAuthShell, PrismWrongPortalLinks, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Field } from "@/app/components/ui/field";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { EVENT_PORTAL_POINTS, EVENT_PORTAL_STATEMENT } from "../model/event-portal-copy";
import { signInSubmitLabel, twoFactorCopy } from "../model/event-sign-in-copy";
import { eventSignInProgress } from "../model/event-sign-in-steps";
import { portalUrlsFromEnvironment, wrongPortalLinks } from "../model/wrong-portal-links";
import { useEventSignInViewModel } from "../view-models/use-event-sign-in-view-model";

const COPY_FAILED_MESSAGE = "Couldn't copy. Select the key and copy it.";

function SetupSecretBox({ secret, otpauthUri }: { secret: string; otpauthUri: string | null }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-muted p-4">
      {otpauthUri ? (
        <div className="flex flex-col items-start gap-3">
          <div role="img" aria-label="QR code for your authenticator app" className="rounded-md bg-white p-2">
            <QRCodeSVG value={otpauthUri} size={168} />
          </div>
          <a href={otpauthUri} className="text-sm text-primary transition-colors hover:text-primary/80">
            Open in authenticator app
          </a>
        </div>
      ) : null}
      <div>
        <p className="text-sm text-muted-foreground">Or enter this setup key</p>
        <div className="mt-2 flex items-center gap-3">
          <code className="min-w-0 flex-1 break-all font-mono text-sm text-foreground">{secret}</code>
          <Button type="button" variant="outline" size="sm" onClick={copySecret} className="shrink-0">
            {copyState === "copied" ? "Copied" : "Copy"}
          </Button>
        </div>
        {copyState === "failed" ? (
          <p role="status" className="mt-2 text-sm text-destructive">
            {COPY_FAILED_MESSAGE}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function EventSignInView() {
  const vm = useEventSignInViewModel();
  const passwordPhase = vm.phase === "password";
  const copy = twoFactorCopy(vm.phase);
  const otherPortals = wrongPortalLinks("event", portalUrlsFromEnvironment());

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
      steps={eventSignInProgress(vm.phase)}
      title="Sign in to the event command portal"
      description={passwordPhase ? undefined : copy.detail}
      footer={
        <>
          <p>Authorized PMCM team access only.</p>
          <p>Admin and coordinator accounts only. Other roles have separate portals.</p>
          <PrismWrongPortalLinks links={otherPortals} />
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
                required={passwordPhase}
                value={vm.password}
                onChange={(e) => vm.setPassword(e.target.value)}
                placeholder="Enter your password"
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
            <a href={portalHref("/password-reset")} className="self-end text-sm text-primary transition-colors hover:text-primary/80">
              Forgot password?
            </a>
          </Field>
        </div>

        {passwordPhase ? null : (
          <div className="flex flex-col gap-5">
            <p className="text-base font-semibold text-foreground">{copy.title}</p>
            {vm.setupSecret ? <SetupSecretBox secret={vm.setupSecret} otpauthUri={vm.otpauthUri} /> : null}
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
                className={`h-12 rounded-lg bg-card text-base tracking-[0.3em] ${PRISM_AUTH_INPUT_CLASS_NAME}`}
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

        {passwordPhase ? null : (
          <Button type="button" variant="ghost" onClick={vm.startOver} className="self-start px-0 text-primary">
            Start over
          </Button>
        )}
      </form>
    </PrismAuthShell>
  );
}
