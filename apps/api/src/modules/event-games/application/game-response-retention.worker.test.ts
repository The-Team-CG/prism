import { describe, expect, it, vi } from 'vitest';
import { GameResponseRetentionWorker } from './game-response-retention.worker';

describe('GameResponseRetentionWorker', () => {
  it('uses the event archive fact and one-year cutoff to redact expired response content', async () => {
    const transaction = {};
    const transactions = { run: vi.fn(async (work: (tx: typeof transaction) => unknown) => work(transaction)) };
    const actionStore = {
      listResponseRetentionEventIds: vi.fn().mockResolvedValue(['event-1', 'event-2']),
      redactExpiredResponses: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(0),
    };
    const eventAccess = {
      getResponseRetentionScope: vi.fn()
        .mockResolvedValueOnce({ eventId: 'event-1', closed: true, archivedAt: new Date('2025-01-01T00:00:00Z') })
        .mockResolvedValueOnce(null),
    };
    const worker = new GameResponseRetentionWorker(transactions as never, actionStore as never, eventAccess as never);
    const now = new Date('2026-10-17T00:00:00Z');

    await expect(worker.redactExpiredResponses(now)).resolves.toBe(3);
    expect(actionStore.listResponseRetentionEventIds).toHaveBeenCalledWith(now, transaction);
    expect(eventAccess.getResponseRetentionScope).toHaveBeenNthCalledWith(1, 'event-1', transaction);
    expect(actionStore.redactExpiredResponses).toHaveBeenCalledWith({
      eventId: 'event-1', archivedAt: new Date('2025-01-01T00:00:00Z'), now,
    }, transaction);
    expect(actionStore.redactExpiredResponses).toHaveBeenCalledOnce();
  });
});
