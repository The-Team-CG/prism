"use client";

import { useEffect, useRef } from "react";
import type { PrismGamePublicState } from "@prism/types";
import { Star } from "lucide-react";
import { PrismGuestShell } from "@prism/ui";
import { useGuestTabs } from "@/features/guest-shared/guest-tabs";
import { GameIdentityHelp } from "../../lobby/views/event-game-lobby-view";
import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { Button } from "@prism/ui/components/button";
import { guestGamePhase, isScoredGame, showsStandings, waitsOnRoom, type GuestGamePhase } from "../model/guest-game-phase";
import { useServerRoundCountdown } from "../model/server-round-countdown";
import { useEventGamePlayViewModel } from "../view-models/use-event-game-play-view-model";
import { ActiveGameControls } from "./game-controls";
import { FinishedPanel, PhaseStatus, RevealBanner, StandingsPanel, WaitingPanel } from "./game-phase-panels";

type PlayViewModel = ReturnType<typeof useEventGamePlayViewModel>;

export function EventGamePlayView({ sessionId }: { sessionId: string }) {
  const vm = useEventGamePlayViewModel(sessionId);
  const tabs = useGuestTabs("games");
  const gameState = vm.state;
  const deadlineAt = gameState?.currentRound?.deadlineAt;
  const secondsRemaining = useServerRoundCountdown(deadlineAt, gameState?.serverTime, gameState?.status === "paused");
  const expiryRefreshKey = useRef<string | null>(null);

  useEffect(() => {
    if (gameState?.status !== "live" || !deadlineAt || secondsRemaining !== 0) return;
    const key = `${gameState.currentRound?.key ?? ""}:${deadlineAt}`;
    if (expiryRefreshKey.current === key) return;
    expiryRefreshKey.current = key;
    void vm.refresh();
  }, [deadlineAt, gameState, secondsRemaining, vm.refresh]);

  // The game refreshes itself, so the header carries no Refresh or Leave buttons; forgetting the game is under the help.
  return (
    <PrismGuestShell
      eventName={gameState?.game.title ?? "Event game"}
      tabs={tabs}
      layout={gameState && !vm.error ? "split" : "column"}
      lead={gameState && !vm.error ? <GameSessionLead state={gameState} secondsRemaining={secondsRemaining} /> : <span />}
    >
      <SessionAvailability vm={vm} secondsRemaining={secondsRemaining} />
    </PrismGuestShell>
  );
}

function progressLabel(state: PrismGamePublicState): string | null {
  const round = state.currentRound;
  if (!round) return state.status === "lobby" || state.status === "scheduled" ? "Waiting for the host" : null;
  if (state.game.kind === "bingo") return `${round.number} ${round.number === 1 ? "number" : "numbers"} called`;
  if (round.total <= 1) return null;
  const noun = state.game.kind === "live-trivia" ? "Question" : "Round";
  return `${noun} ${round.number} of ${round.total}`;
}

/** The game's name, then one line with progress, the clock and the score: everything else gives the prompt room. */
function GameSessionLead({ state, secondsRemaining }: { state: PrismGamePublicState; secondsRemaining: number | null }) {
  const progress = progressLabel(state);
  return (
    <div className="grid gap-2 pt-1">
      <h1 id="event-game-title" className="font-heading text-2xl font-semibold leading-tight text-foreground">{state.game.title}</h1>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {progress ? <p className="font-semibold">{progress}</p> : null}
        <span className="ml-auto flex items-center gap-2">
          {isScoredGame(state.game.kind) ? <ScoreChip score={state.participant.score} /> : null}
          {secondsRemaining !== null && (state.status === "live" || state.status === "paused") ? <RoundCountdown state={state} secondsRemaining={secondsRemaining} /> : null}
        </span>
      </div>
      <GamePrompt state={state} />
    </div>
  );
}

function ScoreChip({ score }: { score: number | null }) {
  return (
    <p className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1 font-semibold text-foreground ring-1 ring-border">
      <Star className="size-3.5 fill-[#f2b134] text-[#f2b134]" aria-hidden="true" />
      <span className="sr-only">Score</span>
      <span className="tabular-nums">{score ?? 0}</span>
    </p>
  );
}

