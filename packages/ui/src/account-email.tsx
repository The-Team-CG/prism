"use client";

import { useId, useState, type FormEvent } from "react";
import type { PrismPendingEmailChange } from "@prism/types";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import type { AccountChange } from "./account-security";
import { formatPortalDateTime } from "./format-date";

/** Changing the sign-in email from the account page; each portal wires its own API calls. */
export type AccountEmailActions = {
  /** Sends a link to the new address; null once sent, otherwise the API's reason. */
  request: AccountChange<{ newEmail: string; password: string }>;
  /** Withdraws the change still waiting for its link. */
  cancel: AccountChange<void>;
};

/** "ana@ayala.test · changing to ana@new.test", so the row says a change is waiting without opening it. */
export function emailValue(email: string, pending: PrismPendingEmailChange | null | undefined) {
  return pending ? `${email} · changing to ${pending.email}` : email;
}

function Field({ label, type, value, onChange, autoComplete }: { label: string; type: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  const id = useId();
  return (
    <div className="space-y-1 text-sm">
      <label htmlFor={id} className="block font-medium text-foreground">{label}</label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} maxLength={254} />
    </div>
  );
}

function RequestForm({ current, actions, onSent }: { current: string; actions: AccountEmailActions; onSent: (note: string) => void }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const refused = await actions.request({ newEmail: newEmail.trim(), password });
    setBusy(false);
    if (refused) return setProblem(refused);
    onSent(`We sent a link to ${newEmail.trim()}. Your email changes when you open it.`);
  };
  const same = newEmail.trim().toLowerCase() === current.toLowerCase();
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        We email a link to the new address. Your sign-in email changes when you open it, and then you sign in again
        everywhere. Your events, messages and notifications move with it.
      </p>
      <Field label="New email" type="email" value={newEmail} onChange={setNewEmail} autoComplete="email" />
      <Field label="Your password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      {same ? <p className="text-sm text-muted-foreground">That is already your sign-in email.</p> : null}
      {problem ? <p role="alert" className="text-sm text-danger">{problem}</p> : null}
      <Button type="submit" disabled={busy || !newEmail.trim() || !password || same}>{busy ? "Sending…" : "Send confirmation link"}</Button>
    </form>
  );
}

/** The email panel: who you sign in as, the change waiting for its link (with withdraw), or a form to start one. */
export function EmailPanel({ email, pending, actions, onDone }: {
  email: string;
  pending: PrismPendingEmailChange | null;
  actions: AccountEmailActions;
  onDone: (note: string) => void;
}) {
  const [replacing, setReplacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!pending || replacing) return <RequestForm current={email} actions={actions} onSent={onDone} />;
  const withdraw = async () => {
    setBusy(true);
    const refused = await actions.cancel(undefined);
    setBusy(false);
    if (refused) return setProblem(refused);
    onDone(`Email change withdrawn. You keep signing in with ${email}.`);
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground">
        We sent a link to <span className="font-semibold break-all">{pending.email}</span>. Open it to switch; until then you
        sign in with {email}. The link works until {formatPortalDateTime(pending.expiresAt)}.
      </p>
      <p className="text-xs text-muted-foreground">Not there? Check spam, or send it again, to the same or another address.</p>
      {problem ? <p role="alert" className="text-sm text-danger">{problem}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setReplacing(true)}>Send again</Button>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void withdraw()}>{busy ? "Withdrawing…" : "Withdraw"}</Button>
      </div>
    </div>
  );
}
