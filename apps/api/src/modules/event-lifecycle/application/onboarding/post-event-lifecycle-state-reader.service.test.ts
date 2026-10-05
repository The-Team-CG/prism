import { describe, expect, it, vi } from 'vitest';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { PostEventLifecycleStateReaderService } from './post-event-lifecycle-state-reader.service';

describe('PostEventLifecycleStateReaderService', () => {
  it('locks the Lifecycle event before returning the event-owned post-event state', async () => {
    const actualEndedAt = new Date('2026-08-02T00:00:00.000Z');
    const findUnique = vi.fn(async () => ({ id: 'evt_1', actualEndedAt }));
    const queryRaw = vi.fn(async () => [{ id: 'evt_1' }]);
    const service = new PostEventLifecycleStateReaderService({} as never);
    const transaction = {
      prisma: { $queryRawUnsafe: queryRaw, opsEvent: { findUnique } },
    } as unknown as PrismTransactionContext;

    await expect(service.findPostEventState('evt_1', transaction)).resolves.toEqual({
      eventId: 'evt_1',
      actualEndedAt,
    });

    expect(queryRaw).toHaveBeenCalledWith(
      'SELECT "id" FROM "event_core"."events" WHERE "id" = $1 FOR UPDATE',
      'evt_1',
    );
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      select: { id: true, actualEndedAt: true },
    });
  });

  it('returns no event when the Lifecycle owner has no matching identifier', async () => {
    const service = new PostEventLifecycleStateReaderService({
      opsEvent: { findUnique: vi.fn(async () => null) },
    } as never);

    await expect(service.findPostEventState('missing')).resolves.toBeNull();
  });
});
