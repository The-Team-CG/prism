import { describe, expect, it } from 'vitest';
import { eventGameTemplateConfigurationSchema } from '@prism/types';
import { createDefaultGameRuleRegistry } from '../default-game-rules';
import { templateConfiguration } from './template-configuration';

const mediaObjectId = 'obj_00000000-0000-4000-8000-000000000101';
const configuration = {
  mediaObjectIds: [mediaObjectId],
  configuration: {
    kind: 'guess-picture-solo',
    rounds: [{
      key: 'picture-1', mediaObjectId, acceptedAnswers: ['Arctic fox'], durationSeconds: 90,
      stages: [
        { afterSeconds: 0, hint: 'A winter animal', points: 50 },
        { afterSeconds: 30, hint: 'It has a white coat', points: 25 },
      ],
    }],
  },
};
const startedAt = new Date('2026-10-17T10:00:00.000Z');

describe('Guess the Picture (Solo) rule', () => {
  it('keeps answer keys private and advances reveal stages using server time', () => {
    const rule = createDefaultGameRuleRegistry().get('guess-picture-solo');
    if (!rule) return expect(rule).toBeDefined();
    expect(eventGameTemplateConfigurationSchema.safeParse(configuration.configuration).success).toBe(true);
    expect(templateConfiguration(configuration, 'guess-picture-solo')).not.toBeNull();
    expect(rule.validateConfiguration(configuration)).toEqual([]);
    const round = rule.getCurrentRound({ configuration, startedAt, now: new Date(startedAt.getTime() + 35_000), participantKey: 'participant-a' });
    expect(round).toMatchObject({
      key: 'picture-1', number: 1, total: 1, prompt: 'It has a white coat',
      participantData: { kind: 'guess-picture-solo', mediaObjectId, stage: 2, totalStages: 2 },
    });
    expect(JSON.stringify(round)).not.toContain('Arctic fox');
    const action = { templateId: 'guess-picture-solo', roundKey: 'picture-1', actionKind: 'answer', payload: { answer: ' ARCTIC FOX ' } } as const;
    expect(rule.validateSubmission({ configuration, currentRound: round!, action })).toEqual([]);
    expect(rule.scoreSubmission({ configuration, submission: action.payload, currentRound: round! }))
      .toEqual({ points: 25, isCorrect: true });
  });

  it('requires each configured image to belong to the event game media set', () => {
    const rule = createDefaultGameRuleRegistry().get('guess-picture-solo');
    if (!rule) return expect(rule).toBeDefined();
    expect(rule.validateConfiguration({ ...configuration, mediaObjectIds: [] })).not.toEqual([]);
  });
});
