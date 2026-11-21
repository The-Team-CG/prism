import type { PresenterRenderer } from "../presenter-types";
import { PresenterLeaderboard } from "../presenter-blocks";

/**
 * Bingo slides. Called numbers are held only on the host console, so the room screen shows the
 * prompt and how many people are playing. Standings appear once the game is paused or finished.
 */
const BingoRenderer: PresenterRenderer = ({ state }) => {
  const round = state.currentRound;
  const showStandings = (state.status === "paused" || state.status === "completed") && state.leaderboard.length > 0;
  if (!round && !showStandings) return null;

  return (
    <div className="space-y-10">
      {round ? (
        <section aria-label="Current game" className="flex flex-col items-center gap-8 py-8 text-center">
          <p className="max-w-5xl text-5xl font-bold leading-tight md:text-7xl">{round.prompt}</p>
          <p className="text-3xl text-white/80 md:text-4xl">
            <span className="font-bold tabular-nums text-amber-300">{state.participantCount}</span>{" "}
            {state.participantCount === 1 ? "person" : "people"} playing
          </p>
          <p className="text-2xl text-white/70 md:text-3xl">Called numbers are on the host console.</p>
        </section>
      ) : null}
      {showStandings ? <PresenterLeaderboard entries={state.leaderboard} /> : null}
    </div>
  );
};

export default BingoRenderer;
