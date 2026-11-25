"use client";

import { FormEvent } from "react";
import { ArrowRight, ChevronRight, QrCode, TicketCheck } from "lucide-react";
import { portalHref } from "@prism/ui/portal-path";
import { PrismGuestShell } from "@prism/ui";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { Label } from "@prism/ui/components/label";
import { useGuestAccessOpenViewModel } from "../view-models/use-guest-access-open-view-model";

type OpenVm = ReturnType<typeof useGuestAccessOpenViewModel>;

/** Shown while a scanned link opens the pass, so the guest sees the event is on its way instead of an empty form. */
function OpeningPass() {
  return (
    <section role="status" aria-live="polite" className="grid justify-items-center gap-3 rounded-2xl border border-border bg-card px-5 py-8 text-center">
      <span aria-hidden="true" className="size-7 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
      <p className="font-semibold text-foreground">Opening your pass…</p>
    </section>
  );
}

function OpenForm({ vm }: { vm: OpenVm }) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.submit();
  }
  return (
    <form className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5" onSubmit={onSubmit}>
      <div className="grid gap-1.5">
        <Label htmlFor="event-code">Event code</Label>
        <Input
          id="event-code"
          value={vm.draft.accessCode}
          onChange={(event) => vm.updateAccessCode(event.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="From your invitation"
          className="h-12 bg-background text-base uppercase placeholder:normal-case placeholder:text-muted-foreground"
        />
      </div>
      {vm.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{vm.error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={!vm.canSubmit} className="h-12 w-full text-base">
        {vm.busy ? "Opening…" : "Open my pass"} {vm.busy ? null : <ArrowRight className="size-4" aria-hidden="true" />}
      </Button>
    </form>
  );
}

/**
 * How a guest gets to their pass. Scanning the event's QR opens it with nothing to type; the event code is the
 * fallback, one field and one button. A pass already open on this phone is one tap away.
 */
export function GuestAccessOpenView() {
  const vm = useGuestAccessOpenViewModel();

  return (
    <PrismGuestShell
      eventName="Open your event pass"
      layout="narrow"
      lead={
        <div className="grid gap-1.5 pt-2 lg:gap-4 lg:pt-6">
          <h1 className="font-heading text-2xl font-semibold leading-tight text-foreground lg:text-4xl">Open your event pass</h1>
          <p className="text-sm leading-6 text-muted-foreground lg:text-base">Open the link or scan the QR on your invitation. You can also enter the event code below.</p>
        </div>
      }
    >
      <div className="grid gap-3">
        {vm.existing && !vm.autoOpening ? (
          <a href={portalHref("/dashboard")} className="flex min-h-16 items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <TicketCheck className="size-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink-foreground/70">Your open pass</span>
              <span className="block truncate font-semibold">{vm.existing.eventName}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-ink-foreground/70" aria-hidden="true" />
          </a>
        ) : null}
        {vm.autoOpening ? <OpeningPass /> : <OpenForm vm={vm} />}
        <p className="flex items-start gap-2 px-1 text-sm leading-5 text-muted-foreground">
          <QrCode className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>No QR or code? Ask the registration team at the entrance.</span>
        </p>
        <p className="px-1 text-xs leading-5 text-muted-foreground">
          The code opens only this event. Read the{" "}
          <a href={portalHref("/privacy")} className="font-semibold text-primary hover:text-primary/80">privacy notice</a>{" "}
          before you check in or leave feedback.
        </p>
      </div>
    </PrismGuestShell>
  );
}
