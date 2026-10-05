import { describe, expect, it, vi } from 'vitest';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { UrgentIssueReferenceReaderService } from './urgent-issue-reference-reader.service';

describe('UrgentIssueReferenceReaderService', () => {
  it('locks and reads only the requested issue in the supplied event', async () => {
    const findFirst = vi.fn(async () => ({ id: 'issue_1', eventId: 'evt_1' }));
    const queryRaw = vi.fn(async () => [{ id: 'issue_1' }]);
    const service = new UrgentIssueReferenceReaderService({} as never);
    const transaction = {
      prisma: { $queryRawUnsafe: queryRaw, opsUrgentIssue: { findFirst } },
    } as unknown as PrismTransactionContext;

    await expect(service.findUrgentIssueForEvent('evt_1', 'issue_1', transaction)).resolves.toEqual({
      id: 'issue_1',
      eventId: 'evt_1',
    });

    expect(queryRaw).toHaveBeenCalledWith(
      'SELECT "id" FROM "live_ops"."urgent_issues" WHERE "id" = $1 AND "event_id" = $2 FOR UPDATE',
      'issue_1',
      'evt_1',
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'issue_1', eventId: 'evt_1' },
      select: { id: true, eventId: true },
    });
  });

  it('fails closed when the incident cannot be locked for the requested event', async () => {
    const findFirst = vi.fn();
    const queryRaw = vi.fn(async () => []);
    const service = new UrgentIssueReferenceReaderService({} as never);
    const transaction = {
      prisma: { $queryRawUnsafe: queryRaw, opsUrgentIssue: { findFirst } },
    } as unknown as PrismTransactionContext;

    await expect(service.findUrgentIssueForEvent('evt_other', 'issue_1', transaction)).resolves.toBeNull();

    expect(queryRaw).toHaveBeenCalledWith(expect.any(String), 'issue_1', 'evt_other');
    expect(findFirst).not.toHaveBeenCalled();
  });
});
