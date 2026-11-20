import type { PresenterRenderer } from "../presenter-types";
import {
  PresenterAnswerBoard,
  PresenterLeaderboard,
  PresenterNumberedResponses,
  PresenterRevealedAnswer,
  PresenterSessionResult,
  PresenterVoteBars,
} from "../presenter-blocks";

/**
 * Fallback body for any kind: shows only room-safe results that the host state already gates
 * (paused totals, approved text, reveals, result, standings). Moderation queues are never read.
 */
const GenericPresenterBody: PresenterRenderer = ({ state }) => {
  const round = state.currentRound;
  const aggregateResults = state.aggregateResults ?? [];
  const approvedResponses = round?.approvedResponses ?? [];
  const sections = [
    aggregateResults.length ? <PresenterVoteBars key="votes" results={aggregateResults} /> : null,
    approvedResponses.length ? <PresenterNumberedResponses key="approved" responses={approvedResponses} /> : null,
    round?.revealedAnswer ? <PresenterRevealedAnswer key="answer" answer={round.revealedAnswer} /> : null,
    // Family Feud hosts get the board while live for adjudication; the room sees it only once paused.
    state.status === "paused" && round?.answerBoard?.length ? <PresenterAnswerBoard key="board" board={round.answerBoard} /> : null,
    state.sessionResult ? <PresenterSessionResult key="result" result={state.sessionResult} /> : null,
    state.leaderboard.length ? <PresenterLeaderboard key="leaderboard" entries={state.leaderboard} /> : null,
  ].filter(Boolean);
  if (!sections.length) return null;
  return <div className="space-y-10">{sections}</div>;
};

export default GenericPresenterBody;
