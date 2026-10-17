import type { PrismEventGameKind } from "@prism/types";

const ACTIVE_MULTIPLAYER_GAME_KINDS = new Set<PrismEventGameKind>([
  "live-trivia",
  "bingo",
  "guess-picture",
  "spin-wheel",
  "this-or-that",
  "family-feud",
  "split-the-room",
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

export function createAnonymousParticipantAlias(seed?: string): string {
  let suffixValue: number;
  if (seed) {
    let hash = 2_166_136_261;
    for (const character of seed) {
      hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619);
    }
    suffixValue = (hash >>> 0) % 10_000;
  } else {
    suffixValue = Math.floor(Math.random() * 10_000);
  }
  const suffix = suffixValue.toString().padStart(4, "0");
  return `Guest ${suffix}`;
}
