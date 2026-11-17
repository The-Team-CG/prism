"use client";

import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { EmailConfirmationResult, emailConfirmationTitle, useEmailConfirmation } from "@prism/ui/confirm-email";
import { portalHref } from "@prism/ui/portal-path";
import { EVENT_PORTAL_POINTS as POINTS, EVENT_PORTAL_STATEMENT as STATEMENT } from "../../sign-in/model/event-portal-copy";
import { confirmEventEmailChange, forgetEventSession } from "../data/confirm-email-repository";

/** Where the link in a change-of-email message lands: it confirms once, then sends the person to sign in. */
export function EventConfirmEmailView() {
  const state = useEmailConfirmation(confirmEventEmailChange, forgetEventSession);
  return (
    <PrismAuthShell
      portal="event"
      portalName="Event Command Portal"
      statement={STATEMENT}
      points={POINTS}
      homeHref={portalHref("/")}
      title={emailConfirmationTitle(state)}
    >
      <EmailConfirmationResult state={state} signInHref={portalHref("/sign-in")} submitClassName={prismAuthSubmitClassName("event")} />
    </PrismAuthShell>
  );
}
