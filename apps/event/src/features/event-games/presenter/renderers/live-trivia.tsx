import type { PresenterRenderer } from "../presenter-types";

/**
 * Live Trivia slides. Live: the question, how many people are in the room, and a prompt to answer
 * on their phones. Paused: the revealed answer, large. The answer is never shown while the question
 * is still open.
 */
const LiveTriviaRenderer: PresenterRenderer = ({ state }) => {
  const round = state.currentRound;
  if (!round) return null;

  const revealedAnswer = state.status === "paused" ? round.revealedAnswer : undefined;

  return (
    <section aria-label="Current question" className="flex flex-col items-center gap-8 py-8 text-center">
      <p className="max-w-5xl text-5xl font-bold leading-tight md:text-7xl">{round.prompt}</p>
      {revealedAnswer ? (
        <p className="rounded-3xl bg-emerald-400 px-8 py-6 text-4xl font-bold text-slate-950 md:text-6xl">
          {`Answer: ${revealedAnswer}`}
        </p>
      ) : null}
      <p className="text-3xl text-white/80 md:text-4xl">
        <span className="font-bold tabular-nums text-amber-300">{state.participantCount}</span>{" "}
        {state.participantCount === 1 ? "person" : "people"} in the room
      </p>
      {state.status === "live" ? <p className="text-3xl font-semibold md:text-4xl">Answer on your phone</p> : null}
    </section>
  );
};

export default LiveTriviaRenderer;
