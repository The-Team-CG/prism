"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { PrismGameHostState, PrismGameSessionStatus } from "@prism/types";
import { PresenterLeaderboard } from "./presenter-blocks";
import { presenterRendererFor } from "./presenter-renderers";

const JOINABLE_STATUSES = new Set<PrismGameSessionStatus>(["scheduled", "lobby", "live", "paused"]);

/** Remaining milliseconds until the round deadline, measured on the server's game clock. */
export function remainingRoundMs(
  state: Pick<PrismGameHostState, "status" | "serverTime" | "currentRound">,
  receivedAt: number | null,
  now: number,
): number | null {
  const deadlineAt = state.currentRound?.deadlineAt;
  if (!deadlineAt) return null;
  const deadline = Date.parse(deadlineAt);
  if (Number.isNaN(deadline)) return null;
  const serverTime = state.serverTime ? Date.parse(state.serverTime) : Number.NaN;
  // The server freezes game time while paused, so only a live round keeps counting down locally.
  const elapsed = state.status === "live" && receivedAt !== null ? Math.max(0, now - receivedAt) : 0;
  const reference = Number.isNaN(serverTime) ? now : serverTime + elapsed;
  return Math.max(0, deadline - reference);
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}:${seconds.toString().padStart(2, "0")}` : String(seconds);
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * The longest time seen for this round, so the ring can show how much is left. The client never learns a
 * round's length, only its deadline, so the first reading stands in for it.
 */
function useRoundSpan(roundKey: string | undefined, remaining: number | null): number | null {
  const [span, setSpan] = useState<{ key: string; ms: number } | null>(null);
  // Adjusting state while rendering (rather than in an effect) keeps the first frame of a new round correct.
  if (roundKey && remaining !== null && (span?.key !== roundKey || remaining > span.ms)) setSpan({ key: roundKey, ms: remaining });
  return roundKey && span?.key === roundKey ? span.ms : null;
}

export interface PresenterScreenProps {
  state: PrismGameHostState;
  receivedAt: number | null;
  /** Latest refresh failure while an older state is still on screen. */
  error?: string | null;
  joinUrl: string | null;
  joinError?: string | null;
  pin: string | null;
  issuingPin: boolean;
  pinError?: string | null;
  onIssuePin: () => void;
  /** Signed address of the round's picture (Guess the Picture), once loaded. */
  pictureUrl?: string | null;
}

type JoinProps = Pick<PresenterScreenProps, "joinUrl" | "joinError" | "pin" | "issuingPin" | "pinError" | "onIssuePin">;

/** A quiet control for the presenter only: it sits in the corner so the room's eyes stay on the game. */
function PinButton({ pin, issuingPin, onIssuePin }: Pick<JoinProps, "pin" | "issuingPin" | "onIssuePin">) {
  return (
    <button
      type="button"
      onClick={onIssuePin}
      disabled={issuingPin}
      className="rounded-full border border-white/15 px-3 py-1 text-sm text-white/50 transition hover:border-white/40 hover:text-white disabled:opacity-50"
    >
      {issuingPin ? "Issuing…" : pin ? "Rotate PIN" : "Issue PIN"}
    </button>
  );
}

function JoinCode({ pin }: { pin: string | null }) {
  if (!pin) return <p className="text-2xl font-semibold text-white/60">The game PIN appears here</p>;
  return (
    <p className="font-mono text-7xl font-black tracking-[0.18em] tabular-nums md:text-8xl" aria-label={`Game PIN ${pin.split("").join(" ")}`}>
      {pin}
    </p>
  );
}

/** Before the first round: everything the room needs to get in, as big as possible. */
function JoinPanel(props: JoinProps) {
  const { joinUrl, joinError, pin, pinError } = props;
  return (
    <section aria-label="Join the game" className="mx-auto grid w-full max-w-6xl items-center gap-10 rounded-[2.5rem] bg-white/[0.06] p-8 ring-1 ring-white/10 md:grid-cols-[auto_1fr] md:p-12">
      {joinUrl ? (
        <div className="rounded-3xl bg-white p-5 shadow-2xl">
          <QRCodeSVG value={joinUrl} size={260} level="M" aria-label="QR code to join the game" />
        </div>
      ) : null}
      <div className="grid gap-5">
        <p className="text-4xl font-bold md:text-5xl">Join on your phone</p>
        <p className="text-2xl text-white/70">Scan the code{joinUrl ? <>, or go to <span className="break-all font-semibold text-white">{joinUrl.replace(/^https?:\/\//, "")}</span></> : null}, then enter the PIN.</p>
        {joinError ? <p className="text-xl text-rose-200">{joinError}</p> : null}
        <JoinCode pin={pin} />
        {pinError ? <p role="alert" className="text-lg text-rose-200">{pinError}</p> : null}
        <div><PinButton {...props} /></div>
      </div>
    </section>
  );
}

/** During play: a small join card in the header, so latecomers can still get in. */
function JoinChip(props: JoinProps) {
  const { joinUrl, pin, pinError } = props;
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white/[0.08] px-4 py-3 ring-1 ring-white/10">
      {joinUrl ? <div className="rounded-lg bg-white p-1.5"><QRCodeSVG value={joinUrl} size={64} level="M" aria-label="QR code to join the game" /></div> : null}
      <div className="grid gap-1">
        <p className="text-sm text-white/60">Join with PIN</p>
        {pin ? <p className="font-mono text-3xl font-black tracking-[0.15em] tabular-nums" aria-label={`Game PIN ${pin.split("").join(" ")}`}>{pin}</p> : null}
        <PinButton {...props} />
        {pinError ? <p role="alert" className="text-sm text-rose-200">{pinError}</p> : null}
      </div>
    </div>
  );
}

function progressLabel(state: PrismGameHostState): string | null {
  const round = state.currentRound;
  if (!round) return null;
  if (state.game.kind === "bingo") return null;
  if (round.total <= 1) return null;
  return `${state.game.kind === "live-trivia" ? "Question" : "Round"} ${round.number} of ${round.total}`;
}

function RoundDots({ state }: { state: PrismGameHostState }) {
  const round = state.currentRound;
  if (!round || round.total <= 1 || round.total > 20 || state.game.kind === "bingo") return null;
  return (
    <span className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: round.total }, (_, index) => (
        <span key={index} className={`h-2 w-6 rounded-full ${index < round.number ? "bg-[var(--prism-magenta)]" : "bg-white/15"}`} />
      ))}
    </span>
  );
}

/** A ring that drains as the round runs out, with the seconds in the middle. */
function CountdownRing({ remaining, span, paused }: { remaining: number; span: number | null; paused: boolean }) {
  const fraction = span ? Math.max(0, Math.min(1, remaining / span)) : 1;
  const urgent = remaining > 0 && remaining <= 10_000;
  const circumference = 2 * Math.PI * 44;
  return (
    <div className="relative size-28 shrink-0 md:size-32" aria-label="Time left" role="timer">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
        <circle
          cx="50" cy="50" r="44" fill="none" strokeWidth="9" strokeLinecap="round"
          stroke={urgent ? "var(--prism-orange)" : "#f2b134"}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 250ms linear" }}
        />
      </svg>
      <span className={`absolute inset-0 grid place-items-center font-black tabular-nums ${remaining >= 60_000 ? "text-2xl md:text-3xl" : "text-4xl md:text-5xl"} ${urgent ? "text-[var(--prism-orange)]" : ""}`}>
        {paused ? "II" : formatCountdown(remaining)}
      </span>
    </div>
  );
}

function PresenterHeader({ state, remaining, span, join }: { state: PrismGameHostState; remaining: number | null; span: number | null; join: JoinProps }) {
  const progress = progressLabel(state);
  const showJoinChip = JOINABLE_STATUSES.has(state.status) && Boolean(state.currentRound);
  return (
    <header className="flex flex-wrap items-center justify-between gap-6">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold md:text-4xl">{state.game.title}</h1>
        <div className="flex items-center gap-4 text-xl text-white/70">
          {progress ? <span className="tabular-nums">{progress}</span> : null}
          <RoundDots state={state} />
          {state.status === "paused" ? <span className="rounded-full bg-[#f2b134] px-3 py-0.5 text-base font-semibold text-[var(--prism-ink)]">Paused</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-6">
        {showJoinChip ? <JoinChip {...join} /> : null}
        {remaining !== null ? <CountdownRing remaining={remaining} span={span} paused={state.status === "paused"} /> : null}
      </div>
    </header>
  );
}

function EndedScreen({ state }: { state: PrismGameHostState }) {
  const completed = state.status === "completed";
  return (
    <div className="space-y-12">
      <p role="status" className="text-center text-6xl font-black md:text-8xl">
        {completed ? "That’s a wrap!" : "This game was cancelled."}
      </p>
      {completed && state.leaderboard.length ? <PresenterLeaderboard entries={state.leaderboard} title="Final standings" /> : null}
      {completed && !state.leaderboard.length ? <p className="text-center text-3xl text-white/70">Thanks for playing.</p> : null}
    </div>
  );
}

function WaitingMessage({ status }: { status: PrismGameSessionStatus }) {
  return (
    <p className="text-center text-3xl font-semibold text-white/70 md:text-4xl">
      {status === "scheduled" ? "The game will start soon." : "Get ready, the game is about to begin."}
    </p>
  );
}

function PresenterBody({ state, pictureUrl, join }: { state: PrismGameHostState; pictureUrl?: string | null; join: JoinProps }) {
  if (state.status === "completed" || state.status === "cancelled") return <EndedScreen state={state} />;
  const Renderer = presenterRendererFor(state.game.kind);
  if (!state.currentRound) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-10">
        <JoinPanel {...join} />
        <WaitingMessage status={state.status} />
      </div>
    );
  }
  return <Renderer state={state} pictureUrl={pictureUrl} />;
}

export function PresenterScreen(props: PresenterScreenProps) {
  const { state, receivedAt, error } = props;
  const round = state.currentRound;
  const ticking = state.status === "live" && Boolean(round?.deadlineAt);
  const now = useNow(ticking);
  const remaining = remainingRoundMs(state, receivedAt, now);
  const span = useRoundSpan(round ? `${round.key}:${round.resultsOpen ? "results" : "question"}` : undefined, remaining);
  const join: JoinProps = {
    joinUrl: props.joinUrl, joinError: props.joinError, pin: props.pin, issuingPin: props.issuingPin, pinError: props.pinError, onIssuePin: props.onIssuePin,
  };
  // The results window has its own short clock on the server; the room only needs the question's countdown.
  const showClock = !round?.resultsOpen && state.status !== "completed" && state.status !== "cancelled";

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[var(--prism-ink)] text-white">
      <div aria-hidden="true" className="pointer-events-none fixed -left-40 -top-40 size-[36rem] rounded-full bg-[var(--prism-magenta)] opacity-25 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none fixed -bottom-48 -right-32 size-[40rem] rounded-full bg-[var(--prism-orange)] opacity-20 blur-[140px]" />
      <main className="relative mx-auto flex min-h-full max-w-[1800px] flex-col gap-10 p-6 md:p-10">
        <PresenterHeader state={state} remaining={showClock ? remaining : null} span={span} join={join} />
        {error ? <p role="status" className="rounded-2xl bg-rose-500/20 px-5 py-3 text-lg text-rose-100">{error}</p> : null}
        <div className="flex flex-1 flex-col">
          <PresenterBody state={state} pictureUrl={props.pictureUrl} join={join} />
        </div>
      </main>
    </div>
  );
}
