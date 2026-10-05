import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PlatformCommandReceiptStore } from './command-receipt.store';

describe('PlatformCommandReceiptStore', () => {
  it('uses the caller transaction for receipt lookup, reservation, and completion', async () => {
    const rootFind = vi.fn();
    const rootCreate = vi.fn();
    const rootUpdate = vi.fn();
    const transactionFind = vi.fn().mockResolvedValue(null);
    const transactionCreate = vi.fn().mockResolvedValue({ id: 'cmd_receipt_1' });
    const transactionUpdate = vi.fn().mockResolvedValue({ id: 'cmd_receipt_1' });
    const store = new PlatformCommandReceiptStore({
      opsCommandReceipt: { findUnique: rootFind, create: rootCreate, update: rootUpdate },
    } as never);
    const context = {
      prisma: { opsCommandReceipt: { findUnique: transactionFind, create: transactionCreate, update: transactionUpdate } } as never,
      correlationId: 'command-receipt-test',
      actorId: 'actor_1',
    };
    const key = { commandName: 'save_event', idempotencyKey: 'key_1', actorId: 'actor_1', eventScope: 'evt_1' };
    const input = { ...key, actorRole: 'pmcm-admin', eventId: 'evt_1', correlationId: context.correlationId, payloadHash: 'hash_1' };

    await expect(store.find(key, context)).resolves.toBeNull();
    await expect(store.create(input, context)).resolves.toEqual({ id: 'cmd_receipt_1' });
    await store.complete('cmd_receipt_1', undefined, context);

    expect(transactionFind).toHaveBeenCalledWith({ where: { commandName_idempotencyKey_actorId_eventScope: key } });
    expect(transactionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ...input, id: expect.stringMatching(/^cmd_receipt_/) }),
      select: { id: true },
    }));
    expect(transactionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'cmd_receipt_1' },
      data: { result: Prisma.JsonNull, completedAt: expect.any(Date) },
    }));
    expect(rootFind).not.toHaveBeenCalled();
    expect(rootCreate).not.toHaveBeenCalled();
    expect(rootUpdate).not.toHaveBeenCalled();
  });

  it('uses the Platform database for receipt lookups without a caller transaction', async () => {
    const receipt = { id: 'cmd_receipt_1', commandName: 'save_event' };
    const findUnique = vi.fn().mockResolvedValue(receipt);
    const store = new PlatformCommandReceiptStore({ opsCommandReceipt: { findUnique } } as never);

    await expect(store.find({ commandName: 'save_event', idempotencyKey: 'key_1', actorId: 'actor_1', eventScope: 'evt_1' }))
      .resolves.toEqual(receipt);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
