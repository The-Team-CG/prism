"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactElement } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import type { PrismGamePublicState, PrismSubmitEventGameActionInput } from "@prism/types";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { useServerRoundCountdown } from "../model/server-round-countdown";
import { useEventGamePlayViewModel } from "../view-models/use-event-game-play-view-model";

const STATUS_LABELS = {
  scheduled: "Scheduled",
  lobby: "Waiting for the host",
  live: "In progress",
  paused: "Paused by the host",
  completed: "Game complete",
  cancelled: "Game ended",
} as const;

type PlayViewModel = ReturnType<typeof useEventGamePlayViewModel>;

export function EventGamePlayView({ sessionId }: { sessionId: string }) {
  const vm = useEventGamePlayViewModel(sessionId);
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

  return (
    <main className="min-h-screen bg-(--prism-page) px-5 py-6 text-foreground sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <a href="/games/join" className="text-sm font-black tracking-wide text-primary">P.R.I.S.M games</a>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void vm.refresh()} disabled={vm.status === "loading"}>
              <RefreshCw className="size-4" aria-hidden="true" /> Refresh
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={vm.exitGames}>
              <LogOut className="size-4" aria-hidden="true" /> Leave games
            </Button>
          </div>
        </header>

        <SessionAvailability vm={vm} secondsRemaining={secondsRemaining} />
      </div>
    </main>
  );
}

function SessionAvailability({ vm, secondsRemaining }: { vm: PlayViewModel; secondsRemaining: number | null }) {
  if (vm.error) {
    return (
      <Alert variant="destructive" role="alert" className="mt-6 rounded-md">
        <AlertDescription>{vm.error}</AlertDescription>
      </Alert>
    );
  }
  if (vm.status === "loading") {
    return <p role="status" className="mt-8 rounded-md border border-border bg-card p-5 text-sm text-muted-foreground">Opening your game…</p>;
  }
  if (vm.state) return <GameSessionContent vm={vm} secondsRemaining={secondsRemaining} />;
  if (vm.status === "error") {
    return (
      <section className="mt-8 rounded-md border border-border bg-card p-5">
        <h1 className="text-xl font-bold">Game session unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Join again with the host’s PIN or open the event games link.</p>
        <a className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline" href="/games/join">Return to game entry</a>
      </section>
    );
  }
  return null;
}

function GameSessionContent({ vm, secondsRemaining }: { vm: PlayViewModel; secondsRemaining: number | null }) {
  const gameState = vm.state;
  if (!gameState) return null;
  return (
    <section className="pt-7" aria-labelledby="event-game-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{STATUS_LABELS[gameState.status]}</p>
          <h1 id="event-game-title" className="mt-1 text-3xl font-black leading-tight">{gameState.game.title}</h1>
          {vm.participantAlias ? <p className="mt-2 text-sm text-muted-foreground">Playing as {vm.participantAlias}</p> : null}
        </div>
        {gameState.currentRound ? (
          <p className="rounded-md bg-secondary px-3 py-2 text-sm font-semibold">
            Round {gameState.currentRound.number} of {gameState.currentRound.total}
          </p>
        ) : null}
      </div>

      {secondsRemaining !== null ? <RoundCountdown state={gameState} secondsRemaining={secondsRemaining} /> : null}

      <article className="mt-7 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7">
        <p className="text-sm font-semibold text-muted-foreground">Current prompt</p>
        <h2 className="mt-3 text-xl font-bold leading-8 sm:text-2xl">
          {gameState.currentPrompt ?? (gameState.status === "lobby" ? "The host will start this game soon." : "The next prompt is not available yet.")}
        </h2>
      </article>

      <fieldset disabled={secondsRemaining === 0} className="min-w-0 border-0 p-0">
        <legend className="sr-only">Round response controls</legend>
        <ActiveGameControls
          state={gameState}
          busy={vm.actionBusy}
          mediaUrl={vm.mediaUrl}
          comparisonMediaUrl={vm.comparisonMediaUrl}
          mediaError={vm.mediaError}
          onSubmit={vm.submitAction}
        />
      </fieldset>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-5" aria-labelledby="your-game-status">
          <h2 id="your-game-status" className="font-bold">Your game status</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {gameState.participant.hasSubmitted ? "Your response has been recorded." : "You have not responded to this round yet."}
          </p>
          {isNonScoredChoiceGame(gameState.game.kind)
            ? <p className="mt-3 text-sm text-muted-foreground">This game has no points or guest rankings.</p>
            : <p className="mt-3 text-sm">Your score: <strong>{gameState.participant.score ?? "Not scored yet"}</strong></p>}
        </section>

        <SharedGameResults state={gameState} />
      </div>
      <PublicLeaderboard state={gameState} />

      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        Your alias identifies this browser session only. It does not confirm one person or one device, and a different device has a separate game identity.
      </p>
    </section>
  );
}

