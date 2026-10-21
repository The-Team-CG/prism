import { InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import type { PrismEventGameKind, PrismSubmitEventGameActionInput } from '@prism/types';
import { describe, expect, it, vi } from 'vitest';
import type { GameRuleRegistryPort } from '../contracts/game-rule.port';
import { GameScoringService } from './game-scoring.service';

const action: PrismSubmitEventGameActionInput = {
  roundKey: 'round-1',
  actionKind: 'answer',
  payload: { answer: 'B' },
};

describe('GameScoringService', () => {
  it('scores only the validated response with the immutable session configuration', () => {
    const rule = {
      scoreSubmission: vi.fn().mockReturnValue({ points: 20, isCorrect: true }),
    };
    const registry: GameRuleRegistryPort = {
      get: vi.fn().mockReturnValue(rule),
      register: vi.fn(),
    };
    const service = new GameScoringService(registry);
    const configuration = { rounds: [{ answer: 'B' }] };

    expect(service.score({
      kind: 'live-trivia',
      configuration,
      action,
    })).toEqual({ points: 20, isCorrect: true });
    expect(registry.get).toHaveBeenCalledWith('live-trivia');
    expect(rule.scoreSubmission).toHaveBeenCalledWith({
      configuration,
      submission: { answer: 'B' },
    });
  });

  it('fails closed when the template has no registered server rule', () => {
    const registry: GameRuleRegistryPort = {
      get: vi.fn().mockReturnValue(undefined),
      register: vi.fn(),
    };
    const service = new GameScoringService(registry);

    expect(() => service.score({
      kind: 'word-scramble',
      configuration: {},
      action,
    })).toThrow(ServiceUnavailableException);
  });

  it.each([
    { points: -1, isCorrect: true },
    { points: 1.5, isCorrect: true },
    { points: Number.MAX_SAFE_INTEGER + 1, isCorrect: true },
    { points: 10, isCorrect: 'yes' },
  ])('rejects invalid rule score output %#', (outcome) => {
    const registry: GameRuleRegistryPort = {
      get: vi.fn().mockReturnValue({ scoreSubmission: vi.fn().mockReturnValue(outcome) }),
      register: vi.fn(),
    };
    const service = new GameScoringService(registry);

    expect(() => service.score({
      kind: 'live-trivia' as PrismEventGameKind,
      configuration: {},
      action,
    })).toThrow(InternalServerErrorException);
  });
});
