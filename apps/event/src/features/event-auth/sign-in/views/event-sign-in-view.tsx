"use client";

import { PrismAccountHelp } from "@prism/ui/account-help";
import { portalHref } from "@prism/ui/portal-path";
import { PRISM_AUTH_INPUT_CLASS_NAME, PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
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
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";
import { useEventSignInViewModel } from "../view-models/use-event-sign-in-view-model";
import { AuthenticatorCodeInput } from "./authenticator-code-input";

const COPY_FAILED_MESSAGE = "Couldn't copy. Select the key and copy it.";

function AuthenticatorQrCode({ otpauthUri }: { otpauthUri: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <div role="img" aria-label="QR code for your authenticator app" className="rounded-md bg-white p-2">
        <QRCodeSVG value={otpauthUri} size={168} />
      </div>
      <a href={otpauthUri} className="text-sm text-primary transition-colors hover:text-primary/80">
        Open in authenticator app
      </a>
    </div>
  );
}

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
        <AuthenticatorQrCode otpauthUri={otpauthUri} />
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

type SignInVm = ReturnType<typeof useEventSignInViewModel>;

function PasswordFields({ vm, active }: { vm: SignInVm; active: boolean }) {
  return (
    <div hidden={!active} className="flex flex-col gap-5">
      <Field>
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          required={active}
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
            required={active}
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
  );
}

function TwoFactorStep({ vm, title }: { vm: SignInVm; title: string }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-base font-semibold text-foreground">{title}</p>
      {vm.setupSecret ? <SetupSecretBox secret={vm.setupSecret} otpauthUri={vm.otpauthUri} /> : null}
      {process.env.NODE_ENV === "development" && vm.phase === "verify" ? (
        <div className="flex flex-col items-start gap-3">
          <Button type="button" variant="outline" onClick={() => void vm.toggleDevelopmentQr()} disabled={vm.busy} aria-expanded={Boolean(vm.otpauthUri)} aria-controls="development-authenticator-qr">
            {vm.otpauthUri ? "Hide authenticator QR" : "Show authenticator QR"}
          </Button>
          {vm.otpauthUri ? (
            <div id="development-authenticator-qr" className="rounded-lg bg-muted p-4">
              <AuthenticatorQrCode otpauthUri={vm.otpauthUri} />
            </div>
          ) : null}
        </div>
      ) : null}
      <Field>
        <Label htmlFor="two-factor-code" className="sr-only">Authenticator code</Label>
        <AuthenticatorCodeInput
          value={vm.code}
          onChange={vm.setCode}
          disabled={vm.busy}
          invalid={Boolean(vm.error)}
        />
      </Field>
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
      steps={eventSignInProgress(vm.phase)}
      title="Sign in to the event command portal"
      description={passwordPhase ? undefined : copy.detail}
      footer={
        <>
          <p>Authorized PMCM team access only.</p>
          <p>Admin and coordinator accounts only. Other roles have separate portals.</p>
          <PrismAccountHelp contact={pmcmSupportContactFromEnvironment()} topic="PMCM team access" />
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate={!passwordPhase}>
        <PasswordFields vm={vm} active={passwordPhase} />

        {passwordPhase ? null : <TwoFactorStep vm={vm} title={copy.title} />}

        {vm.error ? (
          <Alert id="event-sign-in-error" variant="destructive" role="alert">
            <AlertDescription>{vm.error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" disabled={vm.busy || (!passwordPhase && vm.code.length !== 6)} className={prismAuthSubmitClassName("event")}>
          {signInSubmitLabel(vm.busy, vm.phase)}
        </Button>
      </form>
    </PrismAuthShell>
  );
}
