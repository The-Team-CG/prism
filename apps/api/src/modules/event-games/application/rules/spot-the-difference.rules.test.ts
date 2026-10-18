import { describe, expect, it } from 'vitest';
import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { createDefaultGameRuleRegistry } from '../default-game-rules';

const mediaA = 'obj_00000000-0000-4000-8000-000000000101';
const mediaB = 'obj_00000000-0000-4000-8000-000000000102';
const configuration = {
  mediaObjectIds: [mediaA, mediaB],
  configuration: {
    kind: 'spot-the-difference',
    rounds: [{
      key: 'difference-1', originalMediaObjectId: mediaA, comparisonMediaObjectId: mediaB, durationSeconds: 120,
      differences: [
        { x: 0.2, y: 0.3, width: 0.08, height: 0.08, points: 10 },
        { x: 0.7, y: 0.6, width: 0.1, height: 0.12, points: 15 },
      ],
    }],
  },
};
const startedAt = new Date('2026-10-17T10:00:00.000Z');

describe('Spot the Difference rule', () => {
  it('validates selections on the server, awards each target at most once, and keeps geometry private', () => {
    const rule = createDefaultGameRuleRegistry().get('spot-the-difference');
    if (!rule) return expect(rule).toBeDefined();
    expect(rule.validateConfiguration(configuration)).toEqual([]);
    const round = rule.getCurrentRound({ configuration, startedAt, now: new Date(startedAt.getTime() + 10_000), participantKey: 'participant-a' });
    expect(round).toMatchObject({
      key: 'difference-1', deadlineAt: new Date(startedAt.getTime() + 120_000),
      participantData: { kind: 'spot-the-difference', originalMediaObjectId: mediaA, comparisonMediaObjectId: mediaB, totalDifferences: 2 },
    });
    expect(JSON.stringify(round)).not.toContain('0.2');
    const action: Extract<PrismSubmitEventGameActionInput, { templateId: 'spot-the-difference' }> = {
      templateId: 'spot-the-difference', roundKey: 'difference-1', actionKind: 'select',
      payload: { selections: [{ x: 0.21, y: 0.31 }, { x: 0.22, y: 0.32 }, { x: 0.75, y: 0.65 }] },
    };
    expect(rule.validateSubmission({ configuration, currentRound: round!, action })).toEqual([]);
    expect(rule.scoreSubmission({ configuration, submission: action.payload, currentRound: round! }))
      .toEqual({ points: 25, isCorrect: true });
    expect(rule.scoreSubmission({ configuration, submission: { selections: [{ x: 0.5, y: 0.5 }] }, currentRound: round! }))
      .toEqual({ points: 0, isCorrect: false });
  });

  it('requires the approved original and comparison images to be linked to the event game', () => {
    const rule = createDefaultGameRuleRegistry().get('spot-the-difference');
    if (!rule) return expect(rule).toBeDefined();
    expect(rule.validateConfiguration({ ...configuration, mediaObjectIds: [mediaA] })).not.toEqual([]);
  });
});
