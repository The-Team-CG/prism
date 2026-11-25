"use client";

import { ChevronRight, Hash, Play } from "lucide-react";
import { PrismGuestShell } from "@prism/ui";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { Button } from "@prism/ui/components/button";
import { LoadingState } from "@prism/ui/components/loading-state";
import { useGuestTabs } from "@/features/guest-shared/guest-tabs";
import { useEventGameLobbyViewModel } from "../view-models/use-event-game-lobby-view-model";

type LobbyViewModel = ReturnType<typeof useEventGameLobbyViewModel>;

/**
 * The event's games: solo games to play now, and the host's game on screen by PIN. Inside the guest pass it sits
 * under the Games tab; opened from a shared link without a pass it stands alone.
 */
export function EventGameLobbyView({ eventSlug }: { eventSlug: string }) {
  const vm = useEventGameLobbyViewModel(eventSlug);
  const tabs = useGuestTabs("games");
  const lobby = vm.lobby;

  return (
    <PrismGuestShell
      eventName={lobby ? `Activities · ${lobby.eventName}` : "Event activities"}
      tabs={tabs}
      layout="wide"
      lead={
        <div className="grid gap-1 pt-1">
          {/* The host's two brand colours as flat segments, not a gradient. Host branding, not decoration. */}
          <div className="mb-2 flex h-1 w-16 overflow-hidden rounded-sm" aria-hidden="true">
            <span className="flex-1" style={{ backgroundColor: lobby?.branding.primaryColor ?? "var(--primary)" }} />
            <span className="flex-1" style={{ backgroundColor: lobby?.branding.secondaryColor ?? "var(--primary)" }} />
          </div>
          {lobby?.branding.logoUrl ? (
            <img src={lobby.branding.logoUrl} alt={`${lobby.eventName} logo`} className="mb-2 max-h-12 max-w-40 object-contain" />
          ) : null}
          {/* "Games" is already the top bar's title and the current tab, so the heading names the event. */}
          <h1 id="event-game-lobby-title" className="font-heading text-2xl font-semibold leading-tight text-foreground">{lobby?.eventName ?? "Games"}</h1>
        </div>
      }
    >
      <div className="grid gap-3">
        {vm.error && vm.status !== "error" ? (
          <Alert variant="destructive" role="alert" className="rounded-xl">
            <AlertDescription>{vm.error}</AlertDescription>
          </Alert>
        ) : null}

        {vm.currentGame ? (
          <a href={`/games/session/${encodeURIComponent(vm.currentGame.id)}`} className="flex min-h-16 items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Play className="size-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Continue playing</span>
              <span className="block text-sm text-ink-foreground/80">{vm.currentGame.title}</span>
            </span>
            <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
          </a>
        ) : null}

        <a
          href={`/games/join?eventSlug=${encodeURIComponent(eventSlug)}`}
          className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Hash className="size-5" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-foreground">Join with PIN</span>
            <span className="block text-sm text-muted-foreground">Enter the PIN on the room screen</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </a>

        <LobbyAvailability vm={vm} lobby={lobby} />
        <GameIdentityHelp alias={vm.currentGame?.alias ?? null} onLeave={vm.currentGame ? vm.exitGames : undefined} />
      </div>
    </PrismGuestShell>
  );
}

function LobbyAvailability({ vm, lobby }: { vm: LobbyViewModel; lobby: LobbyViewModel["lobby"] }) {
  if (vm.status === "loading") {
    return <LoadingState label="Loading games…" className="rounded-xl border border-border bg-card p-5" />;
  }
  if (vm.status === "error") {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <p className="font-semibold text-foreground">The games could not be opened.</p>
        <p className="mt-1 text-sm text-muted-foreground">{vm.error ?? "Check the event link and try again."}</p>
        <Button type="button" variant="outline" className="mt-3 h-11" onClick={() => void vm.reload()}>Try again</Button>
      </section>
    );
  }
  if (!lobby || lobby.games.length === 0) {
    return vm.status === "ready" ? (
      <p className="rounded-xl border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
        No solo games are open right now. Check back later, or join the host&apos;s game when it starts.
      </p>
    ) : null;
  }
  return (
    <section aria-labelledby="solo-games-title" className="grid gap-2">
      <h2 id="solo-games-title" className="px-1 text-sm font-semibold text-muted-foreground">Play on your own</h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {lobby.games.map((game) => (
          <li key={game.id}>
            <button
              type="button"
              aria-label={`Play ${game.title}`}
              disabled={vm.startingGameId !== null}
              onClick={() => void vm.startGame(game.id)}
              className="flex min-h-16 w-full items-center gap-3 rounded-xl bg-ink px-4 py-3 text-left text-ink-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{game.title}</span>
                <span className="block text-sm text-ink-foreground/70">{vm.startingGameId === game.id ? "Starting…" : "Ready to play"}</span>
              </span>
              <span className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
                <Play className="size-4" aria-hidden="true" /> Play
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The game name, said once and quietly, with a way to forget it on this phone. */
export function GameIdentityHelp({ alias, onLeave }: { alias?: string | null; onLeave?: () => void }) {
  return (
    <details className="rounded-xl px-1 text-sm text-muted-foreground">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium text-foreground">
        {alias ? <>Playing as {alias}</> : "How your game name works"}
      </summary>
      <p className="pb-2 leading-6">
        Your game name belongs to this browser. It does not verify who you are or which device you use; another device gets a separate game name.
      </p>
      {onLeave ? (
        <button type="button" onClick={onLeave} className="mb-2 min-h-11 font-semibold text-primary hover:text-primary/80">
          Forget my games on this phone
        </button>
      ) : null}
    </details>
  );
}
