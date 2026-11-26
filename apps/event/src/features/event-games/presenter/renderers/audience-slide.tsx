import { Children, type ReactNode } from "react";
import type { PrismGameHostState } from "@prism/types";
import { GameChoiceGrid } from "@prism/ui/event-games";
import { PresenterPrompt } from "../presenter-blocks";

/**
 * The shape every audience slide shares. While the room is answering: the question, how many people are in,
 * and (for choice games) the same colour-coded options guests see. Once results may show: the question stays
 * on screen, smaller, above whatever the slide reveals, or a calm note when there is nothing yet.
 */
export function AudienceSlide({ state, showResults, options, emptyNote, children }: {
  state: PrismGameHostState;
  /** Results may show now (the renderer decides, from status and the results window). */
  showResults: boolean;
  options?: readonly string[];
  emptyNote: string;
  /** The revealed content; null or false when there is nothing to show yet. */
  children?: ReactNode;
}) {
  const round = state.currentRound;
  if (!round) return null;
  if (!showResults) {
    if (state.status !== "live") return null;
    return (
      <div className="space-y-10">
        <PresenterPrompt prompt={round.prompt} participantCount={state.participantCount} answeredCount={round.answeredCount} compact={Boolean(options?.length)} />
        {options?.length ? <GameChoiceGrid size="stage" options={options} /> : null}
      </div>
    );
  }
  return (
    <div className="space-y-10">
      <PresenterPrompt prompt={round.prompt} compact />
      {Children.toArray(children).length ? children : <p className="py-8 text-center text-3xl text-white/70">{emptyNote}</p>}
    </div>
  );
}
