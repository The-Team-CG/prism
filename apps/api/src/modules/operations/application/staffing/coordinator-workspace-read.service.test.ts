import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { CoordinatorWorkspaceReadService } from './coordinator-workspace-read.service';

const actor = { id: 'actor_coordinator', role: OpsUserRole.Coordinator, actorRole: OpsUserRole.Coordinator };
const coordinator = { id: 'coord_1', name: 'Marco Santos' };

function event(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    inquiryId: `inq_${id}`,
    clientName: 'Ana Reyes',
    eventName: `Event ${id}`,
    eventDate: new Date('2026-10-04T00:00:00.000Z'),
    status: 'planning',
    clientPortalStatus: 'unlocked',
    readiness: 'ready',
    archived: false,
    floorPlanStatus: 'pending',
    floorPlanId: null,
    floorPlanDrafts: [],
    briefings: [],
    ...overrides,
  };
}

describe('CoordinatorWorkspaceReadService', () => {
  it('returns venue and event cards only for the coordinator assigned events, including historical assignments', async () => {
    const assignments = [
      { id: 'assignment_1', eventId: 'evt_1', status: 'acknowledged' },
      { id: 'assignment_2', eventId: 'evt_2', status: 'replaced' },
    ];
    const listCoordinatorWorkspaceEvents = vi.fn(async () => [
      event('evt_1', { briefings: [{ venue: 'Updated Hall' }, { venue: 'Old Hall' }] }),
      event('evt_2', { eventDate: new Date('2026-08-01T00:00:00.000Z'), briefings: [{ venue: 'Historic Hall' }] }),
      event('evt_unassigned', { briefings: [{ venue: 'Private Venue' }] }),
    ]);
    const access = { requireActorRole: vi.fn(async () => undefined) };
    const staffing = {
      resolveCoordinatorForActor: vi.fn(async () => coordinator),
      listAssignmentsForCoordinator: vi.fn(async () => assignments),
      mapCoordinator: vi.fn(() => ({ id: coordinator.id, name: coordinator.name })),
      mapCoordinatorAssignment: vi.fn((assignment: (typeof assignments)[number]) => assignment),
    };
    const eventProjections = { listCoordinatorWorkspaceEvents };
    const floorplan = { mapFloorPlanDraft: vi.fn() };
    const guests = { guestAccessCode: vi.fn(() => 'GUEST-CODE') };
    const service = new CoordinatorWorkspaceReadService(
      eventProjections as never,
      access as never,
      staffing as never,
      floorplan as never,
      guests as never,
    );

    const result = await service.listCoordinatorWorkspace(actor as never);

    expect(access.requireActorRole).toHaveBeenCalledWith(actor, [OpsUserRole.Coordinator], 'coordinator workspace');
    expect(staffing.listAssignmentsForCoordinator).toHaveBeenCalledWith(coordinator.id, { includeHistorical: true });
    expect(listCoordinatorWorkspaceEvents).toHaveBeenCalledWith(['evt_1', 'evt_2']);
    expect(result.events).toMatchObject([
      { id: 'evt_1', venue: 'Updated Hall' },
      { id: 'evt_2', venue: 'Historic Hall' },
    ]);
    expect(result.events).toHaveLength(2);
  });
});
