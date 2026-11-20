import type { PresenterRenderer } from "../presenter-types";
import { PresenterNumberedResponses, PresenterVoteBars } from "../presenter-blocks";

/**
 * Split the Room slides. Live: the prompt and how many people are in the room. Paused: the prompt,
 * the vote totals as bars, and the host-approved answers as a numbered list. Pending text is never read.
 */
const SplitTheRoomRenderer: PresenterRenderer = ({ state }) => {
  const round = state.currentRound;
  if (!round) return null;

  if (state.status === "live") {
    return (
      <section aria-label="Current slide" className="flex flex-col items-center gap-8 py-8 text-center">
        <p className="text-3xl text-white/80 md:text-4xl">
          <span className="font-bold tabular-nums text-amber-300">{state.participantCount}</span>{" "}
          {state.participantCount === 1 ? "person" : "people"} answering on their phones
        </p>
      </section>
    );
  }

  if (state.status !== "paused") return null;

  const aggregateResults = state.aggregateResults ?? [];
  const approvedResponses = round.approvedResponses ?? [];
  return (
    <div className="space-y-10">
      {aggregateResults.length ? <PresenterVoteBars results={aggregateResults} title="How the room split" /> : null}
      {approvedResponses.length ? (
        <PresenterNumberedResponses responses={approvedResponses} title="What the room said" />
      ) : null}
      {!aggregateResults.length && !approvedResponses.length ? (
        <p className="py-8 text-center text-3xl text-white/70">No responses to show for this slide yet.</p>
      ) : null}
    </div>
  );
};

export default SplitTheRoomRenderer;
