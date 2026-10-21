import { describe, expect, it, vi } from 'vitest';
import type { PlatformRetentionCandidate, PlatformRetentionReadModel } from '@prism/contexts/read-models';
import { PrivacyRetentionSweepService } from './privacy-retention-sweep.service';
import { DAY_MS } from './privacy-retention.policy';

const NOW = new Date('2026-10-19T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

type Where = Record<string, unknown>;

/** Minimal matcher for the Prisma `where` shapes the sweep uses: scalar equality, null, `in`, and `OR`. */
function matches(record: Record<string, unknown>, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'OR') return (expected as Where[]).some((clause) => matches(record, clause));
    const actual = record[key];
    if (expected === null) return actual === null || actual === undefined;
    if (expected && typeof expected === 'object' && 'in' in expected) return (expected as { in: unknown[] }).in.includes(actual);
    return actual === expected;
  });
}

function createStore(policies: Array<{ category: string; periodDays: number; enabled: boolean }>) {
  const policyRows = new Map(policies.map((policy) => [policy.category, { ...policy, revision: 1 }]));
  const items = new Map<string, Record<string, unknown>>();
  const holds: Array<Record<string, unknown>> = [];
  const itemKey = (row: Record<string, unknown>) => `${row.policyCategory}|${row.subjectType}|${row.subjectId}`;
  const prisma: Record<string, unknown> = {
    $transaction: vi.fn(async (callback: (client: unknown) => Promise<unknown>) => callback(prisma)),
    opsRetentionPolicy: {
      findMany: vi.fn(async ({ where }: { where?: Where } = {}) =>
        [...policyRows.values()].filter((row) => !where || matches(row, where))),
    },
    opsRetentionReviewItem: {
      createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        let count = 0;
        for (const row of data) {
          if (items.has(itemKey(row))) continue;
          items.set(itemKey(row), { ...row });
          count += 1;
        }
        return { count };
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        let count = 0;
        for (const row of items.values()) {
          if (!matches(row, where)) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      }),
    },
    opsPrivacyLegalHold: {
      findFirst: vi.fn(async ({ where }: { where: Where }) => holds.find((hold) => matches(hold, where)) ?? null),
    },
  };
  return { prisma, items, holds, policyRows };
}

function createReadModel(candidates: PlatformRetentionCandidate[]): PlatformRetentionReadModel {
  return {
    findRetentionCandidates: vi.fn(async ({ category, archivedBefore }) => ({
      candidates: candidates.filter((candidate) => candidate.category === category && candidate.anchorAt <= archivedBefore),
      nextEventCursor: null,
    })),
    findRetentionCandidate: vi.fn(async () => null),
  } as PlatformRetentionReadModel;
}

const inquiryCandidate = (subjectId: string, archivedDaysAgo: number, email = `${subjectId}@client.test`): PlatformRetentionCandidate => ({
  category: 'inquiry',
  subjectId,
  eventId: `evt_${subjectId}`,
  subjectEmail: email,
  subjectName: '',
  anchorAt: daysAgo(archivedDaysAgo),
});

const guestCandidate = (subjectId: string, name: string, archivedDaysAgo: number): PlatformRetentionCandidate => ({
  category: 'guest_check_in',
  subjectId,
  eventId: 'evt_gala',
  subjectEmail: '',
  subjectName: name,
  anchorAt: daysAgo(archivedDaysAgo),
});

function createSweep(store: ReturnType<typeof createStore>, readModel: PlatformRetentionReadModel) {
  const auditService = { audit: vi.fn(async () => ({ id: 'aud_1' })) };
  const service = new PrivacyRetentionSweepService(
    store.prisma as never,
    auditService as never,
    readModel,
  );
  return { service, auditService };
}

