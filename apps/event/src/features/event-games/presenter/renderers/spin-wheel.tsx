import type { PresenterRenderer } from "../presenter-types";
import { PresenterSessionResult } from "../presenter-blocks";

/**
 * Spin the Wheel slides. While live, the prompt. Once the host has selected the outcome, its label
 * and points, large. Only the server-selected session result is read; nothing else is shown.
 */
const SpinWheelRenderer: PresenterRenderer = ({ state }) => {
  const liveRound = state.status === "live" ? state.currentRound : null;
  const result = state.sessionResult ?? null;
  if (!liveRound && !result) return null;

  return (
    <div className="space-y-10 text-center">
      {liveRound ? (
        <section aria-label="Current spin" className="flex flex-col items-center gap-8 py-8">
          <p className="max-w-5xl text-5xl font-bold leading-tight md:text-7xl">{liveRound.prompt}</p>
        </section>
      ) : null}
      {result ? <PresenterSessionResult result={result} /> : null}
    </div>
  );
};

export default SpinWheelRenderer;
