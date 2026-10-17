import { describe, expect, it } from 'vitest';
import { createSpinWheelRule } from './spin-wheel.rules';

const startedAt = new Date('2026-10-17T10:00:00.000Z');
const configuration = {
  configuration: {
    kind: 'spin-wheel',
    outcomes: [
      { id: 'small', label: 'Small prize', weight: 1, points: 5, eligible: true },
      { id: 'hidden', label: 'Unavailable prize', weight: 100, points: 50, eligible: false },
      { id: 'large', label: 'Large prize', weight: 2, points: 20, eligible: true },
    ],
  },
};

describe('Spin the Wheel rule', () => {
  it('exposes one host-started round and rejects participant-triggered selections', () => {
    const rule = createSpinWheelRule(() => 0);
    expect(rule.getCurrentRound({ configuration, startedAt, now: startedAt })).toMatchObject({
      key: 'spin-1', number: 1, total: 1, prompt: 'Spin the wheel when the host has started the game.',
    });
    expect(rule.validateSubmission({
      configuration,
      currentRound: { key: 'spin-1', number: 1, total: 1, prompt: 'Spin', deadlineAt: null },
      action: {
        templateId: 'live-trivia', roundKey: 'round-1', actionKind: 'answer',
        payload: { answer: 'A' },
      },
    })).toEqual(['Only the host can select a wheel outcome']);
  });

  it('selects only eligible outcomes for a host command and returns a session-persistable result', () => {
    const rule = createSpinWheelRule(() => 2);
    const result = rule.scoreSubmission({
      configuration,
      submission: {},
    });
    expect(result).toEqual({
      points: 20,
      isCorrect: true,
      result: { kind: 'spin-wheel', outcomeId: 'large', label: 'Large prize', points: 20 },
    });
    expect(result.result?.kind === 'spin-wheel' ? result.result.outcomeId : undefined).not.toBe('hidden');
  });
});
