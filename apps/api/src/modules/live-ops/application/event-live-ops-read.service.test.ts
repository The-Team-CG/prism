import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventLiveOpsReadService } from './event-live-ops-read.service';

const schedule = { eventId: 'evt_1', authored: true, days: [], serverTime: '2026-07-03T09:00:00.000Z' };

function actorWithRole(role: string, name = 'Actor'): ResolvedEventOpsActor {
  return { id: `user_${role}`, role: role as ResolvedEventOpsActor['role'], name, explicit: true, verified: true };
}

function createService(readModel: { getEventLiveOps: ReturnType<typeof vi.fn> }) {
  const policy = new EventAccessPolicyService({ write: vi.fn() } as never);
  return new EventLiveOpsReadService(readModel as never, policy);
}

describe('EventLiveOpsReadService coordinator event schedule', () => {
  it('returns the published schedule and event status to a coordinator assigned to the event', async () => {
    const readModel = {
      getEventLiveOps: vi.fn(async () => ({
        event: { id: 'evt_1', status: 'live' },
        schedule,
        tasks: [{ id: 'task_1' }],
        guestCheckIns: [{ id: 'checkin_1' }],
        supplierStatuses: [{ id: 'quote_1' }],
      })),
    };
    const coordinator = actorWithRole(OpsUserRole.Coordinator, 'Marco');

    const result = await createService(readModel).getCoordinatorEventSchedule('evt_1', coordinator);

    expect(readModel.getEventLiveOps).toHaveBeenCalledWith('evt_1', coordinator);
    expect(result).toEqual({ eventId: 'evt_1', eventStatus: 'live', schedule });
  });

  it('propagates the read model refusal for a coordinator who is not assigned to the event', async () => {
    const readModel = {
      getEventLiveOps: vi.fn(async () => {
        throw new ForbiddenException('Coordinator is not assigned to this event');
      }),
    };

    await expect(
      createService(readModel).getCoordinatorEventSchedule('evt_other', actorWithRole(OpsUserRole.Coordinator, 'Marco')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(readModel.getEventLiveOps).toHaveBeenCalledWith('evt_other', expect.objectContaining({ role: OpsUserRole.Coordinator }));
  });

  it.each([
    ['PMCM admin', OpsUserRole.PmcmAdmin],
    ['client', OpsUserRole.Client],
    ['supplier', OpsUserRole.Supplier],
  ])('refuses a %s actor at the role gate without reading live ops', async (_label, role) => {
    const readModel = { getEventLiveOps: vi.fn(async () => ({ event: { status: 'live' }, schedule })) };

    await expect(
      createService(readModel).getCoordinatorEventSchedule('evt_1', actorWithRole(role)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(readModel.getEventLiveOps).not.toHaveBeenCalled();
  });
});
