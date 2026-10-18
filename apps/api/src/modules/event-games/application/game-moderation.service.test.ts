import { ConflictException } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PrismVerifiedEventActor } from '@prism/types';
import { describe, expect, it, vi } from 'vitest';
import { GameModerationService } from './game-moderation.service';

const actor: PrismVerifiedEventActor = {
  actorId: 'coordinator-1', actorRole: 'coordinator', email: 'c@example.test',
} as PrismVerifiedEventActor;
const input = {
  action: 'hide_submission', idempotencyKey: '00000000-0000-4000-8000-000000000101',
  submissionId: '00000000-0000-4000-8000-000000000102', reason: 'Contains personal information',
} as const;

function setup(result: unknown = { id: 'moderation-1', targetId: input.submissionId, beforeStatus: 'pending', afterStatus: 'hidden' }) {
  const tx = { prisma: {}, correlationId: 'moderation-test', actorId: actor.actorId } as PrismTransactionContext;
  const eventAccess = { assertHostAccess: vi.fn().mockResolvedValue(undefined), isEventOpen: vi.fn().mockResolvedValue(true) };
  const store = { applyModeration: vi.fn().mockResolvedValue(result) };
  const audit = { recordHostWrite: vi.fn().mockResolvedValue(undefined) };
  const transactions = { run: vi.fn(async (work: (transaction: PrismTransactionContext) => Promise<unknown>) => work(tx)) };
  return { service: new GameModerationService(eventAccess as never, store as never, audit as never, transactions as never), eventAccess, store, audit, transactions, tx };
}

describe('GameModerationService', () => {
  it('scopes the audited hide decision to the verified host, event, and session', async () => {
    const { service, eventAccess, store, audit, tx } = setup();

    await expect(service.moderate('event-1', 'session-1', actor, input)).resolves.toMatchObject({
      id: 'moderation-1', targetId: input.submissionId, afterStatus: 'hidden',
    });
    expect(eventAccess.assertHostAccess).toHaveBeenCalledWith('event-1', actor);
    expect(store.applyModeration).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'event-1', sessionId: 'session-1', actorId: 'coordinator-1',
      request: input,
    }), tx);
    expect(audit.recordHostWrite).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'coordinator-1', actorRole: 'coordinator', action: 'moderate_participant',
      resourceId: input.submissionId, outcome: 'moderated', transition: { beforeStatus: 'pending', afterStatus: 'hidden', beforeVersion: null, afterVersion: null },
    }), tx);
  });

  it('does not audit or report a moderation when the target is outside the session', async () => {
    const { service, store, audit } = setup(null);

    await expect(service.moderate('event-1', 'session-1', actor, input)).rejects.toBeInstanceOf(ConflictException);
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });

  it('keeps post-event review read-only by rejecting moderation after closure', async () => {
    const { service, eventAccess, store, audit } = setup();
    eventAccess.isEventOpen.mockResolvedValue(false);

    await expect(service.moderate('event-1', 'session-1', actor, input)).rejects.toBeInstanceOf(ConflictException);
    expect(store.applyModeration).not.toHaveBeenCalled();
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });
});
