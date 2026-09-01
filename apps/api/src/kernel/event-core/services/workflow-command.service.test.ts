import { describe, expect, it, vi } from 'vitest';
import type { PrismCommandContext, PrismTransactionContext } from '@prism/kernel/shared-kernel';
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
});