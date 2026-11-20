import type { PresenterRenderer } from "../presenter-types";
import { PresenterVoteBars, PresenterWordCloud } from "../presenter-blocks";

/**
 * Presenter Deck slides. Word-cloud rounds show approved words whenever the server sends them,
 * live or paused. Choice and scale rounds show vote totals in the slide's results window or after
 * a host pause. While the question is open: the prompt and how many people are in the room.
 * The server decides visibility; pending moderation text is never read here.
 */
const PresenterDeckRenderer: PresenterRenderer = ({ state }) => {
  const approvedResponses = state.currentRound?.approvedResponses ?? [];
  if (approvedResponses.length) {
    return <PresenterWordCloud responses={approvedResponses} title="What the room said" />;
  }

  const round = state.currentRound;
  if (!round) return null;
  if (state.status !== "live" && state.status !== "paused") return null;

  const aggregateResults = state.aggregateResults ?? [];
  if (aggregateResults.length) {
    return <PresenterVoteBars results={aggregateResults} title="How the room voted" />;
  }

  if (state.status === "live" && !round.resultsOpen) {
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

  return <p className="py-8 text-center text-3xl text-white/70">No responses to show for this slide yet.</p>;
};

export default PresenterDeckRenderer;
