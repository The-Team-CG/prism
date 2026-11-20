import type { PresenterRenderer } from "../presenter-types";
import { PresenterVoteBars } from "../presenter-blocks";

/**
 * This or That slides. Live: the prompt and how many people are in the room. Paused: the prompt
 * and the vote totals for each option as large bars. Totals are never shown while live.
 */
const ThisOrThatRenderer: PresenterRenderer = ({ state }) => {
  const round = state.currentRound;
  if (!round) return null;

  if (state.status === "live") {
    return (
      <section aria-label="Current slide" className="flex flex-col items-center gap-8 py-8 text-center">
        <p className="max-w-5xl text-5xl font-bold leading-tight md:text-7xl">{round.prompt}</p>
        <p className="text-3xl text-white/80 md:text-4xl">
          <span className="font-bold tabular-nums text-amber-300">{state.participantCount}</span>{" "}
          {state.participantCount === 1 ? "person" : "people"} answering on their phones
        </p>
      </section>
    );
  }

  if (state.status !== "paused") return null;

  const aggregateResults = state.aggregateResults ?? [];
  return (
    <div className="space-y-10">
      <p className="text-center text-4xl font-bold leading-tight md:text-6xl">{round.prompt}</p>
      {aggregateResults.length ? (
        <PresenterVoteBars results={aggregateResults} title="How the room voted" />
      ) : (
        <p className="py-8 text-center text-3xl text-white/70">No votes to show for this slide yet.</p>
      )}
    </div>
  );
};

export default ThisOrThatRenderer;
