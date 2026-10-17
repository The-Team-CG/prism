import { describe, expect, it, vi } from 'vitest';
import type { GameRuleDefinition } from '../contracts/game-rule.port';
import { GameRuleRegistry } from './game-rule-registry';

const triviaRule: GameRuleDefinition = {
  templateId: 'live-trivia',
  validateConfiguration: vi.fn().mockReturnValue([]),
  getCurrentRound: vi.fn().mockReturnValue(null),
  validateSubmission: vi.fn().mockReturnValue([]),
  scoreSubmission: vi.fn().mockReturnValue({ points: 10, isCorrect: true }),
};

describe('GameRuleRegistry', () => {
  it('returns only a registered rule for the requested template', () => {
    const registry = new GameRuleRegistry();

    expect(registry.get('live-trivia')).toBeUndefined();
    registry.register(triviaRule);
    expect(registry.get('live-trivia')).toBe(triviaRule);
    expect(registry.get('bingo')).toBeUndefined();
  });

  it('refuses to replace a rule already registered for the same template', () => {
    const registry = new GameRuleRegistry();
    registry.register(triviaRule);

    expect(() => registry.register({
      ...triviaRule,
      scoreSubmission: vi.fn().mockReturnValue({ points: 99, isCorrect: true }),
    })).toThrow('Event game rule already registered');
    expect(registry.get('live-trivia')).toBe(triviaRule);
  });
});
