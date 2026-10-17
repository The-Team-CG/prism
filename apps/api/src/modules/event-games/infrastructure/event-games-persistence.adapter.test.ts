import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import { EventGamesPersistenceAdapter } from './event-games-persistence.adapter';

const eventId = 'event-1';
const sessionId = 'session-1';
const lifecycleTransitions = [
  ['start_session', 'scheduled', 'live', 'started'],
  ['start_session', 'lobby', 'live', 'started'],
  ['pause_session', 'live', 'paused', 'paused'],
  ['resume_session', 'paused', 'live', 'resumed'],
  ['end_session', 'live', 'completed', 'ended'],
  ['cancel_session', 'scheduled', 'cancelled', 'cancelled'],
] as const;

describe('EventGamesPersistenceAdapter scheduled-session cleanup', () => {
  it('stores the first host-selected wheel outcome on the live session only once', async () => {
    const result = { kind: 'spin-wheel', outcomeId: 'bonus', label: 'Bonus points', points: 25 };
    const queryRaw = vi.fn().mockResolvedValue([{
      event_id: eventId, session_id: sessionId, status: 'live',
    }]);
    const transaction = { prisma: { $queryRaw: queryRaw } } as unknown as PrismTransactionContext;
    const adapter = new EventGamesPersistenceAdapter({ revokeSessionPin: vi.fn() } as never);

    await expect(adapter.executeHostCommand({
      eventId, actorId: 'host-1', resourceType: 'session', resourceId: sessionId,
      action: 'spin_wheel', command: { command: 'spin-wheel', wheelResult: result }, requestReceiptId: 'spin-receipt',
    } as never, transaction)).resolves.toMatchObject({ outcome: 'spun', action: 'spin_wheel' });

    const sql = Array.from(queryRaw.mock.calls[0]?.[0] ?? []).join(' ');
    expect(sql).toContain('"wheel_result" IS NULL');
    expect(sql).toContain('"status" =');
    expect(queryRaw.mock.calls[0]).toContain(JSON.stringify(result));
  });

  it('advances a round with an event-scoped compare-and-update guard', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ event_id: eventId, session_id: sessionId, status: 'live' }]);
    const transaction = { prisma: { $queryRaw: queryRaw } } as unknown as PrismTransactionContext;
    const adapter = new EventGamesPersistenceAdapter({ revokeSessionPin: vi.fn() } as never);

    const result = await adapter.executeHostCommand({
      eventId,
      actorId: 'host-1',
      resourceType: 'session',
      resourceId: sessionId,
      action: 'advance_round',
      command: {
        expectedRoundKey: 'round-1',
        advanceByMs: 20_000,
        expectedRoundOffsetMs: 0,
        expectedStatus: 'live',
        expectedStartedAt: '2026-10-17T10:00:00.000Z',
        expectedPausedAt: null,
        expectedTotalPausedMs: 0,
      },
      requestReceiptId: 'advance-receipt',
    }, transaction);

    const sql = Array.from(queryRaw.mock.calls[0]?.[0] ?? []).join(' ');
    expect(sql).toContain('"event_id" =');
    expect(sql).toContain('"round_offset_ms" =');
    expect(sql).toContain('IS NOT DISTINCT FROM');
    expect(result).toMatchObject({ outcome: 'advanced', resourceId: sessionId });
  });

  it('freezes active round time across a durable pause and resume', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{
      event_id: eventId, session_id: sessionId, before_status: 'live', after_status: 'paused',
    }]);
    const transaction = {
      prisma: { $queryRaw: queryRaw, $executeRaw: vi.fn().mockResolvedValue(1) },
    } as unknown as PrismTransactionContext;
    const adapter = new EventGamesPersistenceAdapter({ revokeSessionPin: vi.fn() } as never);

    await adapter.executeHostCommand({
      eventId, actorId: 'host-1', resourceType: 'session', resourceId: sessionId,
      action: 'pause_session', command: {}, requestReceiptId: 'pause-receipt',
    }, transaction);

    const sql = Array.from(queryRaw.mock.calls[0]?.[0] ?? []).join(' ');
    expect(sql).toContain('"paused_at"');
    expect(sql).toContain('"total_paused_ms"');
    expect(sql).toContain('EXTRACT(EPOCH FROM (NOW() - s."paused_at"))');
    expect(sql).toContain('FOR UPDATE');
  });

  it('cancels the durable due-start row in the same host-command transaction', async () => {
    const transaction = {
      prisma: {
        $queryRaw: vi.fn().mockResolvedValue([{
          event_id: eventId,
          session_id: sessionId,
          before_status: 'scheduled',
          after_status: 'cancelled',
        }]),
        $executeRaw: vi.fn().mockResolvedValue(1),
      },
    } as unknown as PrismTransactionContext;
    const pins = { revokeSessionPin: vi.fn().mockResolvedValue(true) };
    const scheduler = { cancel: vi.fn().mockResolvedValue(undefined) };
    const adapter = new EventGamesPersistenceAdapter(pins as never, scheduler as never);

    const result = await adapter.executeHostCommand({
      eventId,
      actorId: 'host-1',
      resourceType: 'session',
      resourceId: sessionId,
      action: 'cancel_session',
      command: {},
      requestReceiptId: 'cancel-receipt',
    }, transaction);

    expect(result.outcome).toBe('cancelled');
    expect(pins.revokeSessionPin).toHaveBeenCalledOnce();
    expect(scheduler.cancel).toHaveBeenCalledWith({ eventId, sessionId }, transaction);
  });

  it.each(lifecycleTransitions)(
    'persists the %s lifecycle transition from %s to %s',
    async (action, beforeStatus, afterStatus, outcome) => {
      const transaction = {
        prisma: {
          $queryRaw: vi.fn().mockResolvedValue([{
            event_id: eventId,
            session_id: sessionId,
            before_status: beforeStatus,
            after_status: afterStatus,
          }]),
          $executeRaw: vi.fn().mockResolvedValue(1),
        },
      } as unknown as PrismTransactionContext;
      const pins = { revokeSessionPin: vi.fn().mockResolvedValue(false) };
      const scheduler = { cancel: vi.fn().mockResolvedValue(undefined) };
      const adapter = new EventGamesPersistenceAdapter(pins as never, scheduler as never);

      const result = await adapter.executeHostCommand({
        eventId,
        actorId: 'host-1',
        resourceType: 'session',
        resourceId: sessionId,
        action,
        command: {},
        requestReceiptId: 'lifecycle-receipt',
      }, transaction);

      expect(result).toMatchObject({
        outcome,
        transition: { beforeStatus, afterStatus },
      });
      if (action === 'end_session' || action === 'cancel_session') {
        expect(pins.revokeSessionPin).toHaveBeenCalledOnce();
        expect(scheduler.cancel).toHaveBeenCalledWith({ eventId, sessionId }, transaction);
      } else {
        expect(pins.revokeSessionPin).not.toHaveBeenCalled();
        expect(scheduler.cancel).not.toHaveBeenCalled();
      }
    },
  );
});
