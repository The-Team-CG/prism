"use client";

import type { FormEvent } from "react";
import { useGuestQrCheckInViewModel } from "../view-models/use-guest-qr-check-in-view-model";

const PRIVACY_NOTICE =
  "Your event team uses check-in and feedback details to support event access and review.";

export function GuestQrCheckInView() {
  const vm = useGuestQrCheckInViewModel();
  const { state } = vm;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.submit();
  }

  return (
    <main className="min-h-screen bg-(--prism-page) px-5 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl items-center">
        <section aria-labelledby="guest-qr-title" className="w-full rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="h-1 w-24 rounded-sm bg-(--prism-signal)" />
          <h1 id="guest-qr-title" className="mt-5 text-3xl font-black leading-tight">
            Guest check-in
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Review the event and privacy notice before confirming your attendance.
          </p>

          {state.status === "loading" ? (
            <p className="mt-6 rounded-md bg-secondary p-4 text-sm" role="status" aria-live="polite">
              Loading event details…
            </p>
          ) : null}

          {state.event ? (
            <section aria-labelledby="guest-qr-event-title" className="mt-6 rounded-md border border-border bg-secondary/50 p-4">
              <h2 id="guest-qr-event-title" className="text-xl font-bold">{state.event.eventName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {state.event.clientName} · {state.event.eventDate}
              </p>
              <p className="mt-3 text-sm">
                Event code: <span className="font-semibold">{state.event.guestAccessCode}</span>
              </p>
            </section>
          ) : null}

          {state.message ? (
            <p
              className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6"
              role="alert"
              aria-live="assertive"
            >
              {state.message}
            </p>
          ) : null}

          {state.status === "success" ? (
            <p className="mt-5 rounded-md border border-primary/25 bg-primary/5 p-4 text-sm leading-6" role="status" aria-live="polite">
              Check-in complete. Please follow any instructions from the event team.
            </p>
          ) : null}

          {state.status === "submitting" ? (
            <p className="mt-5 text-sm text-muted-foreground" role="status" aria-live="polite">
              Confirming your check-in…
            </p>
          ) : null}

          {state.status !== "success" && state.secure && state.hasPass ? (
            <form onSubmit={onSubmit} className="mt-6 grid gap-5">
              <section id="privacy-notice" aria-labelledby="guest-qr-privacy-title" className="rounded-md bg-secondary/50 p-4">
                <h2 id="guest-qr-privacy-title" className="font-bold">Privacy notice</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{PRIVACY_NOTICE}</p>
              </section>

              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  checked={vm.consentAccepted}
                  onChange={(event) => vm.setConsentAccepted(event.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <span>
                  I consent to PMCM recording the name linked to this QR pass, check-in mode,
                  attendance time, and this privacy notice version for event registration.
                </span>
              </label>

              <button
                type="submit"
                disabled={!vm.canSubmit}
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-5 py-3 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state.status === "submitting" ? "Confirming…" : state.status === "retryable" ? "Retry check-in" : "Confirm check-in"}
              </button>
            </form>
          ) : null}

          {state.status === "insecure" ? (
            <p className="mt-5 rounded-md bg-secondary p-4 text-sm leading-6">
              Open this invitation over HTTPS to use QR check-in. You can also enter the event code
              below or ask the registration desk for help.
            </p>
          ) : null}

          {state.status !== "success" ? (
            <div className="mt-6 border-t border-border pt-5 text-sm leading-6 text-muted-foreground">
              <a href="/open" className="font-semibold text-primary underline-offset-4 hover:underline">
                Enter an event code instead
              </a>
              <p className="mt-2">You can also check in with the registration desk.</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
