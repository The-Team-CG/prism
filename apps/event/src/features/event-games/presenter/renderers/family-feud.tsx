import type { PresenterRenderer } from "../presenter-types";
import { PresenterSection } from "../presenter-blocks";

/**
 * Family Feud slides. Live: the question and how many people are in the room. The answer board is
 * shown only once paused, so answers are not spoiled while the room is still playing. Live answers
 * awaiting host scoring are never read.
 */
const FamilyFeudRenderer: PresenterRenderer = ({ state }) => {
  const round = state.currentRound;
  if (!round) return null;

  const board = state.status === "paused" ? (round.answerBoard ?? []) : [];

  return (
    <div className="space-y-10">
      <section aria-label="Current question" className="flex flex-col items-center gap-8 py-8 text-center">
        <p className="text-3xl text-white/80 md:text-4xl">
          <span className="font-bold tabular-nums text-amber-300">{state.participantCount}</span>{" "}
          {state.participantCount === 1 ? "person" : "people"} in the room
        </p>
        {state.status === "live" ? <p className="text-3xl font-semibold md:text-4xl">Answer on your phone</p> : null}
      </section>
      {board.length ? (
        <PresenterSection title="Answer board">
          <table className="w-full text-left text-2xl md:text-3xl">
            <thead className="text-white/60">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">#</th>
                <th scope="col" className="py-2 pr-4 font-medium">Answer</th>
                <th scope="col" className="py-2 pr-4 font-medium">Alternatives</th>
                <th scope="col" className="py-2 text-right font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {board.map(({ answer, alternatives, points }, index) => (
                <tr key={`${index}-${answer}`} className="border-t border-white/15">
                  <td className="py-3 pr-4 tabular-nums text-amber-300">{index + 1}</td>
                  <td className="py-3 pr-4 font-semibold">{answer}</td>
                  <td className="py-3 pr-4 text-white/70">{alternatives.length ? alternatives.join(", ") : "None"}</td>
                  <td className="py-3 text-right tabular-nums">{points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PresenterSection>
      ) : null}
    </div>
  );
};

export default FamilyFeudRenderer;
