"use client";

import { portalHref } from "@prism/ui/portal-path";
import { PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { FormEvent } from "react";
import { ArrowRight, TicketCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Field } from "@/app/components/ui/field";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useGuestAccessOpenViewModel } from "../view-models/use-guest-access-open-view-model";

const GUEST_POINTS = [
  "Preview the event before you check in",
  "Check in by name or as an anonymous headcount",
  "Leave feedback through the moderated flow",
] as const;

export function GuestAccessOpenView() {
  const vm = useGuestAccessOpenViewModel();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.submit();
  }

  return (
    <PrismAuthShell
      portal="guest"
      portalName="Guest pass"
      statement="Your event pass"
      points={GUEST_POINTS}
      title="Enter your event code"
      description="Use the event code from your PMCM invitation."
      footer={
        <>
          <p id="privacy-notice">
            Code access opens only this guest event. Your event team uses check-in and feedback details to support
            event access and review.
          </p>
          <p>
            Read the{" "}
            <a href="#privacy-notice" className="font-semibold text-primary transition-colors hover:text-primary/80">
              privacy notice
            </a>{" "}
            before check-in or feedback consent.
          </p>
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        <Field>
          <Label htmlFor="event-code">Event code</Label>
          <Input
            id="event-code"
            value={vm.draft.accessCode}
            onChange={(event) => vm.updateAccessCode(event.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="PMCM EVENT CODE"
            className="h-12 rounded-lg bg-card text-2xl font-semibold uppercase tracking-[0.18em]"
          />
        </Field>

        {vm.preview ? (
          <section className="border-l-2 border-primary py-1 pl-4">
            <p className="text-sm text-muted-foreground">Event preview</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-foreground">{vm.preview.eventName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {vm.preview.clientName} - {vm.preview.eventDate}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{vm.preview.readiness.replaceAll("_", " ")}</p>
          </section>
        ) : null}

        {vm.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{vm.error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" disabled={!vm.canSubmit} className={prismAuthSubmitClassName("guest")}>
          {vm.busy ? "Opening" : vm.preview ? "Continue" : "Preview event"} <ArrowRight className="size-4" />
        </Button>

        {vm.existing ? (
          <a
            href={portalHref("/dashboard")}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            <TicketCheck className="size-4" /> Continue to {vm.existing.eventName}
          </a>
        ) : null}
      </form>
    </PrismAuthShell>
  );
}
