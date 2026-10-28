"use client";

import type { FormEvent } from "react";
import { ArrowRight, LogOut } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
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
          <div className="mb-7 h-1 w-20 rounded-sm bg-primary" />
          <div>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Join the host&apos;s game</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Enter the six-digit PIN on the host&apos;s screen. No account needed.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-8 grid gap-4">
            <label htmlFor="game-pin" className="grid gap-2 text-sm font-semibold">
              Game PIN
              <Input
                id="game-pin"
                name="pin"
                value={vm.pin}
                onChange={(event) => vm.updatePin(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={12}
                placeholder="123456"
                aria-describedby="game-pin-help"
                className="h-16 rounded-md text-center font-mono text-3xl font-black tracking-[0.28em]"
              />
            </label>
            <p id="game-pin-help" className="text-sm leading-6 text-muted-foreground">
              PINs are temporary. If yours does not work, ask the host for the current one.
            </p>

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
        </section>
      </div>
    </main>
  );
}
