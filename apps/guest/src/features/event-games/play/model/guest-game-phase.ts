import type { PrismGamePublicState } from "@prism/types";

/**
 * Where a guest is in the current round, which decides what their phone shows:
 * waiting for the host, answering, locked in, answers closed, seeing the reveal, or done.
 */
export type GuestGamePhase = "waiting" | "answering" | "locked" | "closed" | "reveal" | "finished";

type GameKind = PrismGamePublicState["game"]["kind"];

/** Games where a guest earns points, so their score is worth showing. */
const SCORED_KINDS = new Set<GameKind>([
  "live-trivia", "bingo", "guess-picture", "family-feud", "word-scramble", "guess-picture-solo", "spot-the-difference",
]);

/** Shared competitive games that keep a public leaderboard. */
const STANDINGS_KINDS = new Set<GameKind>(["live-trivia", "bingo", "guess-picture", "spin-wheel", "family-feud"]);

export function isScoredGame(kind: GameKind): boolean {
  return SCORED_KINDS.has(kind);
}

/** Answers are closed for the room: the host paused, a results window opened, or the timer ran out. */
function answersClosed(state: PrismGamePublicState, secondsRemaining: number | null): boolean {
  return state.status === "paused" || state.currentRound?.resultsOpen === true || secondsRemaining === 0;
}

export function guestGamePhase(state: PrismGamePublicState, secondsRemaining: number | null): GuestGamePhase {
  if (state.status === "scheduled" || state.status === "lobby") return "waiting";
  if (state.status === "completed" || state.status === "cancelled") return "finished";
  // The server sends a guest's own result only when it may be shown (puzzles at once, shared rounds once closed).
  if (state.participant.roundOutcome) return "reveal";
  if (answersClosed(state, secondsRemaining)) return state.currentRound?.revealedAnswer ? "reveal" : "closed";
  return state.participant.hasSubmitted ? "locked" : "answering";
}

/** Standings are a break between rounds, not a distraction while answering. */
export function showsStandings(state: PrismGamePublicState, phase: GuestGamePhase): boolean {
  if (!STANDINGS_KINDS.has(state.game.kind) || !state.leaderboard?.length) return false;
  return phase === "reveal" || phase === "closed" || phase === "finished";
}
