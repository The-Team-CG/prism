"use client";

import { useId, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { PrismOwnTwoFactorSetup } from "@prism/types";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { AuthenticatorCodeInput } from "./authenticator-code-input";
import type { AccountChange } from "./account-security";

/** Turning two-step sign-in on or off from the account page; each portal wires its own API calls. */
export type AccountTwoStepActions = {
  /** Checks the password and returns what the authenticator app needs, or the reason it was refused. */
  start: (password: string) => Promise<{ setup: PrismOwnTwoFactorSetup } | { error: string }>;
  /** Turns it on with a code from the app just added. */
  enable: AccountChange<string>;
  /** Turns it off with the password. Absent where it is required (PMCM staff). */
  disable?: AccountChange<string>;
  /** Makes a fresh set of one-time backup codes with the password; the old set stops working. */
  makeBackupCodes?: (password: string) => Promise<{ codes: string[] } | { error: string }>;
};

/** Wraps the API call that makes backup codes as the panel expects: the codes, or the API's own reason it was refused. */
export function twoStepBackupCodes(call: (password: string) => Promise<{ backupCodes: string[] }>): NonNullable<AccountTwoStepActions["makeBackupCodes"]> {
  return async (password) => {
    try {
      return { codes: (await call(password)).backupCodes };
    } catch (cause) {
      return { error: cause instanceof Error && cause.message ? cause.message : "That did not go through. Try again." };
    }
  };
}

/** Wraps the API call that starts setup as the panel expects: the setup, or the API's own reason it was refused. */
export function twoStepStart(call: (password: string) => Promise<PrismOwnTwoFactorSetup>): AccountTwoStepActions["start"] {
  return async (password) => {
    try {
      return { setup: await call(password) };
    } catch (cause) {
      return { error: cause instanceof Error && cause.message ? cause.message : "That did not go through. Try again." };
    }
  };
}

function PasswordField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="space-y-1 text-sm">
      <label htmlFor={id} className="block font-medium text-foreground">Your password</label>
      <Input id={id} type="password" autoComplete="current-password" value={value} onChange={(event) => onChange(event.target.value)} maxLength={200} />
    </div>
  );
}

function Problem({ text }: { text: string | null }) {
  return text ? <p role="alert" className="text-sm text-danger">{text}</p> : null;
}

/** Off: the password first, then the app scans a code and proves it works before two-step sign-in turns on. */
function TurnOn({ actions, onDone }: { actions: AccountTwoStepActions; onDone: (note: string) => void }) {
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<PrismOwnTwoFactorSetup | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const begin = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = await actions.start(password);
    setBusy(false);
    if ("error" in result) return setProblem(result.error);
    setProblem(null);
    setPassword("");
    setSetup(result.setup);
  };
  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const refused = await actions.enable(code);
    setBusy(false);
    if (refused) return setProblem(refused);
    onDone("Two-step sign-in is on. You enter a code from your app each time you sign in.");
  };

  if (!setup) {
    return (
      <form onSubmit={(event) => void begin(event)} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          After your password, you also enter a six-digit code from an authenticator app on your phone, such as Google
          Authenticator or Microsoft Authenticator. Someone who learns your password still cannot sign in.
        </p>
        <PasswordField value={password} onChange={setPassword} />
        <Problem text={problem} />
        <Button type="submit" disabled={busy || !password}>{busy ? "Checking…" : "Continue"}</Button>
      </form>
    );
  }
  return (
    <form onSubmit={(event) => void confirm(event)} className="space-y-4">
      <p className="text-sm text-foreground">1. In your authenticator app, add an account and scan this code.</p>
      <div role="img" aria-label="QR code for your authenticator app" className="w-fit rounded-md bg-white p-2">
        <QRCodeSVG value={setup.otpauthUri} size={168} />
      </div>
      <p className="text-xs text-muted-foreground">Can&apos;t scan? Enter this key instead: <code className="font-mono text-foreground">{setup.secret.match(/.{1,4}/g)?.join(" ") ?? setup.secret}</code></p>
      <p className="text-sm text-foreground">2. Enter the six-digit code the app shows.</p>
      <AuthenticatorCodeInput value={code} onChange={setCode} disabled={busy} invalid={Boolean(problem)} />
      <Problem text={problem} />
      <Button type="submit" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Turn on"}</Button>
    </form>
  );
}

function TurnOff({ disable, onDone }: { disable: AccountChange<string>; onDone: (note: string) => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const refused = await disable(password);
    setBusy(false);
    if (refused) return setProblem(refused);
    onDone("Two-step sign-in is off. You sign in with your password only.");
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <p className="text-sm text-muted-foreground">Two-step sign-in is on: each time you sign in, you also enter a code from your authenticator app. Turning it off means your password alone signs you in.</p>
      <PasswordField value={password} onChange={setPassword} />
      <Problem text={problem} />
      <Button type="submit" variant="outline" disabled={busy || !password}>{busy ? "Checking…" : "Turn off"}</Button>
    </form>
  );
}

/** One-time backup codes for a lost phone: made with the password and shown once. */
function BackupCodes({ make }: { make: NonNullable<AccountTwoStepActions["makeBackupCodes"]> }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = await make(password);
    setBusy(false);
    if ("error" in result) return setProblem(result.error);
    setProblem(null);
    setPassword("");
    setCodes(result.codes);
  };
  if (codes) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-foreground">Save these backup codes now; they are not shown again. Each signs you in once if you lose your phone.</p>
        <ul aria-label="Backup codes" className="grid w-fit grid-cols-2 gap-x-6 gap-y-1 rounded-md bg-muted p-3 font-mono text-sm">
          {codes.map((code) => <li key={code}>{code}</li>)}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={() => void navigator.clipboard?.writeText(codes.join("\n"))}>Copy codes</Button>
      </div>
    );
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-3">
      <p className="text-sm text-muted-foreground">Backup codes sign you in once each if you lose your phone. Making new ones ends the old set.</p>
      <PasswordField value={password} onChange={setPassword} />
      <Problem text={problem} />
      <Button type="submit" variant="outline" disabled={busy || !password}>{busy ? "Making…" : "Make new backup codes"}</Button>
    </form>
  );
}

/** The two-step sign-in panel: turn it on, turn it off, or, for PMCM staff, why it stays on; plus backup codes once on. */
export function TwoStepPanel({ enabled, required, actions, onDone }: {
  enabled: boolean;
  required: boolean;
  actions: AccountTwoStepActions;
  onDone: (note: string) => void;
}) {
  const backup = actions.makeBackupCodes && (enabled || required) ? <BackupCodes make={actions.makeBackupCodes} /> : null;
  if (required) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">PMCM staff always sign in with a code from their authenticator app. If you lose your phone, use a backup code, or another PMCM admin can reset it so you set it up again at your next sign-in.</p>
        {backup}
      </div>
    );
  }
  if (enabled) return <div className="space-y-6">{actions.disable ? <TurnOff disable={actions.disable} onDone={onDone} /> : null}{backup}</div>;
  return <TurnOn actions={actions} onDone={onDone} />;
}
