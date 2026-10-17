import { describe, expect, it } from 'vitest';
import { createDefaultGameRuleRegistry } from './default-game-rules';

describe('default event game rules', () => {
  it('registers the implemented Active (Multiplayer) and Independent (Singleplayer) templates', () => {
    const registry = createDefaultGameRuleRegistry();

    for (const kind of ['live-trivia', 'bingo', 'guess-picture', 'spin-wheel'] as const) {
      expect(registry.get(kind)?.templateId).toBe(kind);
    }
    for (const kind of ['this-or-that', 'family-feud', 'split-the-room'] as const) {
      expect(registry.get(kind)?.templateId).toBe(kind);
    }
    for (const kind of ['word-scramble', 'guess-picture-solo', 'spot-the-difference', 'would-you-rather', 'this-or-that-solo'] as const) {
      expect(registry.get(kind)?.templateId).toBe(kind);
    }
  });
});
