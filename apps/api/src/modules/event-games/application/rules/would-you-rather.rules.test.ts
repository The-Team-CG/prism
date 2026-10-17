import { describe, expect, it } from 'vitest';
import { eventGameTemplateConfigurationSchema } from '@prism/types';
import { createDefaultGameRuleRegistry } from '../default-game-rules';

const configuration = {
  mediaObjectIds: [],
  configuration: {
    kind: 'would-you-rather',
    rounds: [{ key: 'rather-1', prompt: 'Would you rather?', options: ['Fly', 'Be invisible'], durationSeconds: 45, aggregateResults: false }],
  },
};
const startedAt = new Date('2026-10-17T10:00:00.000Z');

describe('Would You Rather rule', () => {
  it('records a private completion without correctness points and keeps aggregation opt-in by configuration', () => {
    const rule = createDefaultGameRuleRegistry().get('would-you-rather');
    if (!rule) return expect(rule).toBeDefined();
    expect(eventGameTemplateConfigurationSchema.safeParse(configuration.configuration).success).toBe(true);
    expect(rule.validateConfiguration(configuration)).toEqual([]);
    const round = rule.getCurrentRound({ configuration, startedAt, now: new Date(startedAt.getTime() + 1_000) });
    expect(round).toMatchObject({
      key: 'rather-1', prompt: 'Would you rather?',
      participantData: { kind: 'would-you-rather', options: ['Fly', 'Be invisible'], aggregateResults: false },
    });
    const privateAction = { templateId: 'would-you-rather', roundKey: 'rather-1', actionKind: 'complete', payload: { option: 'Fly' } } as const;
    const pollAction = { ...privateAction, actionKind: 'vote' } as const;
    expect(rule.validateSubmission({ configuration, currentRound: round!, action: privateAction })).toEqual([]);
    expect(rule.validateSubmission({ configuration, currentRound: round!, action: pollAction })).not.toEqual([]);
    expect(rule.scoreSubmission({ configuration, submission: privateAction.payload, currentRound: round! })).toEqual({
      points: 0, isCorrect: false, result: { kind: 'singleplayer-choice', option: 'Fly' },
    });
  });

  it('allows aggregate votes only for a round configured to publish anonymous poll totals', () => {
    const rule = createDefaultGameRuleRegistry().get('would-you-rather');
    if (!rule) return expect(rule).toBeDefined();
    const aggregateConfiguration = {
      ...configuration,
      configuration: { ...configuration.configuration, rounds: [{ ...configuration.configuration.rounds[0], aggregateResults: true }] },
    };
    const round = rule.getCurrentRound({ configuration: aggregateConfiguration, startedAt, now: startedAt });
    const vote = { templateId: 'would-you-rather', roundKey: 'rather-1', actionKind: 'vote', payload: { option: 'Be invisible' } } as const;
    expect(rule.validateSubmission({ configuration: aggregateConfiguration, currentRound: round!, action: vote })).toEqual([]);
  });
});
