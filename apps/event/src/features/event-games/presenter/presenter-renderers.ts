import type { PrismEventGameKind } from "@prism/types";
import type { PresenterRenderer } from "./presenter-types";
import GenericPresenterBody from "./renderers/generic-presenter-body";
import LiveTriviaPresenter from "./renderers/live-trivia";
import BingoPresenter from "./renderers/bingo";
import GuessPicturePresenter from "./renderers/guess-picture";
import SpinWheelPresenter from "./renderers/spin-wheel";
import ThisOrThatPresenter from "./renderers/this-or-that";
import FamilyFeudPresenter from "./renderers/family-feud";
import SplitTheRoomPresenter from "./renderers/split-the-room";
import LivePollPresenter from "./renderers/live-poll";
import WordCloudPresenter from "./renderers/word-cloud";
import OpenQaPresenter from "./renderers/open-qa";
import PresenterDeckPresenter from "./renderers/presenter-deck";

/** Active (Multiplayer) kinds with a shared host-led session that can be shown on a big screen. */
export type PresenterGameKind = Extract<
  PrismEventGameKind,
  | "live-trivia" | "bingo" | "guess-picture" | "spin-wheel" | "this-or-that" | "family-feud"
  | "split-the-room" | "live-poll" | "word-cloud" | "open-qa" | "presenter-deck"
>;

export const PRESENTER_RENDERERS: Readonly<Record<PresenterGameKind, PresenterRenderer>> = {
  "live-trivia": LiveTriviaPresenter,
  bingo: BingoPresenter,
  "guess-picture": GuessPicturePresenter,
  "spin-wheel": SpinWheelPresenter,
  "this-or-that": ThisOrThatPresenter,
  "family-feud": FamilyFeudPresenter,
  "split-the-room": SplitTheRoomPresenter,
  "live-poll": LivePollPresenter,
  "word-cloud": WordCloudPresenter,
  "open-qa": OpenQaPresenter,
  "presenter-deck": PresenterDeckPresenter,
};

export function presenterRendererFor(kind: string): PresenterRenderer {
  return Object.hasOwn(PRESENTER_RENDERERS, kind)
    ? PRESENTER_RENDERERS[kind as PresenterGameKind]
    : GenericPresenterBody;
}
