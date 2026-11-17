"use client";

import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { EmailConfirmationResult, emailConfirmationTitle, useEmailConfirmation } from "@prism/ui/confirm-email";
import { CLIENT_PORTAL_POINTS as POINTS, CLIENT_PORTAL_STATEMENT as STATEMENT } from "../../sign-in/model/client-portal-copy";
import { confirmClientEmailChange, forgetClientSession } from "../data/confirm-email-repository";

/** Where the link in a change-of-email message lands: it confirms once, then sends the person to sign in. */
export function ClientConfirmEmailView() {
  const state = useEmailConfirmation(confirmClientEmailChange, forgetClientSession);
  return (
    <PrismAuthShell
      portal="client"
      portalName="Client portal"
      statement={STATEMENT}
      points={POINTS}
      homeHref={"/"}
      title={emailConfirmationTitle(state)}
    >
      <EmailConfirmationResult state={state} signInHref={"/sign-in"} submitClassName={prismAuthSubmitClassName("client")} />
    </PrismAuthShell>
  );
}
