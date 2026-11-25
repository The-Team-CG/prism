import type { PresenterRenderer } from "../presenter-types";
import { PresenterWordCloud } from "../presenter-word-cloud";
import { AudienceSlide } from "./audience-slide";

/** Approved words appear while the room is answering and remain visible when paused. */
const WordCloudRenderer: PresenterRenderer = ({ state }) => {
  const approved = state.currentRound?.approvedResponses ?? [];
  return (
    <AudienceSlide state={state} showResults={approved.length > 0 || state.status === "paused"} emptyNote="No words to show for this slide yet.">
      {approved.length ? <PresenterWordCloud responses={approved} title="What the room said" /> : null}
    </AudienceSlide>
  );
};

export default WordCloudRenderer;
