import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PlatformRetentionCandidate, PlatformRetentionReadModel } from '@prism/contexts/read-models';
import { PrivacyRetentionService } from './privacy-retention.service';
import { DAY_MS } from './privacy-retention.policy';

const NOW = new Date('2026-10-19T12:00:00.000Z');
const adminActor = { id: 'user_admin', role: OpsUserRole.PmcmAdmin, email: 'admin@pmcm.test', name: 'Anthony', explicit: true, verified: true };

function reviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'retention_inquiry_inq_old',
    policyCategory: 'inquiry',
    subjectType: 'inquiry',
    subjectId: 'inq_old',
    eventId: 'evt_old',
    subjectEmail: 'ana@ayala.test',
    subjectName: '',
    anchorAt: new Date(NOW.getTime() - 800 * DAY_MS),
    dueSince: new Date(NOW.getTime() - 70 * DAY_MS),
    status: 'pending',
    decisionReason: '',
    decidedBy: null,
    decidedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

function createHarness(options: {
  item?: Partial<ReturnType<typeof reviewRow>> | null;
  policy?: { enabled: boolean; periodDays: number; revision: number };
  activeHold?: boolean;
  candidate?: PlatformRetentionCandidate | null;
  redaction?: { surfaces: string[]; touchedRecords: number } | Error;
} = {}) {
  const item = options.item === null ? null : reviewRow(options.item);
  const policy = { category: 'inquiry', label: 'Client inquiry', description: '', periodDays: 730, anchor: 'event_archived_at', action: 'review_anonymize', enabled: true, revision: 1, updatedBy: '', updatedAt: NOW, history: [], ...options.policy };
  const store = { item, policy };
  const tx = {
    $executeRaw: vi.fn(async () => 0),
    opsRetentionReviewItem: {
      findUnique: vi.fn(async () => (store.item ? { ...store.item } : null)),
      findUniqueOrThrow: vi.fn(async () => ({ ...store.item! })),
      updateMany: vi.fn(async ({ where, data }: { where: { status?: string | { in: string[] } }; data: Record<string, unknown> }) => {
        if (!store.item) return { count: 0 };
        const statuses = typeof where.status === 'object' ? where.status.in : [where.status];
        if (where.status !== undefined && !statuses.includes(store.item.status)) return { count: 0 };
        Object.assign(store.item, data);
        return { count: 1 };
      }),
    },
    opsRetentionPolicy: {
      findUnique: vi.fn(async () => ({ ...store.policy })),
      findUniqueOrThrow: vi.fn(async () => ({ ...store.policy })),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(store.policy, { ...data, revision: data.revision });
        return { count: 1 };
      }),
    },
    opsPrivacyLegalHold: {
      findFirst: vi.fn(async () => (options.activeHold ? { id: 'hold_1' } : null)),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    ...tx,
  };
  const candidate: PlatformRetentionCandidate | null = options.candidate === undefined
    ? { category: 'inquiry', subjectId: 'inq_old', eventId: 'evt_old', subjectEmail: 'ana@ayala.test', subjectName: '', anchorAt: new Date(NOW.getTime() - 800 * DAY_MS) }
    : options.candidate;
  const readModel = {
    findRetentionCandidates: vi.fn(),
    findRetentionCandidate: vi.fn(async () => candidate),
  } as unknown as PlatformRetentionReadModel;
  const executor = {
    redactCandidate: vi.fn(async () => {
      const outcome = options.redaction ?? { surfaces: ['inquiry', 'event_client_copy'], touchedRecords: 2 };
      if (outcome instanceof Error) throw outcome;
      return outcome;
    }),
  };
  const auditService = { audit: vi.fn(async () => ({ id: 'aud_1' })) };
  const service = new PrivacyRetentionService(prisma as never, auditService as never, executor as never, readModel);
  return { service, store, executor, auditService, readModel, tx };
}

