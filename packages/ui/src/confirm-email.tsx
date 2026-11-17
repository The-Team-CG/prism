"use client";

import { useEffect, useRef, useState } from "react";
import type { PrismEmailChangeConfirmed } from "@prism/types";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Button } from "./components/ui/button";

export type EmailConfirmationState =
  | { status: "checking" }
  | { status: "done"; email: string }
  | { status: "failed"; message: string };

const MISSING_TOKEN = "This link is incomplete. Open the link from the email again, or ask for a new one from your account page.";

/**
 * Opens the link from a change-of-email message once, as the page loads. On success every session has ended, so the
 * portal clears the one it keeps (\`onConfirmed\`) and the person signs in with the new address.
 */
export function useEmailConfirmation(confirm: (token: string) => Promise<PrismEmailChangeConfirmed>, onConfirmed?: () => void) {
  const [state, setState] = useState<EmailConfirmationState>({ status: "checking" });
  const started = useRef(false);
  useEffect(() => {
    // The token is used once, so a second effect run (React's development double-run) must not send it again.
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState({ status: "failed", message: MISSING_TOKEN });
      return;
    }
    confirm(token).then(
      (result) => {
        onConfirmed?.();
        setState({ status: "done", email: result.email });
      },
      (cause: unknown) => setState({ status: "failed", message: cause instanceof Error && cause.message ? cause.message : "That did not go through. Try the link again." }),
    );
  }, [confirm, onConfirmed]);
  return state;
}

/** What the confirmation page shows under its heading, with the way on to sign in. */
export function EmailConfirmationResult({ state, signInHref, submitClassName }: { state: EmailConfirmationState; signInHref: string; submitClassName?: string }) {
  if (state.status === "checking") return <p role="status" className="text-sm text-muted-foreground">Confirming your new email…</p>;
  if (state.status === "failed") {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive" role="alert"><AlertDescription>{state.message}</AlertDescription></Alert>
        <Button asChild variant="outline"><a href={signInHref}>Go to sign in</a></Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-sm text-foreground">
        Your sign-in email is now <span className="font-semibold break-all">{state.email}</span>. You were signed out everywhere, so sign in again with it.
      </p>
      <Button asChild className={submitClassName}><a href={signInHref}>Sign in</a></Button>
    </div>
  );
}

/** The title the confirmation page heads with, for each state. */
export function emailConfirmationTitle(state: EmailConfirmationState) {
  if (state.status === "done") return "Email changed";
  if (state.status === "failed") return "This link did not work";
  return "Confirming your email";
}