function RoundCountdown({ state, secondsRemaining }: { state: PrismGamePublicState; secondsRemaining: number }) {
  const minutes = Math.floor(secondsRemaining / 60).toString().padStart(2, "0");
  const seconds = (secondsRemaining % 60).toString().padStart(2, "0");
  const display = `${minutes}:${seconds}`;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm" role={secondsRemaining === 0 ? "status" : undefined}>
      <span className="font-semibold">{state.status === "paused" ? "Round paused" : "Time remaining"}</span>
      <time aria-label={`Time remaining: ${display}`} className="font-mono font-bold tabular-nums">{display}</time>
      {secondsRemaining === 0 ? <span className="text-muted-foreground">The timer has ended. Your answers are closed until the game updates.</span> : null}
    </div>
  );
}

function SharedGameResults({ state }: { state: PrismGamePublicState }) {
  if (isSingleplayerPuzzleKind(state.game.kind)) return null;
  if (state.game.kind === "would-you-rather" && (state.participant.gameData?.kind !== "would-you-rather"
    || !state.participant.gameData.aggregateResults)) return null;
  return <section className="rounded-md border border-border bg-card p-5" aria-labelledby="game-results">
    <h2 id="game-results" className="font-bold">Shared results</h2>
    {state.aggregateResults.length ? (
      <ul className="mt-3 grid gap-2">
        {state.aggregateResults.map((result, index) => (
          <li key={`${result.label}-${index}`} className="flex justify-between gap-4 text-sm">
            <span>{result.label}</span><span className="font-semibold">{result.count}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Shared results will appear here when available.</p>
    )}
  </section>;
}

function ActiveGameControls({
  state,
  busy,
  mediaUrl,
  comparisonMediaUrl,
  mediaError,
  onSubmit,
}: {
  state: PrismGamePublicState;
  busy: boolean;
  mediaUrl: string | null;
  comparisonMediaUrl: string | null;
  mediaError: string | null;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  const roundKey = state.currentRound?.key ?? "";
  const canSubmit = participantCanSubmit(state, roundKey);
  const key = state.game.kind === "bingo"
    ? `${state.game.kind}-${roundKey}`
    : `${state.game.kind}-${roundKey}-${state.currentRound?.number ?? 0}`;
  const trivia = triviaParticipantData(state);
  const bingo = bingoParticipantData(state);
  const picture = pictureParticipantData(state);
  const wordScramble = wordScrambleParticipantData(state);
  const pictureSolo = pictureSoloParticipantData(state);
  const spotTheDifference = spotTheDifferenceParticipantData(state);
  const wouldYouRather = wouldYouRatherParticipantData(state);
  const thisOrThatSolo = thisOrThatSoloParticipantData(state);
  const independentControls = independentSingleplayerControls({
    state, roundKey, key, canSubmit, busy, mediaUrl, comparisonMediaUrl, mediaError, onSubmit,
    wordScramble, pictureSolo, spotTheDifference, wouldYouRather, thisOrThatSolo,
  });
  if (independentControls) return independentControls;

  if (trivia) {
    return (
      <LiveTriviaControls key={key} roundKey={roundKey} options={trivia.options} canSubmit={canSubmit} busy={busy} onSubmit={onSubmit} />
    );
  }

  if (bingo) {
    return (
      <BingoControls key={key} roundKey={roundKey} card={bingo.card} calledNumbers={bingo.calledNumbers} canSubmit={canSubmit} busy={busy} onSubmit={onSubmit} />
    );
  }

  if (picture) {
    return (
      <GuessPictureControls key={key} roundKey={roundKey} stage={picture.stage} totalStages={state.currentRound?.total ?? picture.stage} mediaUrl={mediaUrl} mediaError={mediaError} canSubmit={canSubmit} busy={busy} onSubmit={onSubmit} />
    );
  }

  if (state.game.kind === "spin-wheel") {
    return <SpinWheelStatus result={state.sessionResult ?? null} />;
  }

  const thisOrThat = thisOrThatParticipantData(state);
  if (thisOrThat) {
    return <ThisOrThatControls key={key} state={state} roundKey={roundKey} options={thisOrThat.options} busy={busy} onSubmit={onSubmit} />;
  }

  const familyFeud = familyFeudParticipantData(state);
  if (familyFeud) {
    return <FamilyFeudControls key={key} state={state} roundKey={roundKey} teamLabel={familyFeud.teamLabel} busy={busy} onSubmit={onSubmit} />;
  }

  const splitTheRoom = splitTheRoomParticipantData(state);
  if (splitTheRoom) {
    return <SplitTheRoomControls key={key} state={state} roundKey={roundKey} data={splitTheRoom} busy={busy} onSubmit={onSubmit} />;
  }

  return null;
}

function independentSingleplayerControls({
  state, roundKey, key, canSubmit, busy, mediaUrl, comparisonMediaUrl, mediaError, onSubmit,
  wordScramble, pictureSolo, spotTheDifference,
  wouldYouRather, thisOrThatSolo,
}: {
  state: PrismGamePublicState; roundKey: string; key: string; canSubmit: boolean; busy: boolean;
  mediaUrl: string | null; comparisonMediaUrl: string | null; mediaError: string | null;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
  wordScramble: WordScrambleData | null; pictureSolo: PictureSoloData | null; spotTheDifference: SpotTheDifferenceData | null;
  wouldYouRather: WouldYouRatherData | null; thisOrThatSolo: ThisOrThatSoloData | null;
}): ReactElement | null {
  if (wordScramble) return <WordScrambleControls key={key} roundKey={roundKey} prompt={state.currentPrompt ?? "Unscramble the word"} canSubmit={canSubmit} busy={busy} onSubmit={onSubmit} />;
  if (pictureSolo) return <PictureSoloControls key={key} roundKey={roundKey} stage={pictureSolo.stage} totalStages={pictureSolo.totalStages} mediaUrl={mediaUrl} mediaError={mediaError} canSubmit={canSubmit} busy={busy} onSubmit={onSubmit} />;
  if (spotTheDifference) return <SpotTheDifferenceControls key={key} roundKey={roundKey} data={spotTheDifference} originalMediaUrl={mediaUrl} comparisonMediaUrl={comparisonMediaUrl} mediaError={mediaError} canSubmit={canSubmit} busy={busy} onSubmit={onSubmit} />;
  if (wouldYouRather) return <WouldYouRatherControls key={key} state={state} roundKey={roundKey} data={wouldYouRather} busy={busy} onSubmit={onSubmit} />;
  if (thisOrThatSolo) return <ThisOrThatSoloControls key={key} state={state} roundKey={roundKey} data={thisOrThatSolo} busy={busy} onSubmit={onSubmit} />;
  return null;
}

function participantCanSubmit(state: PrismGamePublicState, roundKey: string): boolean {
  return state.status === "live" && !state.participant.hasSubmitted && Boolean(roundKey);
}

type TriviaData = Extract<NonNullable<PrismGamePublicState["participant"]["gameData"]>, { kind: "live-trivia" }>;
type BingoData = Extract<NonNullable<PrismGamePublicState["participant"]["gameData"]>, { kind: "bingo" }>;
type PictureData = Extract<NonNullable<PrismGamePublicState["participant"]["gameData"]>, { kind: "guess-picture" }>;
type WordScrambleData = Extract<NonNullable<PrismGamePublicState["participant"]["gameData"]>, { kind: "word-scramble" }>;
type PictureSoloData = Extract<NonNullable<PrismGamePublicState["participant"]["gameData"]>, { kind: "guess-picture-solo" }>;
type SpotTheDifferenceData = Extract<NonNullable<PrismGamePublicState["participant"]["gameData"]>, { kind: "spot-the-difference" }>;
type DifferenceMark = { x: number; y: number };

function differenceSelectionDisabled(canSubmit: boolean, busy: boolean, selected: number, total: number): boolean {
  return !canSubmit || busy || selected >= total;
}

function pointerDifferenceSelection(
  event: MouseEvent<HTMLButtonElement>,
  canSubmit: boolean,
  busy: boolean,
  selected: number,
  total: number,
): DifferenceMark | null {
  if (differenceSelectionDisabled(canSubmit, busy, selected, total) || event.detail === 0) return null;
  const bounds = event.currentTarget.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return null;
  return {
    x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
    y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
  };
}
type WouldYouRatherData = Extract<NonNullable<PrismGamePublicState["participant"]["gameData"]>, { kind: "would-you-rather" }>;
type ThisOrThatSoloData = Extract<NonNullable<PrismGamePublicState["participant"]["gameData"]>, { kind: "this-or-that-solo" }>;
type ThisOrThatData = Extract<NonNullable<PrismGamePublicState["participant"]["gameData"]>, { kind: "this-or-that" }>;
type FamilyFeudData = Extract<NonNullable<PrismGamePublicState["participant"]["gameData"]>, { kind: "family-feud" }>;
type SplitTheRoomData = Extract<NonNullable<PrismGamePublicState["participant"]["gameData"]>, { kind: "split-the-room" }>;

function triviaParticipantData(state: PrismGamePublicState): TriviaData | null {
  if (state.game.kind !== "live-trivia") return null;
  const data = state.participant.gameData;
  return data?.kind === "live-trivia" ? data : null;
}

function bingoParticipantData(state: PrismGamePublicState): BingoData | null {
  if (state.game.kind !== "bingo") return null;
  const data = state.participant.gameData;
  return data?.kind === "bingo" ? data : null;
}

function pictureParticipantData(state: PrismGamePublicState): PictureData | null {
  if (state.game.kind !== "guess-picture") return null;
  const data = state.participant.gameData;
  return data?.kind === "guess-picture" ? data : null;
}

function wordScrambleParticipantData(state: PrismGamePublicState): WordScrambleData | null {
  const data = state.participant.gameData;
  return state.game.kind === "word-scramble" && data?.kind === "word-scramble" ? data : null;
}

function pictureSoloParticipantData(state: PrismGamePublicState): PictureSoloData | null {
  const data = state.participant.gameData;
  return state.game.kind === "guess-picture-solo" && data?.kind === "guess-picture-solo" ? data : null;
}

function spotTheDifferenceParticipantData(state: PrismGamePublicState): SpotTheDifferenceData | null {
  const data = state.participant.gameData;
  return state.game.kind === "spot-the-difference" && data?.kind === "spot-the-difference" ? data : null;
}

function wouldYouRatherParticipantData(state: PrismGamePublicState): WouldYouRatherData | null {
  const data = state.participant.gameData;
  return state.game.kind === "would-you-rather" && data?.kind === "would-you-rather" ? data : null;
}

function thisOrThatSoloParticipantData(state: PrismGamePublicState): ThisOrThatSoloData | null {
  const data = state.participant.gameData;
  return state.game.kind === "this-or-that-solo" && data?.kind === "this-or-that-solo" ? data : null;
}

function isSingleplayerPuzzleKind(kind: PrismGamePublicState["game"]["kind"]): boolean {
  return kind === "word-scramble" || kind === "guess-picture-solo" || kind === "spot-the-difference";
}

function isNonScoredChoiceGame(kind: PrismGamePublicState["game"]["kind"]): boolean {
  return kind === "would-you-rather" || kind === "this-or-that-solo";
}

function thisOrThatParticipantData(state: PrismGamePublicState): ThisOrThatData | null {
  if (state.game.kind !== "this-or-that") return null;
  const data = state.participant.gameData;
  return data?.kind === "this-or-that" ? data : null;
}

function familyFeudParticipantData(state: PrismGamePublicState): FamilyFeudData | null {
  if (state.game.kind !== "family-feud") return null;
  const data = state.participant.gameData;
  return data?.kind === "family-feud" ? data : null;
}

function splitTheRoomParticipantData(state: PrismGamePublicState): SplitTheRoomData | null {
  if (state.game.kind !== "split-the-room") return null;
  const data = state.participant.gameData;
  return data?.kind === "split-the-room" ? data : null;
}

function submitModeAction(
  event: FormEvent<HTMLFormElement>,
  action: PrismSubmitEventGameActionInput,
  canSubmit: boolean,
  busy: boolean,
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>,
) {
  event.preventDefault();
  if (canSubmit && !busy) void onSubmit(action);
}

function WordScrambleControls({ roundKey, prompt, canSubmit, busy, onSubmit }: {
  roundKey: string; prompt: string; canSubmit: boolean; busy: boolean;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  const [answer, setAnswer] = useState("");
  return <form className="mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7" onSubmit={(event) => submitModeAction(event, {
    templateId: "word-scramble", roundKey, actionKind: "answer", payload: { answer },
  }, canSubmit, busy, onSubmit)}>
    <label className="grid gap-1.5 text-sm font-semibold">Unscrambled word
      <input value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={120} autoComplete="off" className="min-h-11 rounded-md border border-border bg-background px-3" disabled={!canSubmit || busy} />
    </label>
    <Button type="submit" className="mt-3" disabled={!answer.trim() || !canSubmit || busy}>{busy ? "Sending…" : "Submit answer"}</Button>
    <p className="mt-3 text-xs text-muted-foreground">Your answer is scored privately for this event game.</p>
  </form>;
}

function PictureSoloControls({ roundKey, stage, totalStages, mediaUrl, mediaError, canSubmit, busy, onSubmit }: {
  roundKey: string; stage: number; totalStages: number; mediaUrl: string | null; mediaError: string | null; canSubmit: boolean; busy: boolean;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  const [answer, setAnswer] = useState("");
  const visibleWidth = Math.min(100, Math.max(1, Math.round((stage / totalStages) * 100)));
  return <form className="mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7" onSubmit={(event) => submitModeAction(event, {
    templateId: "guess-picture-solo", roundKey, actionKind: "answer", payload: { answer },
  }, canSubmit, busy, onSubmit)}>
    <h2 className="font-bold">Private picture reveal · Hint {stage} of {totalStages}</h2>
    {mediaUrl ? <div className="mt-3 overflow-hidden rounded-md bg-secondary"><img src={mediaUrl} alt="Your event picture puzzle" data-reveal-stage={stage} style={{ clipPath: `inset(0 ${100 - visibleWidth}% 0 0)` }} className="block h-auto w-full rounded-md object-contain" /></div> : <p role={mediaError ? "alert" : "status"} className="mt-3 rounded-md bg-secondary px-3 py-4 text-sm text-muted-foreground">{mediaError ?? "Loading the event picture…"}</p>}
    <label className="mt-4 grid gap-1.5 text-sm font-semibold">Your guess
      <input value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={120} autoComplete="off" className="min-h-11 rounded-md border border-border bg-background px-3" disabled={!canSubmit || busy} />
    </label>
    <Button type="submit" className="mt-3" disabled={!answer.trim() || !canSubmit || busy}>{busy ? "Sending…" : "Submit guess"}</Button>
  </form>;
}

function SpotTheDifferenceControls({ roundKey, data, originalMediaUrl, comparisonMediaUrl, mediaError, canSubmit, busy, onSubmit }: {
  roundKey: string; data: SpotTheDifferenceData; originalMediaUrl: string | null; comparisonMediaUrl: string | null;
  mediaError: string | null; canSubmit: boolean; busy: boolean;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  const [selections, setSelections] = useState<Array<{ x: number; y: number }>>([]);
  const [keyboardX, setKeyboardX] = useState(50);
  const [keyboardY, setKeyboardY] = useState(50);
  const selectionDisabled = differenceSelectionDisabled(canSubmit, busy, selections.length, data.totalDifferences);
  const showCheckButton = canSubmit && !busy;
  function markDifference(event: MouseEvent<HTMLButtonElement>) {
    const selection = pointerDifferenceSelection(event, canSubmit, busy, selections.length, data.totalDifferences);
    if (!selection) return;
    setSelections((current) => [...current, selection]);
  }
  function addKeyboardSelection() {
    if (selectionDisabled) return;
    setSelections((current) => [...current, { x: keyboardX / 100, y: keyboardY / 100 }]);
  }
  return <section className="mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7" aria-label="Spot the Difference puzzle">
    <h2 className="font-bold">Find the differences</h2>
    <p className="mt-1 text-sm text-muted-foreground">Tap each difference in the comparison image. The target locations and score stay private until your answer is checked.</p>
    {originalMediaUrl && comparisonMediaUrl ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <figure><figcaption className="mb-1 text-xs font-semibold">Original</figcaption><img src={originalMediaUrl} alt="Original event game image" className="block h-auto w-full rounded-md bg-secondary" /></figure>
      <figure><figcaption className="mb-1 text-xs font-semibold">Comparison · tap to mark</figcaption>
        <button type="button" aria-label="Mark a difference on the comparison image" disabled={selectionDisabled} onClick={markDifference} className="relative block w-full cursor-crosshair overflow-hidden rounded-md bg-secondary p-0 text-left disabled:cursor-not-allowed">
          <img src={comparisonMediaUrl} alt="Comparison event game image" className="block h-auto w-full" />
          {selections.map((selection, index) => <span key={`${selection.x}-${selection.y}-${index}`} aria-hidden="true" className="pointer-events-none absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-primary text-xs font-bold text-primary-foreground" style={{ left: `${selection.x * 100}%`, top: `${selection.y * 100}%` }}>{index + 1}</span>)}
        </button>
      </figure>
    </div> : <p role={mediaError ? "alert" : "status"} className="mt-3 rounded-md bg-secondary px-3 py-4 text-sm text-muted-foreground">{mediaError ?? "Loading the image pair…"}</p>}
    <fieldset disabled={!canSubmit || busy || selections.length >= data.totalDifferences} className="mt-4 grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <legend className="px-1 text-sm font-semibold">Keyboard selection</legend>
      <label className="grid gap-1 text-sm">Horizontal position (%)
        <input aria-label="Horizontal position (%)" type="number" min={0} max={100} step={1} value={keyboardX} onChange={(event) => setKeyboardX(Math.min(100, Math.max(0, Number(event.target.value) || 0)))} className="min-h-10 rounded-md border border-border bg-background px-3" />
      </label>
      <label className="grid gap-1 text-sm">Vertical position (%)
        <input aria-label="Vertical position (%)" type="number" min={0} max={100} step={1} value={keyboardY} onChange={(event) => setKeyboardY(Math.min(100, Math.max(0, Number(event.target.value) || 0)))} className="min-h-10 rounded-md border border-border bg-background px-3" />
      </label>
      <Button type="button" variant="outline" onClick={addKeyboardSelection}>Add selected location</Button>
    </fieldset>
    <p className="mt-3 text-sm" role="status">{selections.length} of {data.totalDifferences} marks selected.</p>
    {showCheckButton ? <Button type="button" className="mt-3" disabled={!selections.length} onClick={() => void onSubmit({
      templateId: "spot-the-difference", roundKey, actionKind: "select", payload: { selections },
    })}>Check my answer</Button> : null}
    {busy ? <p role="status" className="mt-3 text-sm text-muted-foreground">Checking your selections…</p> : null}
  </section>;
}

function LiveTriviaControls({
  roundKey, options, canSubmit, busy, onSubmit,
}: {
  roundKey: string; options: readonly string[]; canSubmit: boolean; busy: boolean;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  const [answer, setAnswer] = useState("");
  return <form className="mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7" onSubmit={(event) => submitModeAction(event, {
    templateId: "live-trivia", roundKey, actionKind: "answer", payload: { answer },
  }, canSubmit, busy, onSubmit)}>
    <fieldset disabled={!canSubmit || busy}>
      <legend className="font-bold">Choose your answer</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => <label key={option} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/50">
          <input type="radio" name="trivia-answer" value={option} checked={answer === option} onChange={() => setAnswer(option)} />
          <span>{option}</span>
        </label>)}
      </div>
      <Button type="submit" className="mt-4" disabled={!answer || !canSubmit || busy}>{busy ? "Sending…" : "Submit answer"}</Button>
    </fieldset>
  </form>;
}

function BingoControls({
  roundKey, card, calledNumbers, canSubmit, busy, onSubmit,
}: {
  roundKey: string; card: readonly (number | "FREE")[]; calledNumbers: readonly number[]; canSubmit: boolean; busy: boolean;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  const [markedNumbers, setMarkedNumbers] = useState<number[]>([]);
  const called = new Set(calledNumbers);
  const toggle = (number: number) => setMarkedNumbers((current) => current.includes(number)
    ? current.filter((item) => item !== number)
    : [...current, number]);
  return <section className="mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7" aria-label="Your Bingo card">
    <h2 className="font-bold">Your card</h2>
    <p className="mt-1 text-sm text-muted-foreground">Mark called numbers, then claim Bingo when a configured pattern is complete.</p>
    <div className="mt-4 grid grid-cols-5 gap-2">
      {card.map((cell, index) => <BingoCardCell key={`${cell}-${index}`} cell={cell} called={called.has(cell as number)} marked={markedNumbers.includes(cell as number)} enabled={canSubmit && !busy} onToggle={toggle} />)}
    </div>
    <Button type="button" className="mt-4" disabled={!canSubmit || busy || markedNumbers.length === 0} onClick={() => void onSubmit({
      templateId: "bingo", roundKey, actionKind: "mark",
      payload: { claim: "bingo", markedNumbers: [...markedNumbers].sort((left, right) => left - right) },
    })}>{busy ? "Checking…" : "Claim Bingo"}</Button>
  </section>;
}

function BingoCardCell({
  cell, called, marked, enabled, onToggle,
}: {
  cell: number | "FREE"; called: boolean; marked: boolean; enabled: boolean; onToggle: (number: number) => void;
}) {
  if (cell === "FREE") return <span aria-label="Free space" className="grid aspect-square place-items-center rounded-md bg-secondary text-xs font-black sm:text-sm">FREE</span>;
  return <button type="button" aria-pressed={marked} disabled={!enabled || !called} onClick={() => onToggle(cell)} className="aspect-square rounded-md border border-border text-sm font-bold enabled:hover:bg-secondary disabled:opacity-40 aria-pressed:bg-primary aria-pressed:text-primary-foreground">{cell}</button>;
}

function GuessPictureControls({
  roundKey, stage, totalStages, mediaUrl, mediaError, canSubmit, busy, onSubmit,
}: {
  roundKey: string; stage: number; totalStages: number; mediaUrl: string | null; mediaError: string | null; canSubmit: boolean; busy: boolean;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  const [answer, setAnswer] = useState("");
  const revealStage = stage;
  const revealStages = Math.max(1, totalStages);
  const visibleWidth = Math.min(100, Math.max(1, Math.round((revealStage / revealStages) * 100)));
  return <form className="mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7" onSubmit={(event) => submitModeAction(event, {
    templateId: "guess-picture", roundKey, actionKind: "guess", payload: { answer },
  }, canSubmit, busy, onSubmit)}>
    <h2 className="font-bold">Revealed picture · Stage {revealStage} of {revealStages}</h2>
    {mediaUrl ? <div className="mt-3 overflow-hidden rounded-md bg-secondary" aria-label={`Picture reveal stage ${revealStage} of ${revealStages}`}>
      <img src={mediaUrl} alt="Progressively revealed event game picture" data-reveal-stage={revealStage} style={{ clipPath: `inset(0 ${100 - visibleWidth}% 0 0)` }} className="block max-h-96 w-full rounded-md object-contain" />
    </div> : <p role={mediaError ? "alert" : "status"} className="mt-3 rounded-md bg-secondary px-3 py-4 text-sm text-muted-foreground">{mediaError ?? "Loading the event picture…"}</p>}
    <label className="mt-4 grid gap-1.5 text-sm font-semibold">Your guess
      <input value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={120} autoComplete="off" className="min-h-11 rounded-md border border-border bg-background px-3" disabled={!canSubmit || busy} />
    </label>
    <Button type="submit" className="mt-3" disabled={!answer.trim() || !canSubmit || busy}>{busy ? "Checking…" : "Submit guess"}</Button>
  </form>;
}

function SpinWheelStatus({ result }: {
  result: Extract<NonNullable<PrismGamePublicState["sessionResult"]>, { kind: "spin-wheel" }> | null;
}) {
  return <section className="mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7" aria-label="Spin the Wheel">
    {result
      ? <div role="status" className="rounded-md bg-secondary p-4"><p className="font-bold">Host result: {result.label}</p><p className="mt-1 text-sm">{result.points} points</p></div>
      : <p role="status" className="text-sm text-muted-foreground">The host will spin the wheel after the game starts.</p>}
  </section>;
}

function PublicLeaderboard({ state }: { state: PrismGamePublicState }) {
  if (!["live-trivia", "bingo", "guess-picture", "spin-wheel", "family-feud"].includes(state.game.kind)) return null;
  const entries = state.leaderboard ?? [];
  return <section className="mt-4 rounded-md border border-border bg-card p-5" aria-label="Live standings">
    <h2 className="font-bold">Live standings</h2>
    {entries.length ? <ol className="mt-3 space-y-2">
      {entries.map((entry) => <li key={`${entry.rank}-${entry.label}`} className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2 text-sm">
        <span>{entry.rank}. {entry.label}{entry.teamLabel && entry.teamLabel !== entry.label ? ` · ${entry.teamLabel}` : ""}</span>
        <strong>{entry.score} points</strong>
      </li>)}
    </ol> : <p className="mt-2 text-sm text-muted-foreground">Standings will appear after points are recorded.</p>}
  </section>;
}

function ThisOrThatControls({ state, roundKey, options, busy, onSubmit }: {
  state: PrismGamePublicState;
  roundKey: string;
  options: readonly string[];
  busy: boolean;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  const [option, setOption] = useState("");
  const canVote = state.status === "live" && !state.participant.hasSubmitted && Boolean(roundKey);
  return <form className="mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7" onSubmit={(event) => submitModeAction(event, {
    templateId: "this-or-that", roundKey, actionKind: "vote", payload: { option },
  }, canVote, busy, onSubmit)}>
    <fieldset disabled={!canVote || busy}>
      <legend className="font-bold">Choose one</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((choice) => <label key={choice} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/50">
          <input type="radio" name="this-or-that-vote" value={choice} checked={option === choice} onChange={() => setOption(choice)} />
          <span>{choice}</span>
        </label>)}
      </div>
      <Button type="submit" className="mt-4" disabled={!option || !canVote || busy}>{busy ? "Sending…" : "Submit vote"}</Button>
    </fieldset>
    <p className="mt-3 text-xs text-muted-foreground">This is a poll. Only the room’s combined totals are shown.</p>
    {state.participant.hasSubmitted ? <p role="status" className="mt-2 text-sm text-muted-foreground">Your vote is recorded.</p> : null}
  </form>;
}

function WouldYouRatherControls({ state, roundKey, data, busy, onSubmit }: {
  state: PrismGamePublicState;
  roundKey: string;
  data: WouldYouRatherData;
  busy: boolean;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  const result = state.participant.result?.kind === "singleplayer-choice" ? state.participant.result : null;
  if (state.participant.hasSubmitted) {
    return <SingleplayerChoiceResult
      label="Would You Rather result"
      resultOption={result?.option}
      privacyMessage={data.aggregateResults ? "Your choice is included in anonymous event poll totals." : "Your choice stays private."}
    />;
  }
  return <WouldYouRatherForm state={state} roundKey={roundKey} data={data} busy={busy} onSubmit={onSubmit} />;
}

function WouldYouRatherForm({ state, roundKey, data, busy, onSubmit }: {
  state: PrismGamePublicState;
  roundKey: string;
  data: WouldYouRatherData;
  busy: boolean;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  const [option, setOption] = useState("");
  const canChoose = state.status === "live" && !state.participant.hasSubmitted && Boolean(roundKey);
  return <form className="mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7" onSubmit={(event) => submitModeAction(event, {
    templateId: "would-you-rather", roundKey, actionKind: data.aggregateResults ? "vote" : "complete", payload: { option },
  }, canChoose, busy, onSubmit)}>
    <fieldset disabled={!canChoose || busy}>
      <legend className="font-bold">Choose what you would rather do</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {data.options.map((choice) => <label key={choice} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/50">
          <input type="radio" name="would-you-rather-choice" value={choice} checked={option === choice} onChange={() => setOption(choice)} />
          <span>{choice}</span>
        </label>)}
      </div>
      <Button type="submit" className="mt-4" disabled={!option || !canChoose || busy}>{busy ? "Sending…" : "Submit choice"}</Button>
    </fieldset>
    <p className="mt-3 text-xs text-muted-foreground">{data.aggregateResults ? "Your choice will appear in anonymous event poll totals." : "Your answer remains private to you."} This game has no points or guest rankings.</p>
  </form>;
}

function ThisOrThatSoloControls({ state, roundKey, data, busy, onSubmit }: {
  state: PrismGamePublicState;
  roundKey: string;
  data: ThisOrThatSoloData;
  busy: boolean;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  const result = state.participant.result?.kind === "singleplayer-choice" ? state.participant.result : null;
  if (state.participant.hasSubmitted) {
    return <SingleplayerChoiceResult
      label="This or That Solo result"
      resultOption={result?.option}
      privacyMessage={state.participant.hasVoted ? "You chose to share it in the anonymous event poll." : "Your choice stayed private."}
    />;
  }
  return <ThisOrThatSoloForm state={state} roundKey={roundKey} data={data} busy={busy} onSubmit={onSubmit} />;
}

function SingleplayerChoiceResult({ label, resultOption, privacyMessage }: {
  label: string;
  resultOption?: string;
  privacyMessage: string;
}) {
  return <section className="mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7" aria-label={label}>
    <p role="status" className="font-semibold">Your choice was recorded{resultOption ? `: ${resultOption}` : ""}.</p>
    <p className="mt-2 text-sm text-muted-foreground">{privacyMessage}</p>
  </section>;
}

function ThisOrThatSoloForm({ state, roundKey, data, busy, onSubmit }: {
  state: PrismGamePublicState;
  roundKey: string;
  data: ThisOrThatSoloData;
  busy: boolean;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  const [option, setOption] = useState("");
  const [shareWithPoll, setShareWithPoll] = useState(false);
  const canChoose = state.status === "live" && !state.participant.hasSubmitted && Boolean(roundKey);
  return <form className="mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7" onSubmit={(event) => submitModeAction(event, {
    templateId: "this-or-that-solo", roundKey, actionKind: shareWithPoll ? "vote" : "complete", payload: { option },
  }, canChoose, busy, onSubmit)}>
    <fieldset disabled={!canChoose || busy}>
      <legend className="font-bold">Your private choice</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {data.options.map((choice) => <label key={choice} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/50">
          <input type="radio" name="this-or-that-solo-choice" value={choice} checked={option === choice} onChange={() => setOption(choice)} />
          <span>{choice}</span>
        </label>)}
      </div>
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={shareWithPoll} onChange={(event) => setShareWithPoll(event.target.checked)} className="mt-1" />
        <span>Share my answer in the anonymous event poll</span>
      </label>
      <Button type="submit" className="mt-4" disabled={!option || !canChoose || busy}>{busy ? "Sending…" : "Submit choice"}</Button>
    </fieldset>
    <p className="mt-3 text-xs text-muted-foreground">Your answer is private unless you opt into the event poll. This game has no points or guest rankings.</p>
  </form>;
}

function FamilyFeudControls({ state, roundKey, teamLabel, busy, onSubmit }: {
  state: PrismGamePublicState;
  roundKey: string;
  teamLabel: string;
  busy: boolean;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  const [answer, setAnswer] = useState("");
  const canAnswer = state.status === "live" && !state.participant.hasSubmitted && Boolean(roundKey);
  return <form className="mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7" onSubmit={(event) => submitModeAction(event, {
    templateId: "family-feud", roundKey, actionKind: "answer", payload: { answer },
  }, canAnswer, busy, onSubmit)}>
    <p className="text-sm font-semibold text-muted-foreground">Your team</p>
    <h2 className="mt-1 font-bold">{teamLabel}</h2>
    <label className="mt-4 grid gap-1.5 text-sm font-semibold">Your answer
      <input value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={120} autoComplete="off" className="min-h-11 rounded-md border border-border bg-background px-3" disabled={!canAnswer || busy} />
    </label>
    <Button type="submit" className="mt-3" disabled={!answer.trim() || !canAnswer || busy}>{busy ? "Sending…" : "Submit answer"}</Button>
    {state.participant.hasSubmitted ? <p role="status" className="mt-3 text-sm text-muted-foreground">Your answer was recorded. The team score follows the host-configured answer board.</p> : null}
  </form>;
}

function SplitTheRoomControls({ state, roundKey, data, busy, onSubmit }: {
  state: PrismGamePublicState;
  roundKey: string;
  data: SplitTheRoomData;
  busy: boolean;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  if (state.participant.hasSubmitted && state.participant.hasVoted) {
    return <SplitTheRoomResult responses={state.approvedResponses} />;
  }
  if (state.participant.hasSubmitted) {
    return <SplitTheRoomVoteControls state={state} roundKey={roundKey} data={data} busy={busy} onSubmit={onSubmit} />;
  }
  return <SplitTheRoomResponseForm state={state} roundKey={roundKey} data={data} busy={busy} onSubmit={onSubmit} />;
}

function SplitTheRoomResult({ responses }: { responses?: readonly string[] }) {
  return <section className="mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7" aria-label="Split the Room result">
    <p role="status" className="font-semibold">Your response and vote are recorded.</p>
    <ApprovedSplitResponses responses={responses} />
  </section>;
}

function SplitTheRoomVoteControls({ state, roundKey, data, busy, onSubmit }: {
  state: PrismGamePublicState;
  roundKey: string;
  data: SplitTheRoomData;
  busy: boolean;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  const canVote = state.status === "live" && !state.participant.hasVoted && Boolean(roundKey);
  return <section className="mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7" aria-label="Vote in Split the Room">
    <h2 className="font-bold">Choose the side you agree with</h2>
    <ApprovedSplitResponses responses={state.approvedResponses} />
    <div className="mt-3 flex flex-wrap gap-2">
      {data.options.map((option) => <Button key={option} type="button" variant="outline" disabled={!canVote || busy} onClick={() => void onSubmit({
        templateId: "split-the-room", roundKey, actionKind: "vote", payload: { option },
      })}>{option}</Button>)}
    </div>
    {!canVote ? <p role="status" className="mt-3 text-sm text-muted-foreground">The host will reveal the room’s combined result after voting closes.</p> : null}
  </section>;
}

function SplitTheRoomResponseForm({ state, roundKey, data, busy, onSubmit }: {
  state: PrismGamePublicState;
  roundKey: string;
  data: SplitTheRoomData;
  busy: boolean;
  onSubmit: (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
}) {
  const [response, setResponse] = useState("");
  const canRespond = state.status === "live" && !state.participant.hasSubmitted && Boolean(roundKey);
  return <form className="mt-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7" onSubmit={(event) => submitModeAction(event, {
    templateId: "split-the-room", roundKey, actionKind: "answer", payload: { response },
  }, canRespond, busy, onSubmit)}>
    <label className="grid gap-1.5 text-sm font-semibold">Your response
      <textarea value={response} onChange={(event) => setResponse(event.target.value)} maxLength={data.maxResponseLength} rows={3} autoComplete="off" className="rounded-md border border-border bg-background px-3 py-2" disabled={!canRespond || busy} />
    </label>
    <p className="mt-1 text-xs text-muted-foreground">Your text stays private to hosts unless approved. Approved responses may be shown after the host pauses the round.</p>
    <Button type="submit" className="mt-3" disabled={!response.trim() || !canRespond || busy}>{busy ? "Sending…" : "Submit response"}</Button>
  </form>;
}

function ApprovedSplitResponses({ responses }: { responses?: readonly string[] }) {
  if (!responses?.length) return null;
  return <section className="mt-4 rounded-md border border-border bg-background p-3" aria-label="Host-approved responses">
    <h3 className="text-sm font-semibold">Host-approved responses</h3>
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
      {responses.map((response, index) => <li key={index} className="whitespace-pre-wrap">{response}</li>)}
    </ul>
  </section>;
}
