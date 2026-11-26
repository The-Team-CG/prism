import type { PrismGameHostState } from "@prism/types";
import { GameChoiceGrid } from "@prism/ui/event-games";
import { answersClosedForRoom, type PresenterRenderer } from "../presenter-types";
import { PresenterLeaderboard, PresenterPrompt, PresenterRevealedAnswer } from "../presenter-blocks";

function TriviaChoices({ options, revealedAnswer, results }: {
  options: readonly string[];
  revealedAnswer: string | undefined;
  results: PrismGameHostState["aggregateResults"];
}) {
  if (!options.length) return revealedAnswer ? <PresenterRevealedAnswer answer={revealedAnswer} /> : null;
  return <GameChoiceGrid size="stage" options={options} correctAnswer={revealedAnswer ?? null} counts={revealedAnswer ? results ?? null : null} />;
}

/**
 * Live Trivia slides. While the question is open: the question and the same colour-coded choices guests see on
 * their phones. Once answers close (the results window, or a host pause): the right answer stays lit, the room's
 * answers show as bars, and a pause also brings up the standings. The answer is never shown while open.
 */
const LiveTriviaRenderer: PresenterRenderer = ({ state }) => {
  const round = state.currentRound;
  if (!round) return null;
  const closed = answersClosedForRoom(state);
  const options = round.options ?? [];
  const answering = state.status === "live" && !closed;

  return (
    <div className="space-y-10">
      <PresenterPrompt
        prompt={round.prompt}
        participantCount={answering ? state.participantCount : undefined}
        answeredCount={answering ? round.answeredCount : undefined}
        action={answering ? "Answer on your phone" : null}
        compact={options.length > 0 || closed}
      />
      <TriviaChoices options={options} revealedAnswer={closed ? round.revealedAnswer : undefined} results={state.aggregateResults} />
      {state.status === "paused" && state.leaderboard.length ? <PresenterLeaderboard entries={state.leaderboard} title="Standings" /> : null}
    </div>
  );
};

export default LiveTriviaRenderer;
