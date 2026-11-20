import type { PresenterRenderer } from "../presenter-types";
import { PresenterRevealedAnswer } from "../presenter-blocks";

/**
 * Guess the Picture slides. The picture itself is sent only to guests, so the room screen shows the
 * prompt and how many people are in the room. Once paused, the revealed answer appears if present.
 */
const GuessPictureRenderer: PresenterRenderer = ({ state }) => {
  const round = state.currentRound;
  if (!round) return null;

  const revealedAnswer = state.status === "paused" ? round.revealedAnswer : undefined;

  return (
    <div className="space-y-10">
      <section aria-label="Current picture" className="flex flex-col items-center gap-8 py-8 text-center">
        <p className="text-3xl text-white/80 md:text-4xl">
          <span className="font-bold tabular-nums text-amber-300">{state.participantCount}</span>{" "}
          {state.participantCount === 1 ? "person" : "people"} in the room
        </p>
        {state.status === "live" ? <p className="text-3xl font-semibold md:text-4xl">Guess on your phone</p> : null}
      </section>
      {revealedAnswer ? <PresenterRevealedAnswer answer={revealedAnswer} /> : null}
    </div>
  );
};

export default GuessPictureRenderer;
