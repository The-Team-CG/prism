import type { PresenterRenderer } from "../presenter-types";
import { PresenterVoteBars } from "../presenter-blocks";
import { AudienceSlide } from "./audience-slide";

/** Live Poll slides: the options while the room votes; the totals as bars once the host pauses. Never totals while live. */
const LivePollRenderer: PresenterRenderer = ({ state }) => {
  const results = state.aggregateResults ?? [];
  return (
    <AudienceSlide state={state} showResults={state.status === "paused"} options={state.currentRound?.options} emptyNote="No votes to show for this poll yet.">
      {results.length ? <PresenterVoteBars results={results} title="Poll results" /> : null}
    </AudienceSlide>
  );
};

export default LivePollRenderer;
