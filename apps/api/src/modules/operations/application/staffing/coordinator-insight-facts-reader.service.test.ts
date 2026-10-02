import { describe, expect, it, vi } from 'vitest';
import { CoordinatorInsightFactsReaderService } from './coordinator-insight-facts-reader.service';

describe('CoordinatorInsightFactsReaderService', () => {
  it('returns event-scoped counts for assignments and reliability history', async () => {
    const assignmentCounts = new Map([
      ['all', 5],
      ['pending_acknowledgement', 1],
      ['late', 1],
      ['absent', 0],
      ['replaced', 2],
      ['cancelled', 1],
    ]);
    const assignmentCount = vi.fn(async ({ where }: any) =>
      assignmentCounts.get(where.status ?? where.attendanceStatus ?? 'all') ?? 0,
    );
    const reliabilityCount = vi.fn(async ({ where }: any) => where.eventId === 'evt_1' ? 3 : 0);
    const service = new CoordinatorInsightFactsReaderService({
      opsCoordinatorAssignment: { count: assignmentCount },
      opsCoordinatorReliabilityNote: { count: reliabilityCount },
    } as never);

    await expect(service.getForEvent('evt_1')).resolves.toEqual({
      assignments: 5,
      awaitingAcknowledgement: 1,
      lateAttendance: 1,
      absentAttendance: 0,
      replacedAssignments: 2,
      cancelledAssignments: 1,
      reliabilityNotes: 3,
    });
    expect(assignmentCount).toHaveBeenCalledTimes(6);
    expect(assignmentCount.mock.calls.every(([input]) => input.where.eventId === 'evt_1')).toBe(true);
    expect(assignmentCount).toHaveBeenCalledWith({ where: { eventId: 'evt_1', status: 'pending_acknowledgement' } });
    expect(assignmentCount).toHaveBeenCalledWith({ where: { eventId: 'evt_1', status: 'replaced' } });
    expect(assignmentCount).toHaveBeenCalledWith({ where: { eventId: 'evt_1', status: 'cancelled' } });
    expect(reliabilityCount).toHaveBeenCalledWith({ where: { eventId: 'evt_1' } });
  });
});
