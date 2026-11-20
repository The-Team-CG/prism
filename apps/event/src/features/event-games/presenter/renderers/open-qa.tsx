import type { PresenterRenderer } from "../presenter-types";
import { PresenterNumberedResponses } from "../presenter-blocks";

/**
 * Open Q&A slides. Live: the prompt and how many people are in the room. Paused: the prompt and the
 * host-approved questions as a numbered list. Pending questions are never read.
 */
const OpenQaRenderer: PresenterRenderer = ({ state }) => {
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

  const approvedResponses = round.approvedResponses ?? [];
  return (
    <div className="space-y-10">
      {approvedResponses.length ? (
        <PresenterNumberedResponses responses={approvedResponses} title="Questions from the room" />
      ) : (
        <p className="py-8 text-center text-3xl text-white/70">No questions to show for this slide yet.</p>
      )}
    </div>
  );
};

export default OpenQaRenderer;
