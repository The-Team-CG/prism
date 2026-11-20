import type { PresenterRenderer } from "../presenter-types";
import { PresenterSessionResult } from "../presenter-blocks";

/**
 * Spin the Wheel slides. The prompt is shown by the stage. Once the host has selected the outcome,
 * its label and points appear large. Only the server-selected session result is read; nothing else is shown.
 */
const SpinWheelRenderer: PresenterRenderer = ({ state }) => {
  const result = state.sessionResult ?? null;
  if (!result) return null;

  return (
    <div className="space-y-10 text-center">
      <PresenterSessionResult result={result} />
    </div>
  );
};

export default SpinWheelRenderer;
