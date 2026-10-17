import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { splitTheRoomRule } from './split-the-room.rules';

const configuration = {
  configuration: {
    kind: 'split-the-room',
    rounds: [{
      key: 'round-1', prompt: 'Would you rather?', leftLabel: 'Left', rightLabel: 'Right',
      maxResponseLength: 160, durationSeconds: 30,
    }],
  },
};
const currentRound = {
  key: 'round-1', number: 1, total: 1, prompt: 'Would you rather?', deadlineAt: new Date('2026-10-17T10:00:30.000Z'),
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T10:00:00.000Z'));
});

afterEach(() => vi.useRealTimers());

describe('Split the Room rule', () => {
  it('accepts bounded text only for moderation and does not score or expose it', () => {
    const action: PrismSubmitEventGameActionInput = {
      templateId: 'split-the-room', roundKey: 'round-1', actionKind: 'answer', payload: { response: 'A short response' },
    };
    expect(splitTheRoomRule.validateSubmission({ configuration, currentRound, action })).toEqual([]);
    expect(splitTheRoomRule.scoreSubmission({ configuration, submission: action.payload })).toEqual({
      points: 0, isCorrect: false,
    });
    expect(splitTheRoomRule.getCurrentRound({
      configuration, startedAt: new Date('2026-10-17T10:00:00.000Z'), now: new Date('2026-10-17T10:00:05.000Z'),
    })?.participantData).toEqual({ kind: 'split-the-room', options: ['Left', 'Right'], maxResponseLength: 160 });
  });

  it('accepts a configured aggregate vote as a separate one-per-token action', () => {
    const action: PrismSubmitEventGameActionInput = {
      templateId: 'split-the-room', roundKey: 'round-1', actionKind: 'vote', payload: { option: 'Left' },
    };
    expect(splitTheRoomRule.validateSubmission({ configuration, currentRound, action })).toEqual([]);
  });

  it('rejects an invalid vote choice and text over the configured bound', () => {
    const invalidVote: PrismSubmitEventGameActionInput = {
      templateId: 'split-the-room', roundKey: 'round-1', actionKind: 'vote', payload: { option: 'Center' },
    };
    const longResponse: PrismSubmitEventGameActionInput = {
      templateId: 'split-the-room', roundKey: 'round-1', actionKind: 'answer', payload: { response: 'x'.repeat(161) },
    };
    expect(splitTheRoomRule.validateSubmission({ configuration, currentRound, action: invalidVote })).not.toEqual([]);
    expect(splitTheRoomRule.validateSubmission({ configuration, currentRound, action: longResponse })).not.toEqual([]);
  });
});
