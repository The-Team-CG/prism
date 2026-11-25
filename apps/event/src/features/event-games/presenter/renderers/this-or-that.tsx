import type { PresenterRenderer } from "../presenter-types";
import { PresenterVoteBars } from "../presenter-blocks";
import { AudienceSlide } from "./audience-slide";

/** This or That slides: the two options while the room votes; the room's totals once the host pauses. */
const ThisOrThatRenderer: PresenterRenderer = ({ state }) => {
  const results = state.aggregateResults ?? [];
  return (
    <AudienceSlide state={state} showResults={state.status === "paused"} options={state.currentRound?.options} emptyNote="No votes to show for this slide yet.">
      {results.length ? <PresenterVoteBars results={results} title="How the room voted" /> : null}
    </AudienceSlide>
  );
};

export default ThisOrThatRenderer;
