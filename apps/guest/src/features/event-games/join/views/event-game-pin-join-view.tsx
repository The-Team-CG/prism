"use client";

import type { FormEvent } from "react";
import { ArrowRight, LogOut } from "lucide-react";
import { portalHref } from "@prism/ui/portal-path";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { Button } from "@prism/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@prism/ui/components/field";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@prism/ui/components/input-otp";
import { GameIdentityHelp } from "../../lobby/views/event-game-lobby-view";
import { useEventGamePinJoinViewModel } from "../view-models/use-event-game-pin-join-view-model";

export function EventGamePinJoinView({ expectedEventSlug }: { expectedEventSlug?: string }) {
  const vm = useEventGamePinJoinViewModel(expectedEventSlug);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.submit();
  }

  return (
    <main className="min-h-screen bg-page px-5 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center">
        <section className="w-full rounded-lg border border-border bg-card p-6 sm:p-9">
          <div>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Join the host&apos;s game</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Enter the six-digit PIN on the host&apos;s screen. No account needed.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
            <Field>
              <FieldLabel htmlFor="game-pin">Game PIN</FieldLabel>
              {/* One slot per digit: the PIN reads as empty until it is typed, and the numeric keypad opens on phones. */}
              <InputOTP
                id="game-pin"
                name="pin"
                maxLength={6}
                value={vm.pin}
                onChange={vm.updatePin}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                aria-describedby="game-pin-help"
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  {[0, 1, 2].map((index) => <InputOTPSlot key={index} index={index} className="size-12 rounded-md text-xl font-bold" />)}
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  {[3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} className="size-12 rounded-md text-xl font-bold" />)}
                </InputOTPGroup>
              </InputOTP>
              <FieldDescription id="game-pin-help">
                PINs are temporary. If yours does not work, ask the host for the current one.
              </FieldDescription>
            </Field>

            {vm.error ? (
              <Alert variant="destructive" role="alert" className="rounded-md">
                <AlertDescription>{vm.error}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" disabled={!vm.canSubmit} className="h-12 w-full rounded-md font-bold">
              {vm.busy ? "Joining game…" : "Join game"}
              {!vm.busy ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
            </Button>
          </form>

          {vm.currentSession?.currentSessionId ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary/45 p-4">
              <p className="text-sm text-foreground">
                Saved game as <span className="font-bold">{vm.participantAlias}</span>
              </p>
              <a className="text-sm font-bold text-primary hover:text-primary/80" href={`/games/session/${encodeURIComponent(vm.currentSession.currentSessionId)}`}>
                Continue current game
              </a>
              <Button type="button" variant="ghost" size="sm" onClick={vm.clearSavedSession}>
                <LogOut className="size-4" aria-hidden="true" /> Clear saved game access
              </Button>
            </div>
          ) : null}

          {expectedEventSlug ? (
            <a className="mt-6 inline-flex text-sm font-semibold text-primary hover:text-primary/80" href={`/games/events/${encodeURIComponent(expectedEventSlug)}`}>
              Return to the event lobby
            </a>
          ) : null}

          <GameIdentityHelp />
          <a href={portalHref("/")} className="mt-4 inline-flex min-h-11 items-center rounded-md px-1 text-sm font-semibold text-primary focus-visible:ring-2 focus-visible:ring-primary">
            Back to guest portal
          </a>
        </section>
      </div>
    </main>
  );
}
