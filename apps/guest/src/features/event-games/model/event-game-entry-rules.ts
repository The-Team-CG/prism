import type { PrismEventGameKind } from "@prism/types";

const ACTIVE_MULTIPLAYER_GAME_KINDS = new Set<PrismEventGameKind>([
  "live-trivia",
  "bingo",
  "guess-picture",
  "spin-wheel",
  "this-or-that",
  "family-feud",
  "split-the-room",
  "live-poll",
  "word-cloud",
  "open-qa",
]);

export function normalizeGamePin(raw: string): string {
  return raw.replace(/\s/g, "");
}

export function isValidGamePin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export function isActiveMultiplayerGameKind(kind: PrismEventGameKind): boolean {
  return ACTIVE_MULTIPLAYER_GAME_KINDS.has(kind);
}
