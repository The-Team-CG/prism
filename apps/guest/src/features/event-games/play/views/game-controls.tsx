"use client";

import type { ReactElement } from "react";
import type { PrismGamePublicState } from "@prism/types";
import { audienceControls } from "./audience-game-controls";
import { BingoControls } from "./bingo-game-controls";
import { LiveTriviaControls, ThisOrThatControls, ThisOrThatSoloControls, WouldYouRatherControls } from "./choice-game-controls";
import type { GameControlProps } from "./game-control-types";
import { GuessPictureControls, PictureSoloControls, SpotTheDifferenceControls, WordScrambleControls } from "./puzzle-game-controls";
import { FamilyFeudControls, SpinWheelControls, SplitTheRoomControls } from "./team-game-controls";

export interface ActiveGameControlsProps extends Omit<GameControlProps, "roundKey" | "canSubmit"> {
  secondsRemaining: number | null;
  mediaUrl: string | null;
  comparisonMediaUrl: string | null;
  mediaError: string | null;
}

type ControlsProps = GameControlProps & Pick<ActiveGameControlsProps, "mediaUrl" | "comparisonMediaUrl" | "mediaError">;

const CONTROLS: Partial<Record<PrismGamePublicState["game"]["kind"], (props: ControlsProps) => ReactElement | null>> = {
  "live-trivia": LiveTriviaControls,
  bingo: BingoControls,
  "guess-picture": GuessPictureControls,
  "spin-wheel": SpinWheelControls,
  "this-or-that": ThisOrThatControls,
  "family-feud": FamilyFeudControls,
  "split-the-room": SplitTheRoomControls,
  "word-scramble": WordScrambleControls,
  "guess-picture-solo": PictureSoloControls,
  "spot-the-difference": SpotTheDifferenceControls,
  "would-you-rather": WouldYouRatherControls,
  "this-or-that-solo": ThisOrThatSoloControls,
};

/** A guest may act while the game is live, they have not answered this round, and the room's answers are open. */
function guestCanSubmit(state: PrismGamePublicState, roundKey: string, secondsRemaining: number | null): boolean {
  return state.status === "live" && !state.participant.hasSubmitted && Boolean(roundKey)
    && !state.currentRound?.resultsOpen && secondsRemaining !== 0;
}

/** Bingo keeps one card for the whole game, so marks survive each new call; every other game resets per round. */
function controlsKey(state: PrismGamePublicState, roundKey: string): string {
  return state.game.kind === "bingo" ? `bingo-${roundKey}` : `${state.game.kind}-${roundKey}-${state.currentRound?.number ?? 0}`;
}

export function ActiveGameControls({ state, secondsRemaining, ...rest }: ActiveGameControlsProps) {
  const roundKey = state.currentRound?.key ?? "";
  const key = controlsKey(state, roundKey);
  const Controls = CONTROLS[state.game.kind];
  if (Controls) {
    return <Controls key={key} state={state} roundKey={roundKey} canSubmit={guestCanSubmit(state, roundKey, secondsRemaining)} {...rest} />;
  }
  return audienceControls({ state, roundKey, key, busy: rest.busy, onSubmit: rest.onSubmit });
}
