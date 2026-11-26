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

/** Games a guest plays alone on their phone, with no host and no room screen. */
const SOLO_KINDS = new Set<GameKind>([
  "word-scramble", "guess-picture-solo", "spot-the-difference", "would-you-rather", "this-or-that-solo",
]);

/** A guest waiting on the room (locked in, answers closed) only makes sense in a host-led game. */
export function waitsOnRoom(kind: GameKind): boolean {
  return !SOLO_KINDS.has(kind);
}

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
  return doneForThisRound(state) ? "locked" : "answering";
}

/** Split the Room asks for a response and then a vote, so a guest is done only after both. */
function doneForThisRound(state: PrismGamePublicState): boolean {
  if (state.game.kind === "split-the-room") return state.participant.hasSubmitted && state.participant.hasVoted === true;
  return state.participant.hasSubmitted;
}

/** Standings are a break between rounds, not a distraction while answering. */
export function showsStandings(state: PrismGamePublicState, phase: GuestGamePhase): boolean {
  if (!STANDINGS_KINDS.has(state.game.kind) || !state.leaderboard?.length) return false;
  return phase === "reveal" || phase === "closed" || phase === "finished";
}
