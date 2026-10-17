import { describe, expect, it } from 'vitest';
import type { GameRuleCurrentRound } from '../../contracts/game-rule.port';
import { bingoRule } from './bingo.rules';

const startedAt = new Date('2026-10-17T10:00:00.000Z');
const configuration = {
  configuration: {
    kind: 'bingo',
    callSequence: Array.from({ length: 75 }, (_, index) => index + 1),
    callIntervalSeconds: 5,
    winPattern: 'line',
    points: 75,
  },
};

function bingoData(round: GameRuleCurrentRound | null) {
  if (round?.participantData?.kind !== 'bingo') throw new Error('Expected a server-issued bingo card');
  return round.participantData;
}

describe('Bingo rule', () => {
  it('issues a stable server-derived card per credential and advances calls on server time', () => {
    const first = bingoRule.getCurrentRound({
      configuration, startedAt, now: new Date(startedAt.getTime() + 12_000), participantKey: 'token-digest-a',
    });
    const sameGuest = bingoRule.getCurrentRound({
      configuration, startedAt, now: new Date(startedAt.getTime() + 12_000), participantKey: 'token-digest-a',
    });
    const otherGuest = bingoRule.getCurrentRound({
      configuration, startedAt, now: new Date(startedAt.getTime() + 12_000), participantKey: 'token-digest-b',
    });

    expect(first?.key).toBe('bingo-claim');
    expect(first?.number).toBe(3);
    expect(first?.participantData).toMatchObject({ kind: 'bingo', calledNumbers: [1, 2, 3] });
    expect(first?.participantData).toEqual(sameGuest?.participantData);
    expect(first?.participantData).not.toEqual(otherGuest?.participantData);
    expect(bingoData(first).card).toHaveLength(25);
  });

  it('verifies a claimed line against the guest card and numbers actually called', () => {
    const currentRound = bingoRule.getCurrentRound({
      configuration, startedAt, now: new Date(startedAt.getTime() + 1_000_000), participantKey: 'token-digest-a',
    })!;
    const card = bingoData(currentRound).card;
    const winningLine = card.slice(0, 5).filter((cell): cell is number => typeof cell === 'number');
    const action = {
      templateId: 'bingo', roundKey: 'bingo-claim', actionKind: 'mark',
      payload: { claim: 'bingo', markedNumbers: winningLine },
    } as const;

    expect(bingoRule.validateSubmission({ configuration, currentRound, action })).toEqual([]);
    expect(bingoRule.scoreSubmission({ configuration, submission: action.payload, currentRound }))
      .toEqual({ points: 75, isCorrect: true });
    expect(bingoRule.validateSubmission({
      configuration,
      currentRound: { ...currentRound, participantData: { ...bingoData(currentRound), calledNumbers: [] } },
      action,
    })).not.toEqual([]);
  });

  it('rejects a claim without a completed configured pattern', () => {
    const currentRound = bingoRule.getCurrentRound({
      configuration, startedAt, now: new Date(startedAt.getTime() + 1_000_000), participantKey: 'token-digest-a',
    })!;
    expect(bingoRule.validateSubmission({
      configuration,
      currentRound,
      action: {
        templateId: 'bingo', roundKey: 'bingo-claim', actionKind: 'mark',
        payload: { claim: 'bingo', markedNumbers: [1, 2, 3] },
      },
    })).not.toEqual([]);
  });
});