function GamePrompt({ state }: { state: PrismGamePublicState }) {
  const prompt = state.currentPrompt ?? (state.status === "lobby" ? "The host will start this game soon." : "The next prompt is not available yet.");
  const short = Boolean(state.currentPrompt && state.currentPrompt.length <= 16);
  return (
    <article className="relative mt-1 overflow-hidden rounded-3xl bg-[var(--prism-ink)] px-5 py-8 text-center text-white shadow-md lg:py-14">
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-[var(--prism-magenta)] opacity-40 blur-2xl" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-14 -left-10 size-40 rounded-full bg-[var(--prism-orange)] opacity-30 blur-2xl" />
      <h2 className="sr-only">Current prompt</h2>
      <p className={`relative break-words font-heading font-bold leading-tight ${short ? "text-4xl tracking-[0.12em] lg:text-5xl" : "text-2xl lg:text-3xl"}`}>{prompt}</p>
    </article>
  );
}

function RoundCountdown({ state, secondsRemaining }: { state: PrismGamePublicState; secondsRemaining: number }) {
  const minutes = Math.floor(secondsRemaining / 60).toString().padStart(2, "0");
  const seconds = (secondsRemaining % 60).toString().padStart(2, "0");
  const display = `${minutes}:${seconds}`;
  const urgent = secondsRemaining > 0 && secondsRemaining <= 10;
  return (
    <p className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${urgent ? "animate-pulse bg-destructive text-white" : "bg-card text-foreground ring-1 ring-border"}`}>
      {state.status === "paused" ? <span className="font-normal text-muted-foreground">Paused</span> : null}
      <time aria-label={`Time remaining: ${display}`} className="font-mono tabular-nums">{display}</time>
    </p>
  );
}

/** A session that cannot be opened from this device: say why, and offer a way forward instead of a dead end. */
function SessionUnavailable({ message }: { message: string | null }) {
  return (
    <section className="grid gap-3">
      {message ? (
        <Alert variant="destructive" role="alert" className="rounded-xl">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h1 className="text-xl font-semibold">Game session unavailable</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Join again with the host’s PIN or go back to where you were.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button asChild className="h-11">
            <a href="/games/join">Join with a PIN</a>
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => window.history.back()}>
            Back
          </Button>
        </div>
      </div>
    </section>
  );
}

function SessionAvailability({ vm, secondsRemaining }: { vm: PlayViewModel; secondsRemaining: number | null }) {
  // A failed refresh or action keeps the last good game on screen; only a game with no state yet is replaced by the error.
  if (vm.state) {
    return (
      <>
        {vm.error ? <p role="alert" className="mb-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{vm.error}</p> : null}
        <GameSessionContent vm={vm} state={vm.state} secondsRemaining={secondsRemaining} />
      </>
    );
  }
  if (vm.error) return <SessionUnavailable message={vm.error} />;
  if (vm.status === "loading") {
    return <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Opening your game…</p>;
  }
  if (vm.status === "error") return <SessionUnavailable message={null} />;
  return null;
}

function showsControls(phase: GuestGamePhase): boolean {
  return phase !== "waiting" && phase !== "finished";
}

function showsPhaseStatus(state: PrismGamePublicState, phase: GuestGamePhase): boolean {
  const kind = state.participant.gameData?.kind;
  const audienceReceipt = kind === "live-poll" || kind === "presenter-deck" || kind === "word-cloud" || kind === "open-qa";
  return waitsOnRoom(state.game.kind) && !(phase === "locked" && state.status === "live" && audienceReceipt);
}

/** One screen per moment of the round: get ready, answer, wait, see how you did, then the standings. */
function GameSessionContent({ vm, state, secondsRemaining }: { vm: PlayViewModel; state: PrismGamePublicState; secondsRemaining: number | null }) {
  const phase = guestGamePhase(state, secondsRemaining);
  return (
    <section aria-labelledby="event-game-title" className="grid gap-4">
      {phase === "waiting" ? <WaitingPanel alias={vm.participantAlias} /> : null}
      {phase === "finished" ? <FinishedPanel state={state} scored={isScoredGame(state.game.kind)} /> : null}
      {phase === "reveal" ? <RevealBanner state={state} /> : null}
      {showsControls(phase) ? (
        <ActiveGameControls
          state={state}
          secondsRemaining={secondsRemaining}
          busy={vm.actionBusy}
          mediaUrl={vm.mediaUrl}
          comparisonMediaUrl={vm.comparisonMediaUrl}
          mediaError={vm.mediaError}
          onSubmit={vm.submitAction}
        />
      ) : null}
      {showsPhaseStatus(state, phase) ? <PhaseStatus phase={phase} paused={state.status === "paused"} scored={isScoredGame(state.game.kind)} /> : null}
      {showsStandings(state, phase) ? <StandingsPanel state={state} title={phase === "finished" ? "Final standings" : "Standings"} /> : null}
      <GameIdentityHelp alias={vm.participantAlias} onLeave={vm.exitGames} />
    </section>
  );
}
