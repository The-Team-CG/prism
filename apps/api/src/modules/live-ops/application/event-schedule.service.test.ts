import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { EventScheduleService } from './event-schedule.service';

function service(access: { requireActorRole: ReturnType<typeof vi.fn> }, staffing = {}) {
  return new EventScheduleService({} as never, access as never, {} as never, staffing as never, {} as never);
}

describe('EventScheduleService authority', () => {
  it('keeps operator designation PMCM-only', async () => {
    const access = { requireActorRole: vi.fn().mockRejectedValue(new ForbiddenException('denied')) };
    await expect(service(access).designateOperator('evt_1', { coordinatorId: 'coord_1' }, { id: 'coord_1', name: 'Coordinator', role: 'coordinator' } as never)).rejects.toThrow('denied');
    expect(access.requireActorRole).toHaveBeenCalledWith(expect.anything(), ['pmcm-admin'], 'event day system operator designation', 'evt_1');
  });

  it('does not permit a coordinator to bypass event-day authority checks', async () => {
    const access = { requireActorRole: vi.fn().mockResolvedValue(undefined) };
    const instance = service(access, { findAssignmentForEventActor: vi.fn().mockResolvedValue(null) });
    await expect(instance.createHandoff('evt_1', { dayId: 'day_1', role: 'Lead', fromAssignmentId: 'a_1', toAssignmentId: 'a_2', outstandingItems: [] }, { id: 'coord_1', name: 'Coordinator', role: 'coordinator' } as never)).rejects.toThrow('Coordinator may only act');
  });
});
