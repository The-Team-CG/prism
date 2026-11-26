import type { PresenterRenderer } from "../presenter-types";
import { PresenterNumberedResponses } from "../presenter-blocks";
import { AudienceSlide } from "./audience-slide";

/** Open Q&A slides: the question while the room asks; the host-approved questions once paused. */
const OpenQaRenderer: PresenterRenderer = ({ state }) => {
  const approved = state.currentRound?.approvedResponses ?? [];
  return (
    <AudienceSlide state={state} showResults={state.status === "paused"} emptyNote="No questions to show for this slide yet.">
      {approved.length ? <PresenterNumberedResponses responses={approved} title="Questions from the room" /> : null}
    </AudienceSlide>
  );
};

export default OpenQaRenderer;
