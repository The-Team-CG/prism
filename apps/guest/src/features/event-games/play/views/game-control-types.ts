import type { PrismGamePublicState, PrismSubmitEventGameActionInput } from "@prism/types";

export type SubmitGameAction = (action: PrismSubmitEventGameActionInput) => Promise<PrismGamePublicState | null>;
export type GameData = NonNullable<PrismGamePublicState["participant"]["gameData"]>;
export type GameDataOf<K extends GameData["kind"]> = Extract<GameData, { kind: K }>;

/** What every game's controls receive: the round, whether this guest may still act, and how to send. */
export interface GameControlProps {
  state: PrismGamePublicState;
  roundKey: string;
  /** Live, this guest has not answered this round, and the room's answers are still open. */
  canSubmit: boolean;
  busy: boolean;
  onSubmit: SubmitGameAction;
}

/** The game data for a kind, only when the game really is that kind. */
export function gameDataOf<K extends GameData["kind"]>(state: PrismGamePublicState, kind: K): GameDataOf<K> | null {
  const data = state.participant.gameData;
  return state.game.kind === kind && data?.kind === kind ? data as GameDataOf<K> : null;
}

export const GAME_PANEL = "rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5";
