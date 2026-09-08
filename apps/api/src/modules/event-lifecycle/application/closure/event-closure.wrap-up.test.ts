import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { buildInsightDimensions, EventClosureService } from './event-closure.service';

const actor = { id: 'pmcm_1', name: 'PMCM', email: 'pmcm@test', role: OpsUserRole.PmcmAdmin } as any;
function harness(actualEndedAt: Date | null = new Date('2026-09-07T00:00:00.000Z')) {
  const event = { id: 'evt_1', clientName: 'Client', eventName: 'Event', status: 'event_day', archived: false, actualEndedAt, actualEndedBy: 'pmcm_1' };
  const records: any[] = [];
  const tx = {
    opsEvent: { findUnique: vi.fn(async () => event), findMany: vi.fn(async () => [event]) },
    opsEventWrapUp: {
      findUnique: vi.fn(async ({ where }: any) => records.find((item) => item.eventId === where.eventId) ?? null),
      create: vi.fn(async ({ data }: any) => { const item = { ...data, id: data.id, createdAt: new Date(), updatedAt: new Date() }; records.push(item); return item; }),
      update: vi.fn(async ({ data }: any) => { Object.assign(records[0], data); return records[0]; }),
      updateMany: vi.fn(async ({ data }: any) => { Object.assign(records[0], data); return { count: 1 }; }),
      upsert: vi.fn(async ({ create }: any) => { records.push(create); return create; }),
    },
  };
  const prisma: any = { ...tx, opsEvent: tx.opsEvent, opsEventWrapUp: tx.opsEventWrapUp, $transaction: vi.fn(async (fn: any) => fn(tx)) };
  const policy: any = { requireActorRole: vi.fn(async (subject: any, roles: string[]) => { if (!roles.includes(subject.role)) throw new ForbiddenException(); }) };
  const notifications = { write: vi.fn(async () => undefined) };
  const service = new EventClosureService(prisma, {} as any, {} as any, { write: vi.fn(async () => undefined) } as any, policy, notifications as any, {} as any);
  return { service, prisma, tx, records, policy, notifications };
}

describe('EventClosureService wrap-up', () => {
  it('starts exactly once from actualEndedAt and keeps a 24-hour deadline', async () => {
    const { service, records } = harness();
    const first = await service.startWrapUp('evt_1', { mode: 'full' }, actor);
    const second = await service.startWrapUp('evt_1', { mode: 'quick' }, actor);
    expect(first.id).toBe(second.id);
    expect(records).toHaveLength(1);
    expect(second.deadlineAt).toEqual(new Date('2026-09-08T00:00:00.000Z'));
  });

  it('rejects wrap-up without a recorded actual end', async () => {
    const { service } = harness(null);
    await expect(service.startWrapUp('evt_1', { mode: 'full' }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects wrap-up mutations from a client actor', async () => {
    const { service } = harness();
    await expect(service.startWrapUp('evt_1', { mode: 'full' }, { ...actor, role: 'client' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('persists section completion evidence and client acknowledgement', async () => {
    const { service, records } = harness();
    const completed = { status: 'complete' as const, evidence: 'Verified by PMCM', completedAt: null };
    const updated = await service.updateWrapUp('evt_1', {
      requiredItems: { post_event_documents: true, billing: true, logistics: true, issues: true, feedback: true },
      sections: { logistics: completed, issues: completed, feedback: completed },
      clientAcknowledged: true,
    }, actor);
    expect(updated.status).toBe('complete');
    expect(records[0].sections.logistics.completedAt).toEqual(expect.any(String));
    expect(records[0].clientAcknowledgedAt).toEqual(expect.any(Date));
  });

  it('records a deterministic reminder once and never archives', async () => {
    const { service, prisma, records, notifications } = harness();
    await service.runWrapUpReminderSweep(new Date('2026-09-07T12:00:00.000Z'));
    await service.runWrapUpReminderSweep(new Date('2026-09-07T12:00:01.000Z'));
    await service.runWrapUpReminderSweep(new Date('2026-09-08T00:00:00.000Z'));
    expect(records[0].twelveHourReminderAt).toEqual(new Date('2026-09-07T12:00:00.000Z'));
    expect(records[0].twentyFourHourReminderAt).toEqual(new Date('2026-09-08T00:00:00.000Z'));
    expect(notifications.write).toHaveBeenCalledTimes(2);
    expect(prisma.opsEvent.update).toBeUndefined();
  });

  it('builds the eight insight dimensions deterministically from persisted evidence', () => {
    const input = {
      billingStatements: [{ id: 'bill_1' }], outstandingAmount: 100,
      documents: [{ id: 'doc_1' }], postEventDocuments: [], submittedDocuments: [{ id: 'doc_1' }],
      supplierReviews: [], guestFeedback: [{ id: 'feedback_1' }], feedbackDocuments: [], approvedGuestFeedback: [{ id: 'feedback_1' }],
      complianceChecks: [{ id: 'check_1' }], openChecks: [{}], wrapSections: {},
      issues: [], segments: [{ id: 'segment_1' }], lateSegments: [],
    };
    const first = buildInsightDimensions(input);
    const second = buildInsightDimensions(input);
    expect(first).toEqual(second);
    expect(Object.keys(first)).toEqual(['finance', 'documents', 'suppliers', 'feedback', 'compliance', 'logistics', 'issues', 'schedule']);
    expect(first.feedback).toMatchObject({ status: 'evidence', evidence: ['feedback_1'] });
    expect(first.logistics).toMatchObject({ status: 'blocked', evidence: [] });
  });
});
