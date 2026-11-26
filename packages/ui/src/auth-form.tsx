"use client";

import { Eye, EyeOff } from "lucide-react";
import type { ReactNode } from "react";
import { PRISM_AUTH_INPUT_CLASS_NAME, prismAuthSubmitClassName, type PrismAuthPortal } from "./auth-shell";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { Field } from "./components/ui/field";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";

/**
 * The pieces every portal's sign-in is built from, so the client, supplier and PMCM portals look and read the same.
 * Portals keep their own view-models (which roles they accept, where they store the session); these only render.
 */

const INPUT = `h-12 rounded-lg bg-card text-base ${PRISM_AUTH_INPUT_CLASS_NAME}`;

export function PrismAuthEmailField({ value, onChange, placeholder = "name@company.com", errorId, required = true, autoFocus }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Set when an error is showing, so the field points at it. */
  errorId?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <Field>
      <Label htmlFor="email">Email address</Label>
      <Input
        id="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        required={required}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        className={INPUT}
      />
    </Field>
  );
}

export function PrismAuthPasswordField({ value, onChange, shown, onToggleShown, forgotHref, errorId, required = true, label = "Password", autoComplete = "current-password", id = "password" }: {
  value: string;
  onChange: (value: string) => void;
  shown: boolean;
  onToggleShown: () => void;
  /** Where "Forgot password?" goes; left out, the link is not shown. */
  forgotHref?: string;
  errorId?: string;
  required?: boolean;
  label?: string;
  autoComplete?: "current-password" | "new-password";
  id?: string;
}) {
  return (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={autoComplete === "new-password" ? "At least 12 characters" : "Enter your password"}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={errorId}
          className={`${INPUT} pr-12`}
        />
        <button
          type="button"
          onClick={onToggleShown}
          className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label={shown ? "Hide password" : "Show password"}
        >
          {shown ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
      {forgotHref ? (
        <a href={forgotHref} className="self-end text-sm text-primary transition-colors hover:text-primary/80">
          Forgot password?
        </a>
      ) : null}
    </Field>
  );
}

/** The sign-in error, announced to screen readers, with the id the fields point at. */
export function PrismAuthError({ id, message }: { id: string; message: string | null | undefined }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" id={id} role="alert">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function PrismAuthSubmit({ portal, busy, disabled, label, busyLabel }: {
  portal: PrismAuthPortal;
  busy: boolean;
  disabled?: boolean;
  label: string;
  busyLabel: string;
}) {
  return (
    <Button type="submit" disabled={busy || disabled} className={prismAuthSubmitClassName(portal)}>
      {busy ? busyLabel : label}
    </Button>
  );
}

/** A secondary way to sign in, shown under the main button with an "or" rule. */
export function PrismAuthAlternative({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      {children}
    </div>
  );
}

/** The links under a sign-in form: the portal's way in for people without an account, and a way out. */
export function PrismAuthLinks({ primary, secondary }: { primary?: { href: string; label: string }; secondary?: { href: string; label: string } }) {
  if (!primary && !secondary) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
      {primary ? <a href={primary.href} className="text-primary transition-colors hover:text-primary/80">{primary.label}</a> : <span />}
      {secondary ? <a href={secondary.href} className="text-muted-foreground transition-colors hover:text-foreground">{secondary.label}</a> : null}
    </div>
  );
}