describe('PrivacyRetentionService', () => {
  it('executes a pending item after re-reading it, redacts through the owner redactor, and audits counts only', async () => {
    const harness = createHarness();

    const result = await harness.service.executeReviewItem('retention_inquiry_inq_old', { executionNotes: 'Approved by Anthony' }, adminActor, NOW);

    expect(harness.executor.redactCandidate).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: 'executed', touchedRecords: 2, surfaces: ['inquiry', 'event_client_copy'], decidedBy: 'Anthony' });
    const [, actorName, action, options] = harness.auditService.audit.mock.calls[0] as unknown as [unknown, string, string, { metadata: Record<string, unknown> }];
    expect(action).toBe('Executed privacy retention review item');
    expect(actorName).toBe('Anthony');
    expect(options.metadata).toMatchObject({ itemId: 'retention_inquiry_inq_old', touchedRecords: 2, periodDays: 730 });
    expect(JSON.stringify(options)).not.toContain('ana@ayala.test');
  });

  it('re-checks an active legal hold at execution, marks the item held, and redacts nothing', async () => {
    const harness = createHarness({ activeHold: true });

    await expect(harness.service.executeReviewItem('retention_inquiry_inq_old', {}, adminActor, NOW)).rejects.toBeInstanceOf(ConflictException);

    expect(harness.executor.redactCandidate).not.toHaveBeenCalled();
    expect(harness.store.item?.status).toBe('held');
  });

  it('keeps the item pending when a redactor fails, so execution is all-or-nothing', async () => {
    const harness = createHarness({ redaction: new Error('owner write failed') });

    await expect(harness.service.executeReviewItem('retention_inquiry_inq_old', {}, adminActor, NOW)).rejects.toThrow('owner write failed');

    expect(harness.store.item?.status).toBe('pending');
    expect(harness.auditService.audit).not.toHaveBeenCalled();
  });

  it('refuses execution when the record is no longer past its retention period or the policy is disabled', async () => {
    const notYetDue = createHarness({ candidate: { category: 'inquiry', subjectId: 'inq_old', eventId: 'evt_old', subjectEmail: 'ana@ayala.test', subjectName: '', anchorAt: new Date(NOW.getTime() - 100 * DAY_MS) } });
    await expect(notYetDue.service.executeReviewItem('retention_inquiry_inq_old', {}, adminActor, NOW)).rejects.toBeInstanceOf(BadRequestException);
    expect(notYetDue.executor.redactCandidate).not.toHaveBeenCalled();

    const disabled = createHarness({ policy: { enabled: false, periodDays: 730, revision: 1 } });
    await expect(disabled.service.executeReviewItem('retention_inquiry_inq_old', {}, adminActor, NOW)).rejects.toBeInstanceOf(BadRequestException);
    expect(disabled.store.item?.status).toBe('pending');
  });

  it('closes an item as dismissed without changing data when the record no longer matches the candidate', async () => {
    const harness = createHarness({ candidate: null });

    const result = await harness.service.executeReviewItem('retention_inquiry_inq_old', {}, adminActor, NOW);

    expect(result).toMatchObject({ status: 'dismissed', touchedRecords: 0, surfaces: [] });
    expect(harness.executor.redactCandidate).not.toHaveBeenCalled();
  });

  it('dismisses pending or held items and records the operator reason in the audit trail', async () => {
    const harness = createHarness({ item: { status: 'held' } });

    const result = await harness.service.dismissReviewItem('retention_inquiry_inq_old', { reason: 'Client asked to keep the record' }, adminActor, NOW);

    expect(result).toMatchObject({ status: 'dismissed', decisionReason: 'Client asked to keep the record' });
    const [, , , options] = harness.auditService.audit.mock.calls[0] as unknown as [unknown, string, string, { metadata: Record<string, unknown> }];
    expect(options.metadata).toMatchObject({ reason: 'Client asked to keep the record', fromStatus: 'held' });
  });

  it('refuses to dismiss or execute an item that is already decided', async () => {
    const harness = createHarness({ item: { status: 'executed' } });

    await expect(harness.service.dismissReviewItem('retention_inquiry_inq_old', { reason: 'late' }, adminActor, NOW)).rejects.toBeInstanceOf(BadRequestException);
    await expect(harness.service.executeReviewItem('retention_inquiry_inq_old', {}, adminActor, NOW)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['coordinator', OpsUserRole.Coordinator],
    ['client', OpsUserRole.Client],
    ['supplier', OpsUserRole.Supplier],
    ['guest', OpsUserRole.Guest],
    ['system', OpsUserRole.System],
  ])('forbids a %s actor from changing a retention policy', async (_label, role) => {
    const harness = createHarness({ policy: { enabled: false, periodDays: 730, revision: 1 } });

    await expect(
      harness.service.updatePolicy('inquiry', { enabled: true, expectedRevision: 1, reason: 'Board approved' }, { ...adminActor, role, verified: true }, NOW),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.store.policy.enabled).toBe(false);
  });

  it('lets a PMCM administrator edit a policy with a reason, bumping the revision and keeping history', async () => {
    const harness = createHarness();

    const saved = await harness.service.updatePolicy('inquiry', { enabled: true, periodDays: 365, expectedRevision: 1, reason: 'Board approved 365 days' }, adminActor, NOW);

    expect(saved).toMatchObject({ enabled: true, periodDays: 365, revision: 2, updatedBy: 'Anthony' });
    expect(saved.history).toEqual([expect.objectContaining({ revision: 2, reason: 'Board approved 365 days', periodDays: 365 })]);
    const [, , , options] = harness.auditService.audit.mock.calls[0] as unknown as [unknown, string, string, { metadata: Record<string, unknown> }];
    expect(options.metadata).toMatchObject({ reason: 'Board approved 365 days', before: { enabled: true, periodDays: 730 }, after: { enabled: true, periodDays: 365 } });
  });

  it('refuses to enable a reference-only category and rejects edits made from a stale revision', async () => {
    const harness = createHarness({ policy: { enabled: false, periodDays: 2555, revision: 3 } });

    await expect(
      harness.service.updatePolicy('audit', { enabled: true, expectedRevision: 1, reason: 'Try it' }, adminActor, NOW),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      harness.service.updatePolicy('inquiry', { enabled: true, expectedRevision: 1, reason: 'Stale edit' }, adminActor, NOW),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(harness.store.policy.revision).toBe(3);
  });
});
