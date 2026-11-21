"use client";

import type { FormEvent } from "react";
import { ArrowRight, ChevronRight, Play } from "lucide-react";
import { PrismGuestShell } from "@prism/ui";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { Button } from "@prism/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@prism/ui/components/field";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@prism/ui/components/input-otp";
import { useGuestTabs } from "@/features/guest-shared/guest-tabs";
import { GameIdentityHelp } from "../../lobby/views/event-game-lobby-view";
import { useEventGamePinJoinViewModel } from "../view-models/use-event-game-pin-join-view-model";

/** The host's game on the big screen: six digits and one button. A game already joined on this phone comes first. */
export function EventGamePinJoinView({ expectedEventSlug }: { expectedEventSlug?: string }) {
  const vm = useEventGamePinJoinViewModel(expectedEventSlug);
  const tabs = useGuestTabs("games");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.submit();
  }

  return (
    <PrismGuestShell
      eventName="Join the host's game"
      tabs={tabs}
      layout="narrow"
      lead={
        <div className="grid gap-1 pt-1">
          <h1 className="font-heading text-2xl font-semibold leading-tight text-foreground">Join the host&apos;s game</h1>
          <p className="text-sm text-muted-foreground">Enter the six-digit PIN on the host&apos;s screen. No account needed.</p>
        </div>
      }
    >
      <div className="grid gap-3">
        {vm.currentSession?.currentSessionId ? (
          <a
            href={`/games/session/${encodeURIComponent(vm.currentSession.currentSessionId)}`}
            className="flex min-h-16 items-center gap-3 rounded-xl bg-ink px-4 py-3 text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Play className="size-5" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Continue your game</span>
              {vm.participantAlias ? <span className="block text-sm text-ink-foreground/70">Playing as {vm.participantAlias}</span> : null}
            </span>
            <ChevronRight className="size-5 shrink-0 text-ink-foreground/70" aria-hidden="true" />
          </a>
        ) : null}

        <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
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
            <FieldDescription id="game-pin-help" className="text-center">
              PINs change. If yours does not work, ask the host for the current one.
            </FieldDescription>
          </Field>

          {vm.error ? (
            <Alert variant="destructive" role="alert" className="rounded-md">
              <AlertDescription>{vm.error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={!vm.canSubmit} className="h-12 w-full text-base">
            {vm.busy ? "Joining game…" : "Join game"}
            {!vm.busy ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
          </Button>
        </form>

        {expectedEventSlug ? (
          <a className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-primary hover:text-primary/80" href={`/games/events/${encodeURIComponent(expectedEventSlug)}`}>
            Solo games for this event
          </a>
        ) : null}

        <GameIdentityHelp alias={vm.currentSession?.currentSessionId ? vm.participantAlias : null} onLeave={vm.currentSession?.currentSessionId ? vm.clearSavedSession : undefined} />
      </div>
    </PrismGuestShell>
  );
}
