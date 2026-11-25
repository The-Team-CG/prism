import type { PresenterRenderer } from "../presenter-types";
import { PresenterAnswerBoard, PresenterLeaderboard, PresenterPrompt } from "../presenter-blocks";

/**
 * Family Feud slides. Live: the question and the survey board face down, so the room sees how many answers there
 * are without spoilers. Paused: the tiles flip, top answer first, then the team standings. Host-only alternatives
 * and live answers awaiting scoring are never read.
 */
const FamilyFeudRenderer: PresenterRenderer = ({ state }) => {
  const round = state.currentRound;
  if (!round) return null;
  const revealed = state.status === "paused";
  // Face-down tiles carry no answer text, so the live board only ever reveals how many answers there are.
  const board = (round.answerBoard ?? []).map(({ answer, points }) => ({ answer: revealed ? answer : "", alternatives: [], points: revealed ? points : 0 }));

  return (
    <div className="space-y-10">
      <PresenterPrompt prompt={round.prompt} participantCount={state.participantCount} action={state.status === "live" ? "Answer on your phone" : null} compact={board.length > 0} />
      {board.length ? <PresenterAnswerBoard board={board} revealed={revealed} /> : null}
      {revealed && state.leaderboard.length ? <PresenterLeaderboard entries={state.leaderboard} title="Team standings" /> : null}
    </div>
  );
};

export default FamilyFeudRenderer;
