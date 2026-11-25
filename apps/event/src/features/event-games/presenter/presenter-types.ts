import type { ReactElement } from "react";
import type { PrismGameHostState } from "@prism/types";

/**
 * Every presenter renderer receives the full host state, but must only show room-safe data:
 * never `currentRound.pendingSubmissions` or `currentRound.pendingAnswers` (moderation queues).
 */
export interface PresenterRendererProps {
  state: PrismGameHostState;
  /** Signed address of the round's picture (Guess the Picture), once loaded. */
  pictureUrl?: string | null;
}

export type PresenterRenderer = (props: PresenterRendererProps) => ReactElement | null;

/**
 * The room may see answers and results: the host paused, or the round's results window is open.
 * Renderers check this themselves rather than trusting that the host state left reveals out.
 */
export function answersClosedForRoom(state: PrismGameHostState): boolean {
  return state.status === "paused" || (state.status === "live" && state.currentRound?.resultsOpen === true);
}
