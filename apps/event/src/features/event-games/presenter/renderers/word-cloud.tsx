import type { PresenterRenderer } from "../presenter-types";
import { PresenterWordCloud } from "../presenter-blocks";
import { AudienceSlide } from "./audience-slide";

/** Word Cloud slides: the question while the room answers; the host-approved words as a cloud once paused. */
const WordCloudRenderer: PresenterRenderer = ({ state }) => {
  const approved = state.currentRound?.approvedResponses ?? [];
  return (
    <AudienceSlide state={state} showResults={state.status === "paused"} emptyNote="No words to show for this slide yet.">
      {approved.length ? <PresenterWordCloud responses={approved} title="What the room said" /> : null}
    </AudienceSlide>
  );
};

export default WordCloudRenderer;
