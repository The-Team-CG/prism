import type { GameRuleCurrentRound } from '../../contracts/game-rule.port';

/** Seconds a round's answer or results stay on screen after its question closes, before the next round starts. */
export const RESULTS_DISPLAY_SECONDS = 10;
const RESULTS_DISPLAY_MS = RESULTS_DISPLAY_SECONDS * 1000;

type TimedRound = { durationSeconds: number };
type RoundTiming = Pick<GameRuleCurrentRound, 'number' | 'total' | 'deadlineAt' | 'endsAt' | 'resultsOpen'>;

/**
 * Finds the round playing at `now` on a timeline where each round is its question window followed by a fixed
 * results window. Returns null once the last round's results window has closed.
 */
export function roundWithResultsWindow<R extends TimedRound>(
  rounds: readonly R[],
  startedAt: Date,
  now: Date,
): { round: R; timing: RoundTiming } | null {
  const elapsed = Math.max(0, now.getTime() - startedAt.getTime());
  let elapsedBefore = 0;
  for (const [index, round] of rounds.entries()) {
    const questionMs = round.durationSeconds * 1000;
    const roundMs = questionMs + RESULTS_DISPLAY_MS;
    if (elapsed < elapsedBefore + roundMs) {
      return {
        round,
        timing: {
          number: index + 1,
          total: rounds.length,
          deadlineAt: new Date(startedAt.getTime() + elapsedBefore + questionMs),
          endsAt: new Date(startedAt.getTime() + elapsedBefore + roundMs),
          resultsOpen: elapsed >= elapsedBefore + questionMs,
        },
      };
    }
    elapsedBefore += roundMs;
  }
  return null;
}
