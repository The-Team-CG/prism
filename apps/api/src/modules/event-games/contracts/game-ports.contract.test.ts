import { describe, expect, it, vi } from 'vitest';
import type { PrismEventGameKind } from '@prism/types';
import type { GameRateLimiterPort } from './game-rate-limiter.port';
import type { GameTemplateId } from './game-rule.port';

describe('event game public port contracts', () => {
  it('uses the shared canonical game kind for solo templates', () => {
    const sharedKind: PrismEventGameKind = 'this-or-that-solo';
    const templateId: GameTemplateId = sharedKind;

    expect(templateId).toBe('this-or-that-solo');
  });

  it('supports pre-token PIN and lobby budgets without receiving a raw PIN or IP', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const limiter: GameRateLimiterPort = {
      consume: vi.fn(async (input) => {
        requests.push(input);
        return { allowed: true };
      }),
    };

    await limiter.consume({
      action: 'pin_attempt',
      sourceFingerprint: 'sha256:source-digest',
      globalBudgetKey: 'event-game:pin-attempts',
    });
    await limiter.consume({
      action: 'failed_pin_attempt',
      sourceFingerprint: 'sha256:source-digest',
      submittedPinDigest: 'sha256:submitted-pin-digest',
      globalBudgetKey: 'event-game:failed-pin-attempts',
    });
    await limiter.consume({
      eventId: 'event-1',
      action: 'join',
      sourceFingerprint: 'sha256:source-digest',
      globalBudgetKey: 'event:event-1:join-attempts',
    });
    await limiter.consume({
      eventId: 'event-1',
      action: 'lobby_start',
      sourceFingerprint: 'sha256:source-digest',
      globalBudgetKey: 'event:event-1:lobby-starts',
    });

    expect(requests).toHaveLength(4);
    expect(JSON.stringify(requests)).toContain('submitted-pin-digest');
    expect(JSON.stringify(requests)).toContain('globalBudgetKey');
    expect(requests[0]).not.toHaveProperty('eventId');
    expect(requests[1]).toMatchObject({ action: 'failed_pin_attempt' });
    expect(JSON.stringify(requests)).not.toMatch(/raw-pin|\bpin\s*[:=]|\bip(?:Address)?\s*[:=]/i);
  });

  it('supports participant-scoped actions after joining', async () => {
    const consume = vi.fn(async () => ({ allowed: true }));
    const limiter: GameRateLimiterPort = { consume };

    await limiter.consume({
      eventId: 'event-1',
      action: 'submit_answer',
      participantTokenId: 'participant-token-id',
    });

    expect(consume).toHaveBeenCalledWith({
      eventId: 'event-1',
      action: 'submit_answer',
      participantTokenId: 'participant-token-id',
    });
  });
});
