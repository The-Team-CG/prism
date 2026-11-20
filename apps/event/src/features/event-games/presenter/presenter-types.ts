import type { ReactElement } from "react";
import type { PrismGameHostState } from "@prism/types";

/**
 * Every presenter renderer receives the full host state, but must only show room-safe data:
 * never `currentRound.pendingSubmissions` or `currentRound.pendingAnswers` (moderation queues).
 */
export interface PresenterRendererProps {
  state: PrismGameHostState;
}

export type PresenterRenderer = (props: PresenterRendererProps) => ReactElement | null;
