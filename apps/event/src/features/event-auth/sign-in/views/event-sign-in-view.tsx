"use client";

import { PrismAccountHelp } from "@prism/ui/account-help";
import { portalHref } from "@prism/ui/portal-path";
import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { PrismAuthEmailField, PrismAuthError, PrismAuthPasswordField } from "@prism/ui/auth-form";
import { FormEvent, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@prism/ui/components/button";
import { Field } from "@prism/ui/components/field";
import { Label } from "@prism/ui/components/label";
import { Input } from "@prism/ui/components/input";
import { EVENT_PORTAL_POINTS, EVENT_PORTAL_STATEMENT } from "../model/event-portal-copy";
import { signInSubmitLabel, twoFactorCopy } from "../model/event-sign-in-copy";
import { eventSignInProgress } from "../model/event-sign-in-steps";
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";
import { useEventSignInViewModel } from "../view-models/use-event-sign-in-view-model";
import { AuthenticatorCodeInput } from "@prism/ui/authenticator-code-input";

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
  const errorId = vm.error ? "event-sign-in-error" : undefined;
  return (
    <div hidden={!active} className="flex flex-col gap-5">
      <PrismAuthEmailField value={vm.email} onChange={vm.setEmail} required={active} errorId={errorId} />
      <PrismAuthPasswordField
        value={vm.password}
        onChange={vm.setPassword}
        shown={vm.showPassword}
        onToggleShown={() => vm.setShowPassword(!vm.showPassword)}
        forgotHref={portalHref("/password-reset")}
        required={active}
        errorId={errorId}
      />
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
      {vm.usingBackupCode ? (
        <Field>
          <Label htmlFor="backup-code">Backup code</Label>
          <Input
            id="backup-code"
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            value={vm.code}
            onChange={(event) => vm.setCode(event.target.value)}
            placeholder="k7p2-9xqm"
            aria-invalid={vm.error ? true : undefined}
            aria-describedby={vm.error ? "event-sign-in-error" : undefined}
            className="h-12 rounded-lg bg-card font-mono text-base"
          />
        </Field>
      ) : (
        <Field>
          <Label htmlFor="two-factor-code" className="sr-only">Authenticator code</Label>
          <AuthenticatorCodeInput
            value={vm.code}
            onChange={vm.setCode}
            disabled={vm.busy}
            invalid={Boolean(vm.error)}
            errorId="event-sign-in-error"
          />
        </Field>
      )}
      {vm.phase === "verify" ? (
        <>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={vm.trustDevice} onChange={(event) => vm.setTrustDevice(event.target.checked)} className="size-4 accent-foreground" />
            Trust this device for 30 days
          </label>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
            <button type="button" onClick={vm.toggleBackupCode} className="font-medium text-foreground hover:text-primary">
              {vm.usingBackupCode ? "Use the authenticator app" : "Use a backup code"}
            </button>
            <span className="text-muted-foreground">Lost your phone and codes? Ask a PMCM admin.</span>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Shown once after a new authenticator: the backup codes, to copy or download before going on. */
function BackupCodesStep({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  function download() {
    const url = URL.createObjectURL(new Blob([`P.R.I.S.M backup codes\nEach code works once.\n\n${text}\n`], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "prism-backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="flex flex-col gap-4">
      <ul aria-label="Backup codes" className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4 font-mono text-sm text-foreground">
        {codes.map((code) => <li key={code}>{code}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true), () => setCopied(false))}>
          {copied ? "Copied" : "Copy codes"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>Download</Button>
      </div>
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

        {passwordPhase ? null : vm.phase === "backup-codes" && vm.backupCodes ? (
          <div className="flex flex-col gap-4">
            <p className="text-base font-semibold text-foreground">{copy.title}</p>
            <BackupCodesStep codes={vm.backupCodes} />
          </div>
        ) : <TwoFactorStep vm={vm} title={copy.title} />}

        <PrismAuthError id="event-sign-in-error" message={vm.error} />

        <Button type="submit" disabled={vm.busy || (!passwordPhase && vm.phase !== "backup-codes" && (vm.usingBackupCode ? vm.code.trim().length < 8 : vm.code.length !== 6))} className={prismAuthSubmitClassName("event")}>
          {signInSubmitLabel(vm.busy, vm.phase)}
        </Button>
      </form>
    </PrismAuthShell>
  );
}
