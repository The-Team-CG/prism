"use client";

import { ArrowRight, LogOut, RefreshCw, Sparkles } from "lucide-react";
import { PrismBrandLogo } from "@prism/ui";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { Button } from "@prism/ui/components/button";
import { useEventGameLobbyViewModel } from "../view-models/use-event-game-lobby-view-model";
import { LoadingState } from "@prism/ui/components/loading-state";
import { Card } from "@prism/ui/components/card";

type LobbyViewModel = ReturnType<typeof useEventGameLobbyViewModel>;

export function EventGameLobbyView({ eventSlug }: { eventSlug: string }) {
  const vm = useEventGameLobbyViewModel(eventSlug);
  const lobby = vm.lobby;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <PrismBrandLogo href="/" title="P.R.I.S.M." detail="Guest pass" markClassName="size-8 rounded-md bg-card ring-1 ring-border" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void vm.reload()} disabled={vm.status === "loading"}>
              <RefreshCw className="size-4" aria-hidden="true" /> Refresh games
            </Button>
            {vm.participantAlias ? (
              <Button type="button" variant="ghost" size="sm" onClick={vm.exitGames}>
                <LogOut className="size-4" aria-hidden="true" /> Leave games on this device
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 pb-10 sm:px-6">
        <section className="pt-8 sm:pt-12" aria-labelledby="event-game-lobby-title">
          {/* The host's two brand colours as flat segments, not a gradient. Host branding, not decoration. */}
          <div className="mb-6 flex h-1 w-20 overflow-hidden rounded-sm" aria-hidden="true">
            <span className="flex-1" style={{ backgroundColor: lobby?.branding.primaryColor ?? "var(--primary)" }} />
            <span className="flex-1" style={{ backgroundColor: lobby?.branding.secondaryColor ?? "var(--primary)" }} />
          </div>
          <h1 id="event-game-lobby-title" className="break-words text-2xl font-bold leading-tight sm:text-3xl">
            {lobby?.eventName ?? "Event games"}
          </h1>
          {lobby?.branding.logoUrl ? (
            <img src={lobby.branding.logoUrl} alt={`${lobby.eventName} logo`} className="mt-4 max-h-16 max-w-48 object-contain" />
          ) : null}
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Pick a game and play on your own, before or during the event.
          </p>

          {vm.participantAlias ? (
            <p className="mt-5 inline-flex items-center gap-2 rounded-lg bg-secondary/70 px-3 py-2 text-sm">
              <Sparkles className="size-4 text-primary" aria-hidden="true" /> Playing as <strong>{vm.participantAlias}</strong>
            </p>
          ) : null}

          {/* A failed lobby load has its own recovery panel below; show the banner only for later errors. */}
          {vm.error && vm.status !== "error" ? (
            <Alert variant="destructive" role="alert" className="mt-6 rounded-lg">
              <AlertDescription>{vm.error}</AlertDescription>
            </Alert>
          ) : null}

          <LobbyAvailability vm={vm} lobby={lobby} />

          <p className="mt-8 text-sm text-muted-foreground">
            Is the host running a game on screen?{" "}
            <a className="font-semibold text-primary hover:text-primary/80" href={`/games/join?eventSlug=${encodeURIComponent(eventSlug)}`}>
              Join the host&apos;s game
            </a>
          </p>
          <GameIdentityHelp />
        </section>
      </div>
    </main>
  );
}

function LobbyAvailability({ vm, lobby }: { vm: LobbyViewModel; lobby: LobbyViewModel["lobby"] }) {
  if (vm.status === "loading") {
    return <LoadingState label="Loading games…" className="mt-8 rounded-lg border border-border bg-card p-5" />;
  }
  if (vm.status === "error") {
    return (
      <Card className="gap-0 block mt-8 rounded-lg border border-border bg-card p-5">
        <p className="text-sm text-foreground">The game list could not be opened.</p>
        <p className="mt-1 text-sm text-muted-foreground">{vm.error ?? "Check the event link and try again."}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => void vm.reload()}>Try again</Button>
      </Card>
    );
  }
  if (!lobby || lobby.games.length === 0) {
    return vm.status === "ready" ? (
      <p className="mt-8 rounded-lg border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
        No solo games are open right now. Check back later or ask the host.
      </p>
    ) : null;
  }
  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-2">
      {lobby.games.map((game) => (
        <li key={game.id} className="flex min-h-36 flex-col justify-between rounded-lg border border-border bg-card p-5">
          <div>
            <h2 className="text-lg font-bold">{game.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ready to play</p>
          </div>
          <Button
            type="button"
            className="mt-5 h-11 justify-between"
            style={{ backgroundColor: lobby.branding.primaryColor }}
            disabled={vm.startingGameId !== null}
            onClick={() => void vm.startGame(game.id)}
          >
            {vm.startingGameId === game.id ? "Starting game…" : "Play"}
            <span className="sr-only"> {game.title}</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function GameIdentityHelp() {
  return (
    <details className="mt-5 rounded-lg border border-border bg-card px-4 text-sm text-muted-foreground">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium text-foreground">How your game name works</summary>
      <p className="pb-4 leading-6">
        Your game name belongs to this browser. It does not verify who you are or which device you use; another device gets a separate game name.
      </p>
    </details>
  );
}
