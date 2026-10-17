import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { thisOrThatRule } from './this-or-that.rules';

const configuration = {
  configuration: {
    kind: 'this-or-that',
    rounds: [{ key: 'round-1', prompt: 'Tea or coffee?', options: ['Tea', 'Coffee'], durationSeconds: 30 }],
  },
};
const currentRound = {
  key: 'round-1', number: 1, total: 1, prompt: 'Tea or coffee?',
  deadlineAt: new Date('2026-10-17T10:00:30.000Z'),
  participantData: { kind: 'this-or-that' as const, options: ['Tea', 'Coffee'] as const },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T10:00:00.000Z'));
});

afterEach(() => vi.useRealTimers());

describe('This or That rule', () => {
  it('provides only the current prompt and two public options', () => {
    expect(thisOrThatRule.getCurrentRound({
      configuration,
      startedAt: new Date('2026-10-17T10:00:00.000Z'),
      now: new Date('2026-10-17T10:00:05.000Z'),
    })).toEqual(currentRound);
  });

  it('accepts one configured vote and awards no individual correctness score', () => {
    const action: PrismSubmitEventGameActionInput = {
      templateId: 'this-or-that', roundKey: 'round-1', actionKind: 'vote', payload: { option: 'Tea' },
    };
    expect(thisOrThatRule.validateSubmission({ configuration, currentRound, action })).toEqual([]);
    expect(thisOrThatRule.scoreSubmission({ configuration, submission: action.payload })).toEqual({
      points: 0, isCorrect: false,
    });
  });

  it('rejects an option outside the configured pair', () => {
    const action: PrismSubmitEventGameActionInput = {
      templateId: 'this-or-that', roundKey: 'round-1', actionKind: 'vote', payload: { option: 'Neither' },
    };
    expect(thisOrThatRule.validateSubmission({ configuration, currentRound, action })).not.toEqual([]);
  });
});
