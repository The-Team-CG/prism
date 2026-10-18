import { ConflictException } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PrismVerifiedEventActor } from '@prism/types';
import { describe, expect, it, vi } from 'vitest';
import { GameAwardService } from './game-award.service';

const actor: PrismVerifiedEventActor = {
  actorId: 'admin-1', actorRole: 'pmcm_admin', email: 'admin@example.test',
} as unknown as PrismVerifiedEventActor;
const input = {
  idempotencyKey: '00000000-0000-4000-8000-000000000101',
  recipient: { type: 'participant', participationGrantId: '00000000-0000-4000-8000-000000000102' },
  awardKind: 'points', label: 'Round winner', points: 25,
} as const;

function setup(result: unknown = { id: 'award-1', label: 'Round winner', points: 25 }) {
  const tx = { prisma: {}, correlationId: 'award-test', actorId: actor.actorId } as PrismTransactionContext;
  const eventAccess = { assertHostAccess: vi.fn().mockResolvedValue(undefined), isEventOpen: vi.fn().mockResolvedValue(true) };
  const store = { assignAward: vi.fn().mockResolvedValue(result) };
  const audit = { recordHostWrite: vi.fn().mockResolvedValue(undefined) };
  const transactions = { run: vi.fn(async (work: (transaction: PrismTransactionContext) => Promise<unknown>) => work(tx)) };
  return { service: new GameAwardService(eventAccess as never, store as never, audit as never, transactions as never), eventAccess, store, audit, tx };
}

describe('GameAwardService', () => {
  it('verifies host scope, persists an event record, and audits the award', async () => {
    const { service, eventAccess, store, audit, tx } = setup();

    await expect(service.assign('event-1', 'session-1', actor, input)).resolves.toMatchObject({
      id: 'award-1', label: 'Round winner', points: 25,
    });
    expect(eventAccess.assertHostAccess).toHaveBeenCalledWith('event-1', actor);
    expect(store.assignAward).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'event-1', sessionId: 'session-1', actorId: 'admin-1', request: input,
    }), tx);
    expect(audit.recordHostWrite).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'admin-1', actorRole: 'pmcm_admin', action: 'assign_reward',
      resourceId: 'award-1', outcome: 'assigned',
    }), tx);
  });

  it('rejects an unassigned recipient or an idempotency conflict without an audit record', async () => {
    const { service, audit } = setup(null);

    await expect(service.assign('event-1', 'session-1', actor, input)).rejects.toBeInstanceOf(ConflictException);
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });

  it('rejects awards after event closure before persistence or audit', async () => {
    const { service, eventAccess, store, audit } = setup();
    eventAccess.isEventOpen.mockResolvedValue(false);

    await expect(service.assign('event-1', 'session-1', actor, input)).rejects.toBeInstanceOf(ConflictException);
    expect(store.assignAward).not.toHaveBeenCalled();
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });
});
