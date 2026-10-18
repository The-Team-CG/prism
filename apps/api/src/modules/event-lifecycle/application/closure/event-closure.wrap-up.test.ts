import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { buildInsightDimensions, EventClosureService } from './event-closure.service';

const actor = { id: 'pmcm_1', name: 'PMCM', email: 'pmcm@test', role: OpsUserRole.PmcmAdmin } as any;
function harness(actualEndedAt: Date | null = new Date('2026-09-07T00:00:00.000Z')) {
  const event = { id: 'evt_1', clientName: 'Client', eventName: 'Event', status: 'event_day', archived: false, actualEndedAt, actualEndedBy: 'pmcm_1', inquiry: { email: 'client@example.test' } };
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
    opsComplianceCheck: { findMany: vi.fn(async () => [{ id: 'check_1', title: 'Open item', status: 'open' }]) },
    opsDocument: { findMany: vi.fn(async () => [{ id: 'doc_1', type: 'closeout', status: 'submitted' }]) },
    opsPostEventDocument: { findMany: vi.fn(async () => []) },
    opsLogisticsCompletion: { findUnique: vi.fn(async () => null) },
  };
  const prisma: any = { ...tx, opsEvent: tx.opsEvent, opsEventWrapUp: tx.opsEventWrapUp, $transaction: vi.fn(async (fn: any) => fn(tx)) };
  const policy: any = { requireActorRole: vi.fn(async (subject: any, roles: string[]) => { if (!roles.includes(subject.role)) throw new ForbiddenException(); }) };
  const notifications = { write: vi.fn(async () => undefined) };
  const commercialFactsReader = { getLifecycleFacts: vi.fn(async () => ({
    supplierQuoteRequests: [], billingSources: [], supplierReviews: [{ id: 'review_1', supplierId: 'supplier_1', rating: 5, notes: 'Good', reviewedBy: 'PMCM' }],
    billingStatements: [{ id: 'bill_1', totalAmount: 1000 }], paymentMilestones: [{ id: 'payment_1', amountPaid: 400, remainingBalance: 600 }],
  })) };
  const lifecycleFactsReader = { getClosureFacts: vi.fn(async () => ({
    guestFeedback: [{ id: 'feedback_1', rating: 5, moderationStatus: 'approved', privacyConsentAccepted: true, privacyConsentWithdrawnAt: null }],
    issues: [{ id: 'issue_1' }], scheduleDays: [{ id: 'day_1', segments: [{ id: 'segment_1', actualEndedAt: new Date('2026-09-07T13:00:00.000Z'), plannedEndAt: new Date('2026-09-07T12:00:00.000Z') }] }],
  })) };
  const service = new EventClosureService(prisma, {} as any, {} as any, { write: vi.fn(async () => undefined) } as any, policy, notifications as any, {} as any,
    commercialFactsReader as any, lifecycleFactsReader as any);
  return { service, prisma, tx, records, policy, notifications, commercialFactsReader, lifecycleFactsReader };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-08T00:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('EventClosureService wrap-up', () => {
  it('composes Commercial and Operations/LiveOps read-model facts into closeout insight', async () => {
    const { service, commercialFactsReader, lifecycleFactsReader } = harness();
    const facts = await (service as any).buildEventInsightContext('evt_1', { id: 'evt_1', eventName: 'Event' }, {
      assignments: 1, awaitingAcknowledgement: 0, lateAttendance: 0, absentAttendance: 0,
      replacedAssignments: 0, cancelledAssignments: 0, reliabilityNotes: 0,
    });

    expect(facts.financialSummary).toEqual({ billingCount: 1, totalBilled: 1000, amountPaid: 400, outstandingAmount: 600 });
    expect(facts.supplierNotes).toEqual([{ supplierId: 'supplier_1', rating: 5, notes: 'Good', reviewedBy: 'PMCM' }]);
    expect(facts.feedbackSummary).toMatchObject({ guestFeedback: 1, approvedGuestFeedback: 1, averageGuestRating: 5 });
    expect(facts.dimensions.schedule.summary).toBe('1 schedule segment(s) ended late');
    expect(commercialFactsReader.getLifecycleFacts).toHaveBeenCalledWith('evt_1');
    expect(lifecycleFactsReader.getClosureFacts).toHaveBeenCalledWith('evt_1');
  });

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
    expect(records[0].acknowledgementRecordedBy).toBe(actor.id);
    expect(records[0].acknowledgementSource).toBe('pmcm_recorded');
  });

  it('records a deterministic reminder once and never archives', async () => {
    const { service, prisma, records, notifications } = harness();
    await service.startWrapUp('evt_1', { mode: 'full' }, actor);
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
      complianceChecks: [{ id: "check_1" }], openChecks: [{}], logisticsCompletion: null,
      issues: [], segments: [{ id: 'segment_1' }], lateSegments: [],
      coordinatorFacts: {
        assignments: 4, awaitingAcknowledgement: 1, lateAttendance: 1, absentAttendance: 0,
        replacedAssignments: 1, cancelledAssignments: 0, reliabilityNotes: 2,
      },
    };
    const first = buildInsightDimensions(input);
    const second = buildInsightDimensions(input);
    expect(first).toEqual(second);
    expect(Object.keys(first)).toEqual(['finance', 'documents', 'suppliers', 'feedback', 'compliance', 'logistics', 'issues', 'schedule', 'coordinators']);
    expect(first.feedback).toMatchObject({ status: 'evidence', evidence: ['feedback_1'] });
    expect(first.logistics).toMatchObject({ status: 'blocked', evidence: [] });
    expect(first.coordinators).toMatchObject({
      status: 'evidence',
      summary: '4 assignment(s); 1 awaiting acknowledgement; 1 late; 0 absent; 1 replaced; 0 cancelled or released; 2 reliability note(s)',
    });
  });
});
