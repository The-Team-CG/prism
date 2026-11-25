import type { PresenterRenderer } from "../presenter-types";
import { PresenterNumberedResponses, PresenterVoteBars } from "../presenter-blocks";
import { AudienceSlide } from "./audience-slide";

/**
 * Split the Room slides. Live: the question and the two sides. Paused: how the room split, and the host-approved
 * answers. Pending text is never read.
 */
const SplitTheRoomRenderer: PresenterRenderer = ({ state }) => {
  const results = state.aggregateResults ?? [];
  const approved = state.currentRound?.approvedResponses ?? [];
  const revealed = results.length || approved.length ? (
    <>
      {results.length ? <PresenterVoteBars results={results} title="How the room split" /> : null}
      {approved.length ? <PresenterNumberedResponses responses={approved} title="What the room said" /> : null}
    </>
  ) : null;
  return (
    <AudienceSlide state={state} showResults={state.status === "paused"} options={state.currentRound?.options} emptyNote="No responses to show for this slide yet.">
      {revealed}
    </AudienceSlide>
  );
};

export default SplitTheRoomRenderer;
