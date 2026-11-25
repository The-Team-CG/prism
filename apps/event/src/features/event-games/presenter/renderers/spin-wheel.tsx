"use client";

import { useState } from "react";
import type { PrismGameSessionResult } from "@prism/types";
import { PrizeWheel } from "@prism/ui/event-games";
import type { PresenterRenderer } from "../presenter-types";
import { PresenterPrompt, PresenterSessionResult } from "../presenter-blocks";

function WheelCaption({ prompt, result, announced }: { prompt: string | null; result: PrismGameSessionResult | null; announced: boolean }) {
  if (result && announced) return <PresenterSessionResult result={result} />;
  if (result) return <p className="text-center text-5xl font-bold text-white/80" role="status">Spinning…</p>;
  return prompt ? <PresenterPrompt prompt={prompt} /> : null;
}

/**
 * Spin the Wheel slides: the wheel, drawn from the eligible outcomes. When the host spins, it turns and lands on the
 * outcome the server already chose, then announces it. A screen opened after the spin shows the result at once.
 */
const SpinWheelRenderer: PresenterRenderer = ({ state }) => {
  const result = state.sessionResult ?? null;
  const [settledId, setSettledId] = useState<string | null>(result?.outcomeId ?? null);
  const segments = state.wheelOutcomes ?? [];
  const liveRound = state.status === "live" ? state.currentRound : null;
  if (!liveRound && !result) return null;
  // Without segments there is nothing to spin, so the result shows straight away.
  const announced = Boolean(result) && (settledId === result?.outcomeId || !segments.length);

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {segments.length ? (
        <PrizeWheel segments={segments} landedId={result?.outcomeId ?? null} className="max-w-2xl" onSettled={() => setSettledId(result?.outcomeId ?? null)} />
      ) : null}
      <WheelCaption prompt={liveRound?.prompt ?? null} result={result} announced={announced} />
    </div>
  );
};

export default SpinWheelRenderer;
