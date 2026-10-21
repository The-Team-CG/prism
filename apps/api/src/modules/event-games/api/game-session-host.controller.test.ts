import type {
  PrismAssignEventGameAwardInput,
  PrismEventGameResponseHistoryQuery,
  PrismModerateEventGameInput,
  PrismVerifiedEventActor,
} from '@prism/types';
import { describe, expect, it, vi } from 'vitest';
import { GameAwardService } from '../application/game-award.service';
import { GameModerationService } from '../application/game-moderation.service';
import { GameReadModelService } from '../application/game-read-model.service';
import { GameSessionService } from '../application/game-session.service';
import { GameSessionHostController } from './game-session-host.controller';

describe('GameSessionHostController', () => {
  it('passes the verified event actor and validated command inputs to scoped services', async () => {
    const actor = { actorId: 'host-1', actorRole: 'coordinator', role: 'coordinator' } as PrismVerifiedEventActor;
    const query: PrismEventGameResponseHistoryQuery = { limit: 10, cursor: undefined };
    const moderation: PrismModerateEventGameInput = {
      action: 'hide_submission',
      idempotencyKey: '00000000-0000-4000-8000-000000000101',
      submissionId: '00000000-0000-4000-8000-000000000102',
      reason: 'Contains personal information',
    };
    const award: PrismAssignEventGameAwardInput = {
      idempotencyKey: '00000000-0000-4000-8000-000000000101',
      recipient: { type: 'participant', participationGrantId: '00000000-0000-4000-8000-000000000103' },
      awardKind: 'points',
      label: 'Round winner',
      points: 25,
    };
    const getResponseHistory = vi.fn().mockResolvedValue({ sessionId: 'session-1', items: [] });
    const moderate = vi.fn().mockResolvedValue({ id: 'audit-1' });
    const assign = vi.fn().mockResolvedValue({ id: 'award-1' });
    const controller = new GameSessionHostController(
      {} as GameSessionService,
      { getResponseHistory } as unknown as GameReadModelService,
      { moderate } as unknown as GameModerationService,
      { assign } as unknown as GameAwardService,
    );

    await expect(controller.getResponseHistory('event-1', 'session-1', query, actor))
      .resolves.toEqual({ sessionId: 'session-1', items: [] });
    await expect(controller.moderate('event-1', 'session-1', moderation, actor)).resolves.toEqual({ id: 'audit-1' });
    await expect(controller.assignAward('event-1', 'session-1', award, actor)).resolves.toEqual({ id: 'award-1' });

    expect(getResponseHistory).toHaveBeenCalledWith('event-1', 'session-1', actor, query);
    expect(moderate).toHaveBeenCalledWith('event-1', 'session-1', actor, moderation);
    expect(assign).toHaveBeenCalledWith('event-1', 'session-1', actor, award);
  });
});
