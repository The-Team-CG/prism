"use client";

import { AuthenticatorCodeInput } from "./authenticator-code-input";

/**
 * What to tell someone whose code was refused, and whether they must start over: a challenge lasts ten minutes and
 * is used once, so an expired or used one needs the password again.
 */
export function signInCodeProblem(message: string): { text: string; restart: boolean } {
  if (/invalid two-factor code/i.test(message)) return { text: "That code is not right. Enter the newest code from your app.", restart: false };
  if (/expired|already|no longer|sign in again/i.test(message)) return { text: "That took too long. Enter your email and password again.", restart: true };
  return { text: message, restart: false };
}

/**
 * The second step of signing in for someone who turned two-step sign-in on: the code from their authenticator app.
 * The portal's form owns the submit button and the error message, so the step reads like the rest of its sign-in.
 */
export function SignInCodeStep({ code, onCodeChange, busy, invalid, errorId, onBack }: {
  code: string;
  onCodeChange: (code: string) => void;
  busy: boolean;
  invalid: boolean;
  errorId: string;
  /** Back to email and password, for a different account. */
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">Enter the code from your authenticator app</p>
        <p className="text-sm text-muted-foreground">Two-step sign-in is on for this account. Open your authenticator app and enter the six-digit code for PRISM.</p>
      </div>
      <AuthenticatorCodeInput value={code} onChange={onCodeChange} disabled={busy} invalid={invalid} errorId={errorId} />
      <p className="text-sm text-muted-foreground">
        Lost your phone? Message PMCM and they can turn two-step sign-in off for you.{" "}
        <button type="button" onClick={onBack} className="text-primary hover:text-primary/80">Use a different account</button>
      </p>
    </div>
  );
}
