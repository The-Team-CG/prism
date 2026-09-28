import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import { EventContextAgent } from './event-context.agent';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

describe('EventContextAgent', () => {
  it('starts the independent quote and briefing reads together and combines both results', async () => {
    const quoteRows = deferred<Array<{ amount: number; requestId: string }>>();
    const briefingRows = deferred<Array<{ serviceRequirements: string[] }>>();
    const quoteRead = vi.fn(() => quoteRows.promise);
    const briefingRead = vi.fn(() => briefingRows.promise);
    const prisma = {
      opsSupplierQuote: { findMany: quoteRead },
      opsBriefing: { findMany: briefingRead },
    } as unknown as PrismaService;
    const agent = new EventContextAgent(prisma);

    const resultPromise = agent.buildPareEventContext('request-1', {
      request: {
        supplierId: 'supplier-1',
        supplierName: 'Supplier One',
        category: 'catering',
        supplier: { tier: 'tier_1' },
      },
      event: {
        id: 'event-1',
        eventDate: '2030-01-01',
        eventName: 'Synthetic Event',
        clientName: 'Synthetic Client',
      },
    });

    const bothReadsStartedBeforeEitherResolved = quoteRead.mock.calls.length === 1 && briefingRead.mock.calls.length === 1;
    quoteRows.resolve([{ amount: 250, requestId: 'request-1' }]);
    briefingRows.resolve([{ serviceRequirements: ['Halal meal'] }]);
    const context = await resultPromise;

    expect(bothReadsStartedBeforeEitherResolved).toBe(true);
    expect(context.spentBudget).toBe(250);
    expect(context.withdrawnSupplier.quotedAmount).toBe(250);
    expect(context.clientPreferences).toEqual(['Halal meal']);
  });
});
