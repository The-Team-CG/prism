import type { ReactNode } from "react";
import type { PrismGamePublicState } from "@prism/types";
import { CheckCircle2, Clock3, Hourglass, PartyPopper, Trophy, XCircle } from "lucide-react";
import { GameStandings } from "@prism/ui/event-games";
import type { GuestGamePhase } from "../model/guest-game-phase";

function PhaseBanner({ tone, icon, title, children }: { tone: "good" | "bad" | "calm"; icon: ReactNode; title: string; children?: ReactNode }) {
  const tones = {
    good: "bg-[var(--prism-success)] text-white",
    bad: "bg-[var(--prism-ink)] text-white",
    calm: "bg-card text-foreground border border-border",
  } as const;
  return (
    <section role="status" aria-live="polite" className={`flex items-center gap-4 rounded-3xl px-5 py-4 shadow-sm ${tones[tone]}`}>
      <span className="shrink-0" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="font-heading text-xl font-bold leading-tight">{title}</p>
        {children ? <div className="mt-0.5 text-sm opacity-90">{children}</div> : null}
      </div>
    </section>
  );
}

function outcomeTitle(kind: PrismGamePublicState["game"]["kind"], outcome: NonNullable<PrismGamePublicState["participant"]["roundOutcome"]>): string {
  if (outcome.isCorrect) return kind === "bingo" ? "Bingo!" : "Correct!";
  return outcome.points > 0 ? "Good try" : "Not this time";
}

function OutcomeDetail({ outcome, revealedAnswer }: {
  outcome: NonNullable<PrismGamePublicState["participant"]["roundOutcome"]>;
  revealedAnswer?: string;
}) {
  const lines = [
    outcome.points > 0 ? `+${outcome.points} points` : null,
    !outcome.isCorrect && revealedAnswer ? `The answer was ${revealedAnswer}.` : null,
  ].filter(Boolean);
  return lines.length ? <p>{lines.join(" ")}</p> : null;
}

/** The moment a guest finds out how they did: their result, or the answer if they did not play the round. */
export function RevealBanner({ state }: { state: PrismGamePublicState }) {
  const outcome = state.participant.roundOutcome;
  const revealedAnswer = state.currentRound?.revealedAnswer;
  if (outcome) {
    return (
      <PhaseBanner
        tone={outcome.isCorrect ? "good" : "bad"}
        icon={outcome.isCorrect ? <CheckCircle2 className="size-10" /> : <XCircle className="size-10" />}
        title={outcomeTitle(state.game.kind, outcome)}
      >
        <OutcomeDetail outcome={outcome} revealedAnswer={revealedAnswer} />
      </PhaseBanner>
    );
  }
  return (
    <PhaseBanner tone="calm" icon={<Clock3 className="size-9 text-muted-foreground" />} title="Time’s up">
      {revealedAnswer ? <p>The answer was <strong>{revealedAnswer}</strong>.</p> : null}
    </PhaseBanner>
  );
}

const STATUS_COPY: Partial<Record<GuestGamePhase, { title: string; detail: string }>> = {
  locked: { title: "Answer locked in", detail: "Hang tight. The answer shows when time runs out." },
  closed: { title: "Answers are closed", detail: "Watch the screen. The game moves on in a moment." },
};

/** Polls and audience games have no right answer, so their waiting line talks about results instead. */
const UNSCORED_STATUS_COPY: Partial<Record<GuestGamePhase, { title: string; detail: string }>> = {
  locked: { title: "You’re in", detail: "Thanks! The room’s results show on the big screen." },
  closed: { title: "Voting is closed", detail: "Watch the screen for the results." },
};

/** A short line under the controls while a guest waits on the room. */
export function PhaseStatus({ phase, paused, scored }: { phase: GuestGamePhase; paused: boolean; scored: boolean }) {
  if (paused && phase !== "reveal") {
    return <PhaseBanner tone="calm" icon={<Hourglass className="size-8 text-muted-foreground" />} title="Paused by the host">The game picks up again shortly.</PhaseBanner>;
  }
  const copy = (scored ? STATUS_COPY : UNSCORED_STATUS_COPY)[phase];
  if (!copy) return null;
  return <PhaseBanner tone="calm" icon={<Hourglass className="size-8 animate-pulse text-muted-foreground" />} title={copy.title}>{copy.detail}</PhaseBanner>;
}

export function WaitingPanel({ alias }: { alias: string | null }) {
  return (
    <section className="grid place-items-center gap-3 rounded-3xl border border-border bg-card px-6 py-10 text-center shadow-sm" role="status">
      <span className="relative grid size-16 place-items-center rounded-full bg-primary-soft text-primary" aria-hidden="true">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <PartyPopper className="size-8" />
      </span>
      <p className="font-heading text-2xl font-bold">You’re in!</p>
      <p className="max-w-xs text-sm text-muted-foreground">Keep this screen open. The first question appears here when the host starts the game.</p>
      {alias ? <p className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">Playing as {alias}</p> : null}
    </section>
  );
}

function ownStanding(state: PrismGamePublicState) {
  return state.leaderboard?.find((entry) => entry.label === state.participant.participantAlias) ?? null;
}

export function FinishedPanel({ state, scored }: { state: PrismGamePublicState; scored: boolean }) {
  const standing = ownStanding(state);
  const cancelled = state.status === "cancelled";
  return (
    <section className="grid place-items-center gap-2 rounded-3xl bg-[var(--prism-ink)] px-6 py-8 text-center text-white shadow-sm" role="status">
      <Trophy className="size-12 text-[#f2b134]" aria-hidden="true" />
      <p className="font-heading text-2xl font-bold">{cancelled ? "This game has ended" : "That’s a wrap!"}</p>
      {scored && !cancelled ? (
        <p className="text-lg">
          You scored <strong className="tabular-nums">{state.participant.score ?? 0}</strong> points
          {standing ? <> and finished <strong>#{standing.rank}</strong></> : null}.
        </p>
      ) : <p className="text-sm text-white/80">Thanks for playing.</p>}
    </section>
  );
}

export function StandingsPanel({ state, title }: { state: PrismGamePublicState; title: string }) {
  return (
    <section className="grid gap-3" aria-label="Live standings">
      <h2 className="px-1 font-heading text-lg font-bold">{title}</h2>
      <GameStandings entries={state.leaderboard ?? []} highlightLabel={state.participant.participantAlias} />
    </section>
  );
}
