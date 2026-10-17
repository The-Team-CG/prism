import { describe, expect, it } from 'vitest';
import { eventGameTemplateConfigurationSchema } from '@prism/types';
import { createDefaultGameRuleRegistry } from '../default-game-rules';

const configuration = {
  mediaObjectIds: [],
  configuration: {
    kind: 'this-or-that-solo',
    rounds: [{ key: 'choice-1', prompt: 'Tea or coffee?', options: ['Tea', 'Coffee'], durationSeconds: 45 }],
  },
};
const startedAt = new Date('2026-10-17T10:00:00.000Z');

describe('This or That (Solo) rule', () => {
  it('keeps a private choice by default and accepts a separate anonymous poll opt-in', () => {
    const rule = createDefaultGameRuleRegistry().get('this-or-that-solo');
    if (!rule) return expect(rule).toBeDefined();
    expect(eventGameTemplateConfigurationSchema.safeParse(configuration.configuration).success).toBe(true);
    expect(rule.validateConfiguration(configuration)).toEqual([]);
    const round = rule.getCurrentRound({ configuration, startedAt, now: startedAt });
    expect(round).toMatchObject({ participantData: { kind: 'this-or-that-solo', options: ['Tea', 'Coffee'] } });
    const privateAction = { templateId: 'this-or-that-solo', roundKey: 'choice-1', actionKind: 'complete', payload: { option: 'Tea' } } as const;
    const sharedAction = { ...privateAction, actionKind: 'vote' } as const;
    expect(rule.validateSubmission({ configuration, currentRound: round!, action: privateAction })).toEqual([]);
    expect(rule.validateSubmission({ configuration, currentRound: round!, action: sharedAction })).toEqual([]);
    expect(rule.validateSubmission({
      configuration, currentRound: round!, action: { ...sharedAction, payload: { option: 'Water' } },
    })).not.toEqual([]);
    expect(rule.scoreSubmission({ configuration, submission: privateAction.payload, currentRound: round! })).toEqual({
      points: 0, isCorrect: false, result: { kind: 'singleplayer-choice', option: 'Tea' },
    });
  });
});
