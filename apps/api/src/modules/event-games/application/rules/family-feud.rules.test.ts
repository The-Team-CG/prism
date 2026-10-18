import { describe, expect, it } from 'vitest';
import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { familyFeudRule } from './family-feud.rules';

const configuration = {
  configuration: {
    kind: 'family-feud',
    teams: [
      { id: '00000000-0000-4000-8000-000000000101', label: 'Blue' },
      { id: '00000000-0000-4000-8000-000000000102', label: 'Gold' },
    ],
    rounds: [{ key: 'round-1', prompt: 'Name a popular fruit.', durationSeconds: 30, answers: [
      { answer: 'Mango', alternatives: ['Mangga'], points: 10 },
    ] }],
  },
};
const currentRound = {
  key: 'round-1', number: 1, total: 1, prompt: 'Name a popular fruit.', deadlineAt: null,
  teamAssignment: { teamId: '00000000-0000-4000-8000-000000000101', teamLabel: 'Blue' },
};

describe('Family Feud rule', () => {
  it('scores only the configured board answer and leaves alternatives for host adjudication', () => {
    const action: PrismSubmitEventGameActionInput = {
      templateId: 'family-feud', roundKey: 'round-1', actionKind: 'answer', payload: { answer: 'mangga' },
    };
    expect(familyFeudRule.validateSubmission({ configuration, currentRound, action })).toEqual([]);
    expect(familyFeudRule.scoreSubmission({ configuration, submission: action.payload, currentRound })).toEqual({ points: 0, isCorrect: false });
    expect(familyFeudRule.scoreSubmission({
      configuration,
      submission: { answer: 'Mango' },
      currentRound,
    })).toEqual({ points: 10, isCorrect: true });
  });

  it('does not reveal the answer board through participant round data', () => {
    const round = familyFeudRule.getCurrentRound({
      configuration,
      startedAt: new Date('2026-10-17T10:00:00.000Z'),
      now: new Date('2026-10-17T10:00:05.000Z'),
      participantKey: 'participant-token-digest',
    });
    expect(round?.participantData).toMatchObject({ kind: 'family-feud', teamLabel: expect.any(String) });
    expect(JSON.stringify(round?.participantData)).not.toContain('Mango');
    expect(JSON.stringify(round?.participantData)).not.toContain('a78bde2c');
  });

  it('rejects an answer unrelated to the configured board', () => {
    const action: PrismSubmitEventGameActionInput = {
      templateId: 'family-feud', roundKey: 'round-1', actionKind: 'answer', payload: { answer: 'Banana' },
    };
    expect(familyFeudRule.validateSubmission({ configuration, currentRound, action })).toEqual([]);
    expect(familyFeudRule.scoreSubmission({ configuration, submission: action.payload, currentRound })).toEqual({
      points: 0, isCorrect: false,
    });
  });
});
