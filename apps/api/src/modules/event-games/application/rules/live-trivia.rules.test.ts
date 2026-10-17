import { describe, expect, it } from 'vitest';
import { liveTriviaRule } from './live-trivia.rules';

const startedAt = new Date('2026-10-17T10:00:00.000Z');
const configuration = {
  description: 'Opening round',
  configuration: {
    kind: 'live-trivia',
    rounds: [
      { key: 'q1', prompt: 'Pick one', options: ['A', 'B'], correctAnswer: 'B', points: 100, durationSeconds: 30, speedBonusPoints: 20 },
      { key: 'q2', prompt: 'Second question', options: ['C', 'D'], correctAnswer: 'D', points: 50, durationSeconds: 20 },
    ],
  },
};

describe('Live Trivia rule', () => {
  it('advances timed prompts using server timestamps and closes after the final round', () => {
    expect(liveTriviaRule.getCurrentRound({
      configuration, startedAt, now: new Date(startedAt.getTime() + 35_000),
    })).toMatchObject({ key: 'q2', number: 2, total: 2, prompt: 'Second question' });
    expect(liveTriviaRule.getCurrentRound({
      configuration, startedAt, now: new Date(startedAt.getTime() + 50_000),
    })).toBeNull();
  });

  it('checks the configured answer and applies server-timed speed points without client timing', () => {
    const currentRound = {
      key: 'q1', number: 1, total: 2, prompt: 'Pick one',
      deadlineAt: new Date(startedAt.getTime() + 30_000),
    };
    const correctAction = {
      templateId: 'live-trivia', roundKey: 'q1', actionKind: 'answer',
      payload: { answer: 'B' },
    } as const;

    expect(liveTriviaRule.validateSubmission({ configuration, currentRound, action: correctAction })).toEqual([]);
    expect(liveTriviaRule.validateSubmission({
      configuration, currentRound, action: { ...correctAction, templateId: 'bingo' } as never,
    })).not.toEqual([]);
    expect(liveTriviaRule.scoreSubmission({
      configuration,
      submission: correctAction.payload,
      currentRound,
      submittedAt: new Date(startedAt.getTime() + 10_000),
    })).toEqual({ points: 113, isCorrect: true });
    expect(liveTriviaRule.scoreSubmission({
      configuration,
      submission: { answer: 'A' },
      currentRound,
      submittedAt: new Date(startedAt.getTime() + 10_000),
    })).toEqual({ points: 0, isCorrect: false });
  });

  it('gives every correct response the same round points so score ties remain ties', () => {
    const currentRound = { key: 'q1', number: 1, total: 2, prompt: 'Pick one', deadlineAt: null };
    expect(liveTriviaRule.scoreSubmission({ configuration, submission: { answer: 'B' }, currentRound }))
      .toEqual(liveTriviaRule.scoreSubmission({ configuration, submission: { answer: 'b' }, currentRound }));
  });
});
