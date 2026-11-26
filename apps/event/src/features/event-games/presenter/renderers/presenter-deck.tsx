import type { PrismGameHostState } from "@prism/types";
import { answersClosedForRoom, type PresenterRenderer } from "../presenter-types";
import { PresenterSection, PresenterVoteBars } from "../presenter-blocks";
import { PresenterWordCloud } from "../presenter-word-cloud";
import { AudienceSlide } from "./audience-slide";

type Totals = NonNullable<PrismGameHostState["aggregateResults"]>;

/** Rating buckets are the whole numbers 1..n, so their labels give the scale. */
function isRatingScale(results: Totals): boolean {
  return results.length > 1 && results.every(({ label }, index) => label === String(index + 1));
}

function RatingAverage({ results }: { results: Totals }) {
  const votes = results.reduce((sum, { count }) => sum + count, 0);
  const average = votes ? results.reduce((sum, { label, count }) => sum + Number(label) * count, 0) / votes : 0;
  return (
    <PresenterSection title="Average rating">
      <p className="text-center">
        <span className="text-[8rem] font-black leading-none tabular-nums text-[#f2b134]">{votes ? average.toFixed(1) : "–"}</span>
        <span className="ml-3 text-5xl font-bold text-white/60">/ {results.length}</span>
      </p>
      <p className="text-center text-2xl text-white/70">{votes} {votes === 1 ? "rating" : "ratings"}</p>
    </PresenterSection>
  );
}

function DeckResults({ results }: { results: Totals }) {
  if (!isRatingScale(results)) return <PresenterVoteBars results={results} title="How the room voted" />;
  return (
    <div className="grid gap-10 lg:grid-cols-[auto_1fr] lg:items-center">
      <RatingAverage results={results} />
      <PresenterVoteBars results={results} title="How the room voted" lettered={false} />
    </div>
  );
}

/**
 * Presenter Deck slides. Word-cloud prompts show approved words whenever the server sends them, live or paused.
 * Choice and rating prompts show their totals in the slide's results window or after a pause, with the question
 * kept on screen; rating slides lead with the average. The server decides visibility; pending text is never read.
 */
const PresenterDeckRenderer: PresenterRenderer = ({ state }) => {
  const approved = state.currentRound?.approvedResponses ?? [];
  const results = state.aggregateResults ?? [];
  const showResults = approved.length > 0 || results.length > 0 || answersClosedForRoom(state);
  return (
    <AudienceSlide state={state} showResults={showResults} options={state.currentRound?.options} emptyNote="No responses to show for this slide yet.">
      {approved.length ? <PresenterWordCloud responses={approved} title="What the room said" /> : null}
      {!approved.length && results.length ? <DeckResults results={results} /> : null}
    </AudienceSlide>
  );
};

export default PresenterDeckRenderer;
