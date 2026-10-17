import type { PrismEventGameKind } from "@prism/types";

export const EVENT_GAME_OPTIONS: ReadonlyArray<{
  kind: PrismEventGameKind;
  label: string;
  entryMode: "active" | "independent";
}> = [
  { kind: "live-trivia", label: "Live Trivia", entryMode: "active" },
  { kind: "bingo", label: "Bingo", entryMode: "active" },
  { kind: "guess-picture", label: "Guess the Picture", entryMode: "active" },
  { kind: "spin-wheel", label: "Spin the Wheel", entryMode: "active" },
  { kind: "this-or-that", label: "This or That", entryMode: "active" },
  { kind: "family-feud", label: "Family Feud", entryMode: "active" },
  { kind: "split-the-room", label: "Split the Room", entryMode: "active" },
  { kind: "word-scramble", label: "Word Scramble", entryMode: "independent" },
  { kind: "would-you-rather", label: "Would You Rather", entryMode: "independent" },
  { kind: "guess-picture-solo", label: "Guess the Picture (Solo)", entryMode: "independent" },
  { kind: "this-or-that-solo", label: "This or That (Solo)", entryMode: "independent" },
  { kind: "spot-the-difference", label: "Spot the Difference", entryMode: "independent" },
];

export function eventGameOption(kind: PrismEventGameKind) {
  return EVENT_GAME_OPTIONS.find((item) => item.kind === kind);
}

export function eventGameModeLabel(entryMode: "active" | "independent"): string {
  return entryMode === "active"
    ? "Active (Multiplayer)"
    : "Independent (Singleplayer)";
}
