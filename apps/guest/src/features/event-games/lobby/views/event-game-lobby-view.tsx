"use client";

import { ArrowRight, LogOut, RefreshCw, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { useEventGameLobbyViewModel } from "../view-models/use-event-game-lobby-view-model";

type LobbyViewModel = ReturnType<typeof useEventGameLobbyViewModel>;

export function EventGameLobbyView({ eventSlug }: { eventSlug: string }) {
  const vm = useEventGameLobbyViewModel(eventSlug);
  const lobby = vm.lobby;

  return (
    <main className="min-h-screen bg-page px-5 py-8 text-foreground">
      <div className="mx-auto w-full max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <a href="/games/join" className="text-sm font-black tracking-wide text-primary">P.R.I.S.M</a>
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
        </header>

        <section className="pt-8 sm:pt-12" aria-labelledby="event-game-lobby-title">
          <div className="mb-7 h-1 w-20 rounded-sm" style={{ background: lobby ? `linear-gradient(90deg, ${lobby.branding.primaryColor}, ${lobby.branding.secondaryColor})` : "var(--primary)" }} />
          <p className="text-sm font-semibold text-muted-foreground">Independent (Singleplayer) games</p>
          <h1 id="event-game-lobby-title" className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
            {lobby?.eventName ?? "Event games"}
          </h1>
          {lobby?.branding.logoUrl ? (
            <img src={lobby.branding.logoUrl} alt={`${lobby.eventName} logo`} className="mt-4 max-h-16 max-w-48 object-contain" />
          ) : null}
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Choose a game that is available now. You can play while waiting for the event to start or during the event.
          </p>

          {vm.participantAlias ? (
            <p className="mt-5 inline-flex items-center gap-2 rounded-md bg-secondary/70 px-3 py-2 text-sm">
              <Sparkles className="size-4 text-primary" aria-hidden="true" /> Playing as <strong>{vm.participantAlias}</strong>
            </p>
          ) : null}

          {vm.error ? (
            <Alert variant="destructive" role="alert" className="mt-6 rounded-md">
              <AlertDescription>{vm.error}</AlertDescription>
            </Alert>
          ) : null}

          <LobbyAvailability vm={vm} lobby={lobby} />

          <div className="mt-8 rounded-md border border-border bg-secondary/45 p-4 text-sm leading-6 text-muted-foreground">
            Your guest alias belongs to this browser session. It does not verify a person or device; another device gets a separate game identity.
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Have an Active (Multiplayer) PIN?{" "}
            <a className="font-semibold text-primary underline-offset-4 hover:underline" href={`/games/join?eventSlug=${encodeURIComponent(eventSlug)}`}>
              Join with PIN
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}

function LobbyAvailability({ vm, lobby }: { vm: LobbyViewModel; lobby: LobbyViewModel["lobby"] }) {
  if (vm.status === "loading") {
    return <p role="status" className="mt-8 rounded-md border border-border bg-card p-5 text-sm text-muted-foreground">Loading games…</p>;
  }
  if (vm.status === "error") {
    return (
      <div className="mt-8 rounded-md border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">The game list could not be opened. Check the event link and try again.</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => void vm.reload()}>Try again</Button>
      </div>
    );
  }
  if (!lobby || lobby.games.length === 0) {
    return vm.status === "ready" ? (
      <p className="mt-8 rounded-md border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
        There are no Independent (Singleplayer) games available right now.
      </p>
    ) : null;
  }
  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-2">
      {lobby.games.map((game) => (
        <li key={game.id} className="flex min-h-36 flex-col justify-between rounded-md border border-border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-bold">{game.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ready to play</p>
          </div>
          <Button
            type="button"
            className="mt-5 justify-between"
            style={{ backgroundColor: lobby.branding.primaryColor }}
            disabled={vm.startingGameId !== null}
            onClick={() => void vm.startGame(game.id)}
          >
            {vm.startingGameId === game.id ? "Starting game…" : `Start ${game.title}`}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
