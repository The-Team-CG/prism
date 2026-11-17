"use client";

import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { EmailConfirmationResult, emailConfirmationTitle, useEmailConfirmation } from "@prism/ui/confirm-email";
import { portalHref } from "@prism/ui/portal-path";
import { SUPPLIER_PORTAL_POINTS as POINTS, SUPPLIER_PORTAL_STATEMENT as STATEMENT } from "../../sign-in/model/supplier-portal-copy";
import { confirmSupplierEmailChange, forgetSupplierSession } from "../data/confirm-email-repository";

/** Where the link in a change-of-email message lands: it confirms once, then sends the person to sign in. */
export function SupplierConfirmEmailView() {
  const state = useEmailConfirmation(confirmSupplierEmailChange, forgetSupplierSession);
  return (
    <PrismAuthShell
      portal="supplier"
      portalName="Supplier portal"
      statement={STATEMENT}
      points={POINTS}
      homeHref={portalHref("/")}
      title={emailConfirmationTitle(state)}
    >
      <EmailConfirmationResult state={state} signInHref={portalHref("/sign-in")} submitClassName={prismAuthSubmitClassName("supplier")} />
    </PrismAuthShell>
  );
}
