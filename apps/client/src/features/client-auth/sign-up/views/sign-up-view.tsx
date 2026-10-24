"use client";

import { FormEvent } from "react";
import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { Button } from "@/app/components/ui/button";
import { Field } from "@/app/components/ui/field";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { CLIENT_PORTAL_POINTS, CLIENT_PORTAL_STATEMENT } from "../../sign-in/model/client-portal-copy";
import { useSignUpViewModel } from "../view-models/use-sign-up-view-model";

export function SignUpView() {
  const vm = useSignUpViewModel();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    vm.submit();
  }

  return (
    <PrismAuthShell
      portal="client"
      portalName="Client portal"
      statement={CLIENT_PORTAL_STATEMENT}
      points={CLIENT_PORTAL_POINTS}
      homeHref="/"
      title="Request access to the client portal"
      description="Join your event workspace. PMCM reviews every request."
      footer={
        vm.sent ? null : (
          <>
            {vm.gatePoints.map((point) => (
              <p key={point.id}>
                <span className="font-semibold text-foreground">{point.label}.</span> {point.detail}
              </p>
            ))}
            <p>Approved clients only. Access requires a signed conforme.</p>
            <p>Contact PMCM for account issues or access requests.</p>
          </>
        )
      }
    >
      {vm.sent ? (
        <div className="flex flex-col gap-4">
          <p className="text-xl font-semibold text-foreground">Request sent</p>
          <p className="text-base leading-6 text-muted-foreground">
            PMCM has your details. You will be able to sign in after your inquiry is accepted and your conforme is signed.
          </p>
          <a href="/sign-in" className="self-start text-sm font-medium text-primary transition-colors hover:text-primary/80">
            Back to sign in
          </a>
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <Field>
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              autoComplete="name"
              value={vm.draft.fullName}
              onChange={(e) => vm.update("fullName", e.target.value)}
              placeholder="Client contact name"
              required
              className="h-12 rounded-lg bg-card text-base"
            />
          </Field>

          <Field>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={vm.draft.email}
              onChange={(e) => vm.update("email", e.target.value)}
              placeholder="you@organization.com"
              required
              className="h-12 rounded-lg bg-card text-base"
            />
          </Field>

          <Field>
            <Label htmlFor="organization">Organization</Label>
            <Input
              id="organization"
              autoComplete="organization"
              value={vm.draft.organization}
              onChange={(e) => vm.update("organization", e.target.value)}
              placeholder="Company name"
              required
              className="h-12 rounded-lg bg-card text-base"
            />
          </Field>

          <Field>
            <Label htmlFor="eventName">Event name</Label>
            <Input
              id="eventName"
              value={vm.draft.eventName}
              onChange={(e) => vm.update("eventName", e.target.value)}
              placeholder="Event title"
              required
              className="h-12 rounded-lg bg-card text-base"
            />
          </Field>

          <Field>
            <Label htmlFor="inquiryCode">
              Inquiry code <span className="font-normal text-muted-foreground">(if known)</span>
            </Label>
            <Input
              id="inquiryCode"
              value={vm.draft.inquiryCode}
              onChange={(e) => vm.update("inquiryCode", e.target.value)}
              placeholder="INQ-2026-..."
              className="h-12 rounded-lg bg-card text-base"
            />
          </Field>

          <Field>
            <Label htmlFor="message">Additional notes</Label>
            <Textarea
              id="message"
              value={vm.draft.message}
              onChange={(e) => vm.update("message", e.target.value)}
              placeholder="Anything PMCM should know before activation."
              rows={3}
              className="resize-none rounded-lg bg-card text-base"
            />
          </Field>

          <Button type="submit" className={prismAuthSubmitClassName("client")}>
            Send request
          </Button>

          <div className="text-sm">
            <a href="/sign-in" className="text-primary transition-colors hover:text-primary/80">
              Already requested? Sign in
            </a>
          </div>
        </form>
      )}
    </PrismAuthShell>
  );
}