describe('PrivacyRetentionSweepService', () => {
  it('queues only records past the enabled policy period and never touches the source records', async () => {
    const store = createStore([{ category: 'inquiry', periodDays: 730, enabled: true }]);
    const readModel = createReadModel([inquiryCandidate('inq_old', 800), inquiryCandidate('inq_recent', 100)]);
    const { service } = createSweep(store, readModel);

    const summary = await service.runSweep(NOW);

    expect(summary.created).toBe(1);
    const queued = [...store.items.values()];
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ policyCategory: 'inquiry', subjectType: 'inquiry', subjectId: 'inq_old', status: 'pending', eventId: 'evt_inq_old' });
    expect(queued[0].dueSince).toEqual(new Date(daysAgo(800).getTime() + 730 * DAY_MS));
    expect(readModel.findRetentionCandidates).toHaveBeenCalledWith(expect.objectContaining({
      category: 'inquiry',
      archivedBefore: new Date(NOW.getTime() - 730 * DAY_MS),
    }));
  });

  it('does nothing for disabled policies, so seeded defaults never queue or change records', async () => {
    const store = createStore([{ category: 'inquiry', periodDays: 730, enabled: false }]);
    const readModel = createReadModel([inquiryCandidate('inq_old', 800)]);
    const { service, auditService } = createSweep(store, readModel);

    const summary = await service.runSweep(NOW);

    expect(summary).toMatchObject({ created: 0, held: 0, released: 0, scannedRecords: 0 });
    expect(store.items.size).toBe(0);
    expect(readModel.findRetentionCandidates).not.toHaveBeenCalled();
    expect(auditService.audit).not.toHaveBeenCalled();
  });

  it('is idempotent: a second run over the same data creates nothing and writes no new audit entry', async () => {
    const store = createStore([{ category: 'inquiry', periodDays: 730, enabled: true }]);
    const { service, auditService } = createSweep(store, createReadModel([inquiryCandidate('inq_old', 800)]));

    await service.runSweep(NOW);
    const second = await service.runSweep(NOW);

    expect(second).toMatchObject({ created: 0, held: 0, released: 0 });
    expect(store.items.size).toBe(1);
    expect(auditService.audit).toHaveBeenCalledTimes(1);
  });

  it('marks a queued record held while a matching legal hold is active and returns it to pending after release', async () => {
    const store = createStore([{ category: 'inquiry', periodDays: 730, enabled: true }]);
    const { service } = createSweep(store, createReadModel([inquiryCandidate('inq_old', 800, 'ana@ayala.test')]));
    await service.runSweep(NOW);
    const [item] = [...store.items.values()];

    store.holds.push({
      subjectType: 'client', subjectEmail: 'ana@ayala.test', subjectName: '', eventId: 'evt_inq_old', releasedAt: null,
    });
    const heldRun = await service.runSweep(NOW);
    expect(heldRun.held).toBe(1);
    expect(item.status).toBe('held');

    store.holds[0].releasedAt = NOW;
    const releasedRun = await service.runSweep(NOW);
    expect(releasedRun.released).toBe(1);
    expect(item.status).toBe('pending');
  });

  it('creates an already-held item when the hold exists before the first sweep, without matching holds for other events', async () => {
    const store = createStore([{ category: 'inquiry', periodDays: 730, enabled: true }]);
    store.holds.push({
      subjectType: 'client', subjectEmail: 'ana@ayala.test', subjectName: '', eventId: 'evt_other', releasedAt: null,
    });
    store.holds.push({
      subjectType: 'client', subjectEmail: 'bo@bay.test', subjectName: '', eventId: null, releasedAt: null,
    });
    const readModel = createReadModel([
      inquiryCandidate('inq_held_elsewhere', 800, 'ana@ayala.test'),
      inquiryCandidate('inq_global_hold', 800, 'bo@bay.test'),
    ]);
    const { service } = createSweep(store, readModel);

    const summary = await service.runSweep(NOW);

    const statuses = Object.fromEntries([...store.items.values()].map((row) => [row.subjectId, row.status]));
    expect(statuses).toEqual({ inq_held_elsewhere: 'pending', inq_global_hold: 'held' });
    expect(summary.held).toBe(1);
  });

  it('writes an audit entry with counts only and never the subject identity', async () => {
    const store = createStore([{ category: 'inquiry', periodDays: 730, enabled: true }]);
    const { service, auditService } = createSweep(store, createReadModel([inquiryCandidate('inq_old', 800, 'ana@ayala.test')]));

    await service.runSweep(NOW);

    const [, actorName, action, options] = auditService.audit.mock.calls[0] as unknown as [unknown, string, string, { metadata: Record<string, unknown> }];
    expect(actorName).toBe('Privacy Retention Sweep');
    expect(action).toBe('Privacy retention sweep: inquiry');
    expect(options.metadata).toMatchObject({ category: 'inquiry', created: 1, held: 0, released: 0 });
    expect(JSON.stringify(options)).not.toContain('ana@ayala.test');
  });

  it('keeps guest candidates queued by name for the event and never deletes rows from the store', async () => {
    const store = createStore([{ category: 'guest_check_in', periodDays: 730, enabled: true }]);
    const { service } = createSweep(store, createReadModel([guestCandidate('chk_1', 'Ana Reyes', 800)]));

    await service.runSweep(NOW);
    await service.runSweep(NOW);

    expect([...store.items.values()]).toEqual([
      expect.objectContaining({ policyCategory: 'guest_check_in', subjectId: 'chk_1', eventId: 'evt_gala', subjectName: 'Ana Reyes', status: 'pending' }),
    ]);
  });
});
