import type { ReactNode } from "react";
import type { PrismGamePublicState } from "@prism/types";
import { ArrowDown, ArrowUp, CheckCircle2, Clock3, Flame, Hourglass, PartyPopper, Trophy, XCircle } from "lucide-react";
import { ConfettiBurst, GameStandings, useCountUp } from "@prism/ui/event-games";
import type { GuestGamePhase } from "../model/guest-game-phase";

function PhaseBanner({ tone, icon, title, children }: { tone: "good" | "bad" | "calm"; icon: ReactNode; title: string; children?: ReactNode }) {
  const tones = {
    good: "bg-[var(--prism-success)] text-white",
    bad: "bg-[var(--prism-ink)] text-white",
    calm: "bg-card text-foreground border border-border",
  } as const;
  return (
    <section role="status" aria-live="polite" className={`relative flex items-center gap-4 rounded-3xl px-5 py-4 shadow-sm ${tones[tone]}`}>
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

type RoundOutcome = NonNullable<PrismGamePublicState["participant"]["roundOutcome"]>;

/** The points landing, counted up, then the right answer for a guest who missed it. */
function OutcomeDetail({ outcome, revealedAnswer }: { outcome: RoundOutcome; revealedAnswer?: string }) {
  const points = useCountUp(outcome.points);
  return (
    <>
      {outcome.points > 0 ? <p className="text-2xl font-black tabular-nums" aria-label={`Plus ${outcome.points} points`}>+{points} points</p> : null}
      {!outcome.isCorrect && revealedAnswer ? <p>The answer was <strong>{revealedAnswer}</strong>.</p> : null}
    </>
  );
}

/** Where the guest stands now: their place, how far they moved this round, and a streak worth celebrating. */
export interface RevealStanding {
  rank: number | null;
  movement: number | null;
}

function StandingLine({ standing, streak }: { standing: RevealStanding; streak?: number }) {
  const { rank, movement } = standing;
  if (rank === null && !(streak && streak > 1)) return null;
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
      {rank !== null ? <span>You’re #{rank}</span> : null}
      {movement ? (
        <span className="inline-flex items-center gap-0.5">
          {movement > 0 ? <ArrowUp className="size-4" aria-hidden="true" /> : <ArrowDown className="size-4" aria-hidden="true" />}
          {Math.abs(movement)} {Math.abs(movement) === 1 ? "place" : "places"}
        </span>
      ) : null}
      {streak && streak > 1 ? <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5"><Flame className="size-4 text-[#f2b134]" aria-hidden="true" />{streak} in a row</span> : null}
    </p>
  );
}

/** The moment a guest finds out how they did: their result, or the answer if they did not play the round. */
export function RevealBanner({ state, standing }: { state: PrismGamePublicState; standing: RevealStanding }) {
  const outcome = state.participant.roundOutcome;
  const revealedAnswer = state.currentRound?.revealedAnswer;
  if (outcome) {
    return (
      <PhaseBanner
        tone={outcome.isCorrect ? "good" : "bad"}
        icon={outcome.isCorrect ? <CheckCircle2 className="size-10" /> : <XCircle className="size-10" />}
        title={outcomeTitle(state.game.kind, outcome)}
      >
        {outcome.isCorrect ? <ConfettiBurst /> : null}
        <OutcomeDetail outcome={outcome} revealedAnswer={revealedAnswer} />
        <StandingLine standing={standing} streak={outcome.streak} />
      </PhaseBanner>
    );
  }
  return (
    <PhaseBanner tone="calm" icon={<Clock3 className="size-9 text-muted-foreground" />} title="Time’s up">
      {revealedAnswer ? <p>The answer was <strong>{revealedAnswer}</strong>.</p> : null}
      <StandingLine standing={standing} />
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

/** The guest's own row in the public standings, matched by the anonymous name the server gave them. */
export function ownStanding(state: PrismGamePublicState) {
  return state.leaderboard?.find((entry) => entry.label === state.participant.participantAlias) ?? null;
}

function FinalScore({ state, rank }: { state: PrismGamePublicState; rank: number | null }) {
  const score = useCountUp(state.participant.score ?? 0, 1200);
  const players = state.leaderboard?.length ?? 0;
  return (
    <>
      <p className="text-5xl font-black tabular-nums text-[#f2b134]" aria-label={`${state.participant.score ?? 0} points`}>{score}</p>
      <p className="text-lg">
        points{rank !== null ? <>, finishing <strong>#{rank}</strong>{players > 1 ? ` of ${players}` : ""}</> : null}
      </p>
    </>
  );
}

export function FinishedPanel({ state, scored }: { state: PrismGamePublicState; scored: boolean }) {
  const rank = ownStanding(state)?.rank ?? null;
  const cancelled = state.status === "cancelled";
  return (
    <section className="relative grid place-items-center gap-1 rounded-3xl bg-[var(--prism-ink)] px-6 py-8 text-center text-white shadow-sm" role="status">
      {rank !== null && rank <= 3 && !cancelled ? <ConfettiBurst /> : null}
      <Trophy className="size-12 text-[#f2b134]" aria-hidden="true" />
      <p className="font-heading text-2xl font-bold">{cancelled ? "This game has ended" : rank === 1 ? "You won!" : "That’s a wrap!"}</p>
      {scored && !cancelled ? <FinalScore state={state} rank={rank} /> : <p className="text-sm text-white/80">Thanks for playing.</p>}
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
