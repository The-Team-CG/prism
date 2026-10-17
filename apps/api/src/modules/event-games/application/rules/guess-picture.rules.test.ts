import { describe, expect, it } from 'vitest';
import { guessPictureRule } from './guess-picture.rules';

const startedAt = new Date('2026-10-17T10:00:00.000Z');
const configuration = {
  mediaObjectIds: ['obj_a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5'],
  configuration: {
    kind: 'guess-picture',
    mediaObjectId: 'obj_a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5',
    acceptedAnswers: ['A cat', 'kitty'],
    stages: [
      { afterSeconds: 0, hint: 'First clue', points: 100 },
      { afterSeconds: 20, hint: 'Second clue', points: 60 },
    ],
  },
};

describe('Guess the Picture rule', () => {
  it('reveals configured hints and an authorized media reference without exposing accepted answers', () => {
    const round = guessPictureRule.getCurrentRound({
      configuration, startedAt, now: new Date(startedAt.getTime() + 25_000), participantKey: 'token-digest',
    });
    expect(round).toMatchObject({
      key: 'picture-1', number: 2, total: 2, prompt: 'Second clue',
      participantData: { kind: 'guess-picture', mediaObjectId: configuration.configuration.mediaObjectId, stage: 2 },
    });
    expect(JSON.stringify(round)).not.toContain('kitty');
    expect(JSON.stringify(round)).not.toContain('A cat');
  });

  it('scores normalized accepted answers using the active reveal stage', () => {
    const currentRound = guessPictureRule.getCurrentRound({
      configuration, startedAt, now: new Date(startedAt.getTime() + 25_000),
    })!;
    const action = {
      templateId: 'guess-picture', roundKey: 'picture-1', actionKind: 'guess',
      payload: { answer: '  KITTY ' },
    } as const;
    expect(guessPictureRule.validateSubmission({ configuration, currentRound, action })).toEqual([]);
    expect(guessPictureRule.scoreSubmission({ configuration, submission: action.payload, currentRound }))
      .toEqual({ points: 60, isCorrect: true });
    expect(guessPictureRule.scoreSubmission({ configuration, submission: { answer: 'dog' }, currentRound }))
      .toEqual({ points: 0, isCorrect: false });
  });
});
