"use client";

import { useId, useState, type FormEvent } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { PrismOwnSignIn } from "@prism/types";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { formatPortalDateTime } from "./format-date";
import { cn } from "./utils";

/** A change the page sends to the API; resolves with the reason when it was refused, null when it went through. */
export type AccountChange<Input> = (input: Input) => Promise<string | null>;

/** Wraps an API call as an AccountChange: null once done (after `then`), otherwise the API's own reason. */
export function accountChange<Input>(call: (input: Input) => Promise<unknown>, then?: () => void | Promise<void>): AccountChange<Input> {
  return async (input) => {
    try {
      await call(input);
      await then?.();
      return null;
    } catch (cause) {
      return cause instanceof Error && cause.message ? cause.message : "That did not go through. Try again.";
    }
  };
}

function Field({ label, type = "text", value, onChange, autoComplete, hint }: { label: string; type?: string; value: string; onChange: (value: string) => void; autoComplete?: string; hint?: string }) {
  const id = useId();
  return (
    <div className="space-y-1 text-sm">
      <label htmlFor={id} className="block font-medium text-foreground">{label}</label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} maxLength={200} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function useSubmit<Input>(change: AccountChange<Input>, onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (input: Input) => {
    setBusy(true);
    setError(null);
    const refused = await change(input);
    setBusy(false);
    if (refused) setError(refused);
    else onDone();
  };
  return { busy, error, run };
}

/** Editing one's own name in place; the sidebar shows it after the next sign-in, since sessions carry the name. */
export function NameEditor({ name, save, onDone }: { name: string; save: AccountChange<{ name: string }>; onDone: () => void }) {
  const [value, setValue] = useState(name);
  const submit = useSubmit(save, onDone);
  const onSubmit = (event: FormEvent) => { event.preventDefault(); void submit.run({ name: value.trim() }); };
  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-2" aria-label="Edit your name">
      <Field label="Your name" value={value} onChange={setValue} autoComplete="name" hint="The menu shows your new name the next time you sign in." />
      {submit.error ? <p role="alert" className="text-sm text-danger">{submit.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submit.busy || value.trim().length < 2 || value.trim() === name}>{submit.busy ? "Saving…" : "Save"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

const MIN_PASSWORD = 12;

/** Why the new password cannot be sent yet, in words; null when it can. */
function passwordProblem(current: string, next: string, repeat: string): string | null {
  if (!current) return "Enter your current password.";
  if (next.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (next === current) return "Choose a password you are not using now.";
  if (next !== repeat) return "The two new passwords do not match.";
  return null;
}

/**
 * Changing the password while signed in. It ends every session, this one included, so the portal signs the person
 * out afterwards and they sign in with the new password.
 */
export function PasswordChanger({ change, onCancel }: { change: AccountChange<{ currentPassword: string; newPassword: string }>; onCancel: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const submit = useSubmit(change, () => undefined);
  const problem = passwordProblem(current, next, repeat);
  const onSubmit = (event: FormEvent) => { event.preventDefault(); if (!problem) void submit.run({ currentPassword: current, newPassword: next }); };
  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-border pt-3" aria-label="Change your password">
      <Field label="Current password" type="password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <Field label="New password" type="password" value={next} onChange={setNext} autoComplete="new-password" hint={`At least ${MIN_PASSWORD} characters.`} />
      <Field label="New password again" type="password" value={repeat} onChange={setRepeat} autoComplete="new-password" />
      {current && next && problem ? <p className="text-xs text-muted-foreground">{problem}</p> : null}
      {submit.error ? <p role="alert" className="text-sm text-danger">{submit.error}</p> : null}
      <p className="text-xs text-muted-foreground">This signs you out everywhere, including here. Sign in again with your new password.</p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submit.busy || problem !== null}>{submit.busy ? "Changing…" : "Change password"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

/** The person's own latest sign-ins, so they can spot one that was not them. */
export function SignInList({ signIns }: { signIns: PrismOwnSignIn[] }) {
  if (signIns.length === 0) return <p className="text-sm text-muted-foreground">No sign-ins recorded yet.</p>;
  return (
    <ul className="divide-y divide-border text-sm">
      {signIns.map((signIn) => {
        const Icon = signIn.succeeded ? CheckCircle2 : XCircle;
        return (
          <li key={signIn.id} className="flex items-center gap-3 py-2">
            <Icon aria-hidden className={cn("size-4 shrink-0", signIn.succeeded ? "text-success" : "text-danger")} />
            <span className="min-w-0 flex-1 truncate text-foreground">{signIn.device}</span>
            <span className={cn("shrink-0 text-xs", signIn.succeeded ? "text-muted-foreground" : "font-medium text-danger")}>{signIn.succeeded ? "" : "Failed · "}{formatPortalDateTime(signIn.at)}</span>
          </li>
        );
      })}
    </ul>
  );
}
