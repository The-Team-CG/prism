import { describe, expect, it } from 'vitest';
import { createDefaultGameRuleRegistry } from '../default-game-rules';

const configuration = {
  configuration: {
    kind: 'word-scramble',
    rounds: [
      { key: 'word-1', scrambledWord: 'SACRIT', answer: 'ARCTIC', points: 30, durationSeconds: 60 },
      { key: 'word-2', scrambledWord: 'TCAF', answer: 'FACT', points: 20, durationSeconds: 30 },
    ],
  },
};
const startedAt = new Date('2026-10-17T10:00:00.000Z');

describe('Word Scramble rule', () => {
  it('uses server time, hides answer keys, normalizes answers, and records only configured points', () => {
    const rule = createDefaultGameRuleRegistry().get('word-scramble');
    if (!rule) return expect(rule).toBeDefined();
    const round = rule.getCurrentRound({
      configuration, startedAt, now: new Date(startedAt.getTime() + 10_000), participantKey: 'participant-a',
    });
    expect(round).toMatchObject({ key: 'word-1', number: 1, total: 2, prompt: 'SACRIT', deadlineAt: new Date(startedAt.getTime() + 60_000) });
    expect(JSON.stringify(round)).not.toContain('ARCTIC');
    const action = { templateId: 'word-scramble', roundKey: 'word-1', actionKind: 'answer', payload: { answer: 'arctic ' } } as const;
    expect(rule.validateSubmission({ configuration, currentRound: round!, action })).toEqual([]);
    expect(rule.scoreSubmission({ configuration, submission: action.payload, currentRound: round! }))
      .toEqual({ points: 30, isCorrect: true });
    expect(rule.scoreSubmission({ configuration, submission: { answer: 'wrong' }, currentRound: round! }))
      .toEqual({ points: 0, isCorrect: false });
  });

  it('closes the current round at its configured server deadline', () => {
    const rule = createDefaultGameRuleRegistry().get('word-scramble');
    if (!rule) return expect(rule).toBeDefined();
    expect(rule.getCurrentRound({ configuration, startedAt, now: new Date(startedAt.getTime() + 90_000) })).toBeNull();
  });
});
