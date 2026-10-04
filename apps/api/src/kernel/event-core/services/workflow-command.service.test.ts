import { describe, expect, it, vi } from 'vitest';
import type { PrismCommandContext, PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { CommandReceiptRecord, CommandReceiptStore } from '../ports/command-receipt.port';
import { WorkflowCommandService } from './workflow-command.service';

describe('WorkflowCommandService', () => {
  it('runs same_tx writes and side effects inside the transaction context', async () => {
    const commandContext: PrismCommandContext = {
      actorId: 'pmcm_admin',
      actorRole: 'pmcm_admin',
      eventId: 'evt_main',
      correlationId: 'cmd_123',
      idempotencyKey: 'cmd-key-123',
    };
    const transactionContext: PrismTransactionContext = {
      prisma: { tx: true } as never,
      correlationId: commandContext.correlationId,
      actorId: commandContext.actorId,
    };
    const transactionRunner = {
      run: vi.fn(async (work: (context: PrismTransactionContext) => Promise<string>, context?: PrismCommandContext) => {
        expect(context).toBe(commandContext);
        return work(transactionContext);
      }),
    };
    const service = new WorkflowCommandService(transactionRunner as never);
    const write = vi.fn(async (context?: PrismTransactionContext) => {
      expect(context).toBe(transactionContext);
      return 'written';
    });
    const sideEffects = vi.fn(async (result: string, context?: PrismTransactionContext) => {
      expect(result).toBe('written');
      expect(context).toBe(transactionContext);
    });

    const result = await service.execute({
      name: 'assign_coordinator',
      context: commandContext,
      sideEffectMode: 'same_tx',
      write,
      sideEffects,
      project: (value) => `${value}:projected`,
    });

    expect(result).toBe('written:projected');
    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(sideEffects).toHaveBeenCalledTimes(1);
  });

  it('does not open a transaction for read_only commands', async () => {
    const transactionRunner = {
      run: vi.fn(),
    };
    const service = new WorkflowCommandService(transactionRunner as never);

    const result = await service.execute({
      name: 'read_dashboard',
      sideEffectMode: 'read_only',
      write: async (context?: PrismTransactionContext) => {
        expect(context).toBeUndefined();
        return 'read';
      },
    });

    expect(result).toBe('read');
    expect(transactionRunner.run).not.toHaveBeenCalled();
  });

  it('runs transaction state validation after the transaction begins', async () => {
    const transactionContext = { prisma: { tx: true } as never, correlationId: 'cmd', actorId: 'actor' };
    const transactionRunner = {
      run: vi.fn(async (work: (context: PrismTransactionContext) => Promise<string>) => work(transactionContext)),
    };
    const service = new WorkflowCommandService(transactionRunner as never);
    const validate = vi.fn(async (context: PrismTransactionContext) => {
      expect(context).toBe(transactionContext);
    });

    await service.execute({
      name: 'transaction_validated_command',
      sideEffectMode: 'same_tx',
      validateStateInTransaction: validate,
      write: async () => 'written',
    });

    expect(validate).toHaveBeenCalledTimes(1);
  });

  it('stores a projected result and replays it before running the command again', async () => {
    const commandContext: PrismCommandContext = {
      actorId: 'pmcm_admin',
      actorRole: 'pmcm_admin',
      eventId: 'evt_1',
      correlationId: 'cmd_receipt_1',
      idempotencyKey: 'receipt-key-1',
    };
    const transactionContext: PrismTransactionContext = {
      prisma: { tx: true } as never,
      correlationId: commandContext.correlationId,
      actorId: commandContext.actorId,
    };
    const saved = new Map<string, CommandReceiptRecord>();
    const store: CommandReceiptStore = {
      find: vi.fn(async (key) => saved.get(`${key.commandName}:${key.idempotencyKey}:${key.actorId}:${key.eventScope}`) ?? null),
      create: vi.fn(async (input) => {
        const id = 'receipt_1';
        saved.set(`${input.commandName}:${input.idempotencyKey}:${input.actorId}:${input.eventScope}`, {
          ...input,
          id,
          eventId: input.eventId ?? null,
          payloadHash: input.payloadHash ?? null,
          result: null,
          completedAt: new Date(),
        });
        return { id };
      }),
      complete: vi.fn(async (id, result) => {
        const receipt = [...saved.values()].find((value) => value.id === id)!;
        receipt.result = result;
      }),
    };
    const transactionRunner = {
      run: vi.fn(async (work: (context: PrismTransactionContext) => Promise<unknown>) => work(transactionContext)),
    };
    const write = vi.fn(async () => ({ id: 'event_1', status: 'accepted' }));
    const service = new WorkflowCommandService(transactionRunner as never, store);

    const definition = {
      name: 'accept_inquiry',
      context: commandContext,
      sideEffectMode: 'same_tx' as const,
      idempotencyPayloadHash: 'hash-1',
      write,
      project: (result: { id: string; status: string }) => ({ id: result.id, status: result.status, replaySafe: true }),
    };

    await expect(service.execute(definition)).resolves.toEqual({ id: 'event_1', status: 'accepted', replaySafe: true });
    await expect(service.execute(definition)).resolves.toEqual({ id: 'event_1', status: 'accepted', replaySafe: true });

    expect(write).toHaveBeenCalledTimes(1);
    expect(store.create).toHaveBeenCalledTimes(1);
    expect(store.complete).toHaveBeenCalledTimes(1);
    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });

  it('does not replay a receipt from another event with the same command key', async () => {
    const saved = new Map<string, CommandReceiptRecord>();
    const store: CommandReceiptStore = {
      find: vi.fn(async (key) => saved.get(`${key.commandName}:${key.idempotencyKey}:${key.actorId}:${key.eventScope}`) ?? null),
      create: vi.fn(async (input) => {
        const id = `receipt_${saved.size + 1}`;
        saved.set(`${input.commandName}:${input.idempotencyKey}:${input.actorId}:${input.eventScope}`, {
          ...input,
          id,
          eventId: input.eventId ?? null,
          payloadHash: input.payloadHash ?? null,
          result: null,
          completedAt: new Date(),
        });
        return { id };
      }),
      complete: vi.fn(async (id, result) => {
        const receipt = [...saved.values()].find((value) => value.id === id)!;
        receipt.result = result;
      }),
    };
    const transactionRunner = {
      run: vi.fn(async (work: (context: PrismTransactionContext) => Promise<unknown>) => work({ prisma: { tx: true } as never, correlationId: 'cross-event', actorId: 'pmcm_admin' })),
    };
    const service = new WorkflowCommandService(transactionRunner as never, store);
    const write = vi.fn(async (context?: PrismTransactionContext) => ({ id: context?.correlationId ?? 'missing' }));

    const command = (eventId: string) => ({
      name: 'accept_inquiry',
      eventId,
      context: { actorId: 'pmcm_admin', actorRole: 'pmcm_admin', eventId, correlationId: `cross-event:${eventId}`, idempotencyKey: 'same-key' },
      sideEffectMode: 'same_tx' as const,
      idempotencyPayloadHash: 'same-content',
      write,
    });

    await expect(service.execute(command('evt_1'))).resolves.toEqual({ id: 'cross-event' });
    await expect(service.execute(command('evt_2'))).resolves.toEqual({ id: 'cross-event' });

    expect(write).toHaveBeenCalledTimes(2);
    expect(store.create).toHaveBeenCalledTimes(2);
    expect(store.complete).toHaveBeenCalledTimes(2);
    expect(transactionRunner.run).toHaveBeenCalledTimes(2);
  });

  it('rejects replay when the same command key is bound to different content', async () => {
    const commandContext: PrismCommandContext = {
      actorId: 'pmcm_admin',
      actorRole: 'pmcm_admin',
      correlationId: 'cmd_receipt_2',
      idempotencyKey: 'receipt-key-2',
    };
    const receipt: CommandReceiptRecord = {
      id: 'receipt_2',
      commandName: 'accept_inquiry',
      idempotencyKey: commandContext.idempotencyKey!,
      actorId: commandContext.actorId,
      eventScope: '__global__',
      actorRole: commandContext.actorRole,
      eventId: null,
      correlationId: commandContext.correlationId,
      payloadHash: 'original-hash',
      result: { id: 'event_2' },
      completedAt: new Date(),
    };
    const store: CommandReceiptStore = {
      find: vi.fn(async () => receipt),
      create: vi.fn(),
      complete: vi.fn(),
    };
    const service = new WorkflowCommandService(
      { run: vi.fn() } as never,
      store,
    );

    await expect(
      service.execute({
        name: 'accept_inquiry',
        context: commandContext,
        sideEffectMode: 'same_tx',
        idempotencyPayloadHash: 'changed-hash',
        write: vi.fn(),
      }),
    ).rejects.toThrow('different content');
  });

  it('rechecks permission before returning a stored receipt', async () => {
    const receipt: CommandReceiptRecord = {
      id: 'receipt_revoked_actor',
      commandName: 'sensitive_command',
      idempotencyKey: 'sensitive-key',
      actorId: 'actor_1',
      eventScope: 'evt_1',
      actorRole: 'client',
      eventId: 'evt_1',
      correlationId: 'receipt-correlation',
      payloadHash: 'same-content',
      result: { accepted: true },
      completedAt: new Date(),
    };
    const store: CommandReceiptStore = {
      find: vi.fn(async () => receipt),
      create: vi.fn(),
      complete: vi.fn(),
    };
    const transactionRunner = { run: vi.fn() };
    const write = vi.fn();
    const validatePermission = vi.fn(() => { throw new Error('actor is no longer authorized'); });
    const service = new WorkflowCommandService(transactionRunner as never, store);

    await expect(service.execute({
      name: 'sensitive_command',
      context: {
        actorId: 'actor_1',
        actorRole: 'client',
        eventId: 'evt_1',
        correlationId: 'retry-correlation',
        idempotencyKey: 'sensitive-key',
      },
      sideEffectMode: 'same_tx',
      idempotencyPayloadHash: 'same-content',
      validatePermission,
      write,
    })).rejects.toThrow('no longer authorized');

    expect(validatePermission).toHaveBeenCalledTimes(1);
    expect(store.find).not.toHaveBeenCalled();
    expect(transactionRunner.run).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('leaves un-hashed keys on the command-owned idempotency path', async () => {
    const store: CommandReceiptStore = {
      find: vi.fn(),
      create: vi.fn(),
      complete: vi.fn(),
    };
    const transactionContext: PrismTransactionContext = {
      prisma: { tx: true } as never,
      correlationId: 'cmd_legacy_idempotency',
      actorId: 'actor_1',
    };
    const service = new WorkflowCommandService(
      { run: vi.fn(async (work: (context: PrismTransactionContext) => Promise<string>) => work(transactionContext)) } as never,
      store,
    );

    await expect(service.execute({
      name: 'legacy_idempotent_command',
      context: { actorId: 'actor_1', actorRole: 'pmcm_admin', correlationId: 'cmd_legacy_idempotency', idempotencyKey: 'legacy-key' },
      sideEffectMode: 'same_tx',
      write: async () => 'written',
    })).resolves.toBe('written');

    expect(store.find).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
  });
});
