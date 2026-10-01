"use client";

import { FormEvent } from "react";
import { ArrowRight, KeyRound, QrCode, ShieldCheck, TicketCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { useGuestAccessOpenViewModel } from "../view-models/use-guest-access-open-view-model";

export function GuestAccessOpenView() {
  const vm = useGuestAccessOpenViewModel();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.submit();
  }

  return (
    <main className="min-h-screen bg-(--prism-page) px-5 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden bg-(--prism-ink) p-8 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-md bg-white text-sm font-black text-(--prism-ink)">
                  P
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-(--prism-signal)">
                    P.R.I.S.M
                  </p>
                  <p className="text-xs text-sidebar-foreground/60">Guest pass</p>
                </div>
              </div>
              <div className="mt-12 grid place-items-center rounded-lg border border-white/10 bg-white/6 p-12">
                <QrCode className="size-32 text-(--prism-amber)" />
              </div>
            </div>
            <p className="text-sm leading-6 text-sidebar-foreground/62">
              Enter the event code from your PMCM invitation. The pass opens only the guest-safe
              check-in, event details, and moderated feedback flow.
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-5 p-6 sm:p-8">
            <div className="h-1 w-24 rounded-sm bg-(--prism-signal)" />
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                <KeyRound className="size-5" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                  Guest access
                </p>
                <h1 className="mt-1 text-3xl font-black leading-tight">Open your event pass</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Preview the event first, then continue into the code-gated dashboard.
                </p>
              </div>
            </div>

            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                Guest name
              </span>
              <Input
                value={vm.draft.guestName}
                onChange={(event) => vm.updateGuestName(event.target.value)}
                autoComplete="name"
                className="h-12 bg-white"
                placeholder="Name at registration"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                Event code
              </span>
              <Input
                value={vm.draft.accessCode}
                onChange={(event) => vm.updateAccessCode(event.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                className="h-14 bg-white font-mono text-lg font-black uppercase tracking-[0.18em]"
                placeholder="PMCM EVENT CODE"
              />
            </label>

            {vm.preview ? (
              <section className="rounded-lg border border-primary/15 bg-secondary/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                      Event preview
                    </p>
                    <h2 className="mt-1 text-xl font-black">{vm.preview.eventName}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {vm.preview.clientName} - {vm.preview.eventDate}
                    </p>
                  </div>
                  <span className="rounded-md border border-(--prism-amber)/25 bg-(--prism-amber)/10 px-2 py-1 text-xs font-bold text-(--prism-amber)">
                    {vm.preview.readiness.replaceAll("_", " ")}
                  </span>
                </div>
              </section>
            ) : null}

            {vm.error && (
              <Alert variant="destructive" className="rounded-md">
                <AlertDescription>{vm.error}</AlertDescription>
              </Alert>
            )}

            <Button disabled={!vm.canSubmit} className="h-12 w-full rounded-md font-black">
              {vm.busy ? "Opening" : vm.preview ? "Continue" : "Preview event"}{" "}
              <ArrowRight className="size-4" />
            </Button>

            {vm.existing && (
              <a
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-secondary text-sm font-black text-foreground"
              >
                <TicketCheck className="size-4" /> Continue to {vm.existing.eventName}
              </a>
            )}

            <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/50 p-3 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                Code access opens only this guest event. Read the{" "}
                <a
                  href="#privacy-notice"
                  className="font-black text-primary underline underline-offset-2"
                >
                  privacy notice
                </a>{" "}
                before check-in or feedback consent.
              </span>
            </div>

            <p
              id="privacy-notice"
              className="flex items-center gap-2 text-xs leading-5 text-muted-foreground"
            >
              Your event team uses check-in and feedback details to support event access and review.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
