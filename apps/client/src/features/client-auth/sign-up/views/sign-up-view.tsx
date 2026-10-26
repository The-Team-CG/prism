"use client";

import { PrismAuthShell } from "@prism/ui/auth-shell";
import { portalHref } from "@prism/ui/portal-path";
import { Button } from "@/app/components/ui/button";
import { CLIENT_PORTAL_POINTS, CLIENT_PORTAL_STATEMENT } from "../../sign-in/model/client-portal-copy";

export function SignUpView() {
  return (
    <PrismAuthShell
      portal="client"
      portalName="Client portal"
      statement={CLIENT_PORTAL_STATEMENT}
      points={CLIENT_PORTAL_POINTS}
      homeHref="/"
      title="Client accounts come from PMCM"
      description="When PMCM accepts your inquiry, it creates your client account and emails you a link to set your password. You then review and sign the conforme in the portal."
    >
      <div className="flex flex-col gap-6">
        <Button asChild className="h-12 w-full rounded-lg text-base font-semibold shadow-none hover:shadow-none sm:text-sm">
          <a href={portalHref("/inquiry")}>Start an inquiry</a>
        </Button>
        <p className="text-sm leading-6 text-muted-foreground">
          Already invited? Use the link in your PMCM email to set your password.{" "}
          <a href={portalHref("/sign-in")} className="text-primary transition-colors hover:text-primary/80">
            Sign in
          </a>
        </p>
      </div>
    </PrismAuthShell>
  );
}
