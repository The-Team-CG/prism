"use client";

import { useEffect, useState } from "react";
import type { PrismGameHostState, PrismGameSessionStatus } from "@prism/types";
import { presenterRendererFor } from "./presenter-renderers";

const STATUS_LABELS: Record<PrismGameSessionStatus, string> = {
  scheduled: "Scheduled",
  lobby: "Lobby open",
  live: "Live",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<PrismGameSessionStatus, string> = {
  scheduled: "bg-white/15 text-white",
  lobby: "bg-sky-300 text-slate-950",
  live: "bg-emerald-400 text-slate-950",
  paused: "bg-amber-300 text-slate-950",
  completed: "bg-white text-slate-950",
  cancelled: "bg-rose-400 text-slate-950",
};

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
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
}

/** Game PIN only, shown in the header so the main screen stays full width. */
function PinControl({ pin, issuingPin, pinError, onIssuePin }: Pick<PresenterScreenProps, "pin" | "issuingPin" | "pinError" | "onIssuePin">) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white px-5 py-3 text-slate-950">
      {pin ? (
        <p className="font-mono text-4xl font-bold tracking-[0.15em] tabular-nums md:text-5xl" aria-label={`Game PIN ${pin.split("").join(" ")}`}>
          {pin}
        </p>
      ) : (
        <p className="text-lg font-semibold text-slate-700">No PIN yet</p>
      )}
      <button
        type="button"
        onClick={onIssuePin}
        disabled={issuingPin}
        className="rounded-full bg-slate-950 px-4 py-2 text-base font-semibold text-white disabled:opacity-60"
      >
        {issuingPin ? "Issuing…" : pin ? "Rotate PIN" : "Issue PIN"}
      </button>
      {pinError ? <p role="alert" className="w-full text-sm text-rose-700">{pinError}</p> : null}
    </div>
  );
}

export function PresenterScreen(props: PresenterScreenProps) {
  const { state, receivedAt, error } = props;
  const round = state.currentRound;
  const ticking = state.status === "live" && Boolean(round?.deadlineAt);
  const now = useNow(ticking);
  const remaining = remainingRoundMs(state, receivedAt, now);
  const ended = state.status === "completed" || state.status === "cancelled";
  const Renderer = presenterRendererFor(state.game.kind);

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950 text-white">
      <main className="mx-auto flex min-h-full max-w-[1800px] flex-col gap-8 p-6 md:p-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold md:text-5xl">{state.game.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-xl md:text-2xl">
            {round ? <span className="tabular-nums text-white/80">Round {round.number} of {round.total}</span> : null}
            <span className={`rounded-full px-4 py-1 font-semibold ${STATUS_STYLES[state.status]}`}>{STATUS_LABELS[state.status]}</span>
            <span className="tabular-nums text-white/80">
              {state.participantCount} {state.participantCount === 1 ? "player" : "players"}
            </span>
            {JOINABLE_STATUSES.has(state.status) ? (
              <PinControl pin={props.pin} issuingPin={props.issuingPin} pinError={props.pinError} onIssuePin={props.onIssuePin} />
            ) : null}
          </div>
        </header>

        {error ? <p role="status" className="rounded-2xl bg-rose-500/20 px-5 py-3 text-lg text-rose-100">{error}</p> : null}

        {ended ? (
          <p role="status" className="rounded-3xl bg-white/10 px-8 py-6 text-center text-4xl font-bold md:text-6xl">
            {state.status === "completed" ? "This game has finished. Thanks for playing!" : "This game was cancelled."}
          </p>
        ) : null}

        <div className="flex flex-1 flex-col gap-8">
          <div className="flex-1 space-y-10">
            {round && !ended ? (
              <div className="space-y-4">
                <p className="text-4xl font-bold leading-tight md:text-6xl">{round.prompt}</p>
                {remaining !== null ? (
                  <p aria-label="Time left" className="text-5xl font-bold tabular-nums text-amber-300 md:text-7xl">
                    {formatCountdown(remaining)}
                  </p>
                ) : null}
              </div>
            ) : null}
            {!round && !ended ? (
              <p className="text-4xl font-semibold text-white/80 md:text-5xl">
                {state.status === "scheduled" ? "The game will start soon." : "Get ready, the game is about to begin."}
              </p>
            ) : null}
            {state.status === "cancelled" ? null : <Renderer state={state} />}
          </div>
        </div>
      </main>
    </div>
  );
}
