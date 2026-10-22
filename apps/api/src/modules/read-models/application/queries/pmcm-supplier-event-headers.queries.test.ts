import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import { PmcmSupplierEventHeadersQueries } from './pmcm-supplier-event-headers.queries';

describe('PmcmSupplierEventHeadersQueries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads only the allowlisted event header fields for the bounded page of supplier event IDs', async () => {
    const findMany = vi.fn(async () => [{ id: 'evt_1', eventName: 'Summit', eventDate: new Date('2026-09-01'), status: 'completed', actualEndedAt: new Date('2026-09-01T12:00:00Z') }]);
    const prisma = { opsEvent: { findMany } } as unknown as PrismaService;
    const queries = new PmcmSupplierEventHeadersQueries(prisma);

    await expect(queries.forEvents(['evt_1'])).resolves.toEqual(await findMany.mock.results[0]?.value);
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ['evt_1'] } },
      select: { id: true, eventName: true, eventDate: true, status: true, actualEndedAt: true },
      orderBy: [{ id: 'asc' }],
      take: 1,
    });
  });

  it('does not query PostgreSQL for an empty page', async () => {
    const findMany = vi.fn();
    const queries = new PmcmSupplierEventHeadersQueries({ opsEvent: { findMany } } as any);

    await expect(queries.forEvents([])).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
