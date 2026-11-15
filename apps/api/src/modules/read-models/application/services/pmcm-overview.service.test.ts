import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { FILE_SUMMARY_EVENT_LIMIT, PmcmOverviewService } from './pmcm-overview.service';

function harness(allowed: boolean) {
  const queries = {
    openMilestones: vi.fn(async () => [{ id: 'm1', eventId: 'e1', label: 'Downpayment', amount: 50_000, amountPaid: 0, creditApplied: 0, dueDate: new Date('2099-01-01T00:00:00.000Z') }]),
    participations: vi.fn(async () => [{ threadId: 't1', lastReadAt: null, thread: { eventId: 'e1' } }]),
    messagesFromOthers: vi.fn(async () => [{ threadId: 't1', createdAt: new Date('2026-11-04T10:00:00.000Z') }]),
    events: vi.fn(async () => []),
    quoteDeadlines: vi.fn(async () => []),
    milestonesDue: vi.fn(async () => []),
    ocularVisits: vi.fn(async () => []),
    supplierSchedules: vi.fn(async () => []),
    eventNames: vi.fn(async () => []),
    clientOfEvent: vi.fn(async (eventId: string) => (eventId === 'e1' ? { email: 'ana@ayala.test', lastLoginAt: new Date('2026-11-11T02:00:00.000Z') } : null)),
    unreadEventNotices: vi.fn(async () => 2),
    activeEventIds: vi.fn(async (limit: number) => Array.from({ length: Math.min(limit, 7) }, (_, index) => ({ id: `e${index + 1}` }))),
  };
  const fileRequirements = {
    buildForEvent: vi.fn(async (eventId: string) => ({
      eventId,
      items: [
        { status: 'missing', overdue: true },
        { status: 'pending', overdue: false },
        { status: 'approved', overdue: false },
        { status: 'complete', overdue: false },
      ],
    })),
  };
  const policy = { requireActorRole: vi.fn(async () => { if (!allowed) throw new ForbiddenException('Role is not allowed'); }) };
  return { queries, policy, fileRequirements, service: new PmcmOverviewService(queries as never, policy as never, fileRequirements as never) };
}

const pmcm = { id: 'u_pmcm', role: 'pmcm-admin', name: 'PMCM' } as never;

describe('PmcmOverviewService', () => {
  it("tells PMCM when the event's client last signed in and how many notices about it they have not opened", async () => {
    const { service, queries } = harness(true);
    await expect(service.clientActivity(pmcm, 'e1')).resolves.toEqual({ eventId: 'e1', lastActiveAt: '2026-11-11T02:00:00.000Z', unreadNotices: 2 });
    expect(queries.unreadEventNotices).toHaveBeenCalledWith('e1', 'ana@ayala.test');
    await expect(service.clientActivity(pmcm, 'missing')).rejects.toThrow('Event not found');
    await expect(harness(false).service.clientActivity({ role: 'client' } as never, 'e1')).rejects.toBeInstanceOf(ForbiddenException);
  });


  it('summarises what each event owes and how many messages the signed-in admin has not read', async () => {
    const { service, queries } = harness(true);
    const result = await service.eventSummaries(pmcm);

    expect(result.items).toEqual([{ eventId: 'e1', balanceDue: 50_000, nextPaymentDue: '2099-01-01', overdueMilestones: 0, unreadMessages: 1 }]);
    expect(queries.participations).toHaveBeenCalledWith('u_pmcm');
  });

  it('reads no unread messages for an actor without an account id', async () => {
    const { service, queries } = harness(true);
    const result = await service.eventSummaries({ role: 'system', name: 'System' } as never);

    expect(queries.participations).not.toHaveBeenCalled();
    expect(result.items[0].unreadMessages).toBe(0);
  });

  it('summarises each active event\'s open and overdue file requirements, within the event cap', async () => {
    const { service, queries, fileRequirements } = harness(true);
    const result = await service.fileSummaries(pmcm);

    expect(queries.activeEventIds).toHaveBeenCalledWith(FILE_SUMMARY_EVENT_LIMIT);
    expect(fileRequirements.buildForEvent).toHaveBeenCalledTimes(7);
    expect(result.items).toHaveLength(7);
    expect(result.items[0]).toEqual({ eventId: 'e1', total: 4, open: 2, overdue: 1 });
  });

  it.each(['supplier', 'client', 'coordinator'])('refuses a %s before reading anything', async (role) => {
    const { service, queries, fileRequirements } = harness(false);
    const actor = { id: 'u', role, name: 'Someone' } as never;

    await expect(service.fileSummaries(actor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(queries.activeEventIds).not.toHaveBeenCalled();
    expect(fileRequirements.buildForEvent).not.toHaveBeenCalled();
    await expect(service.eventSummaries(actor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.calendar(actor, { from: '2026-11-01', to: '2026-11-30' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(queries.openMilestones).not.toHaveBeenCalled();
    expect(queries.events).not.toHaveBeenCalled();
  });
});
