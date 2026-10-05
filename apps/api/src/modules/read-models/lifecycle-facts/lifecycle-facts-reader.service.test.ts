import { describe, expect, it, vi } from 'vitest';
import { LifecycleFactsReaderService } from './lifecycle-facts-reader.service';

function client() {
  return {
    opsEventCoverageRequirement: { findMany: vi.fn(async () => [{ role: 'Coordinator', required: 2 }]) },
    opsCoordinatorAssignment: { findMany: vi.fn(async () => [{ role: 'Coordinator', status: 'acknowledged', withdrawnAt: null }]) },
    opsGuestRosterEntry: { count: vi.fn(async () => 7) },
    opsGuestFeedback: { findMany: vi.fn(async () => [{ id: 'feedback_1', rating: 5, moderationStatus: 'approved', privacyConsentAccepted: true, privacyConsentWithdrawnAt: null }]) },
    opsUrgentIssue: { findMany: vi.fn(async () => [{ id: 'issue_1' }]) },
    opsEventScheduleDay: { findMany: vi.fn(async () => [{ id: 'day_1', segments: [{ id: 'segment_1', actualEndedAt: null, plannedEndAt: new Date('2026-10-06T13:00:00.000Z') }] }]) },
  };
}

describe('LifecycleFactsReaderService', () => {
  it('returns event-scoped compliance facts from staffing and guest storage', async () => {
    const prisma = client();
    const reader = new LifecycleFactsReaderService(prisma as never);

    await expect(reader.getComplianceFacts('evt_1')).resolves.toEqual({
      coverageRequirements: [{ role: 'Coordinator', required: 2 }],
      coordinatorAssignments: [{ role: 'Coordinator', status: 'acknowledged', withdrawnAt: null }],
      guestRosterCount: 7,
    });
    expect(prisma.opsEventCoverageRequirement.findMany).toHaveBeenCalledWith({
      where: { eventId: 'evt_1' }, select: { role: true, required: true },
    });
    expect(prisma.opsGuestRosterEntry.count).toHaveBeenCalledWith({ where: { eventId: 'evt_1' } });
  });

  it('returns only closeout insight fields from guest feedback, urgent issues, and schedule', async () => {
    const prisma = client();
    const reader = new LifecycleFactsReaderService(prisma as never);

    const facts = await reader.getClosureFacts('evt_1');
    expect(facts.guestFeedback[0]).toMatchObject({ id: 'feedback_1', rating: 5, privacyConsentAccepted: true });
    expect(facts.issues).toEqual([{ id: 'issue_1' }]);
    expect(facts.scheduleDays[0].segments[0].id).toBe('segment_1');
    expect(prisma.opsGuestFeedback.findMany).toHaveBeenCalledWith({
      where: { eventId: 'evt_1' },
      select: { id: true, rating: true, moderationStatus: true, privacyConsentAccepted: true, privacyConsentWithdrawnAt: true },
    });
    expect(prisma.opsEventScheduleDay.findMany).toHaveBeenCalledWith({
      where: { eventId: 'evt_1' },
      include: { segments: { select: { id: true, actualEndedAt: true, plannedEndAt: true } } },
    });
  });

  it('uses a caller transaction client when supplied', async () => {
    const prisma = client();
    const transaction = client();
    const reader = new LifecycleFactsReaderService(prisma as never);

    await reader.getComplianceFacts('evt_2', transaction as never);
    expect(transaction.opsGuestRosterEntry.count).toHaveBeenCalledWith({ where: { eventId: 'evt_2' } });
    expect(prisma.opsGuestRosterEntry.count).not.toHaveBeenCalled();
  });
});
