import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PlansService } from './plans.service';

function floorPlanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan_event_1',
    name: 'Client editable plan',
    venue: 'Client venue',
    width: 30,
    height: 20,
    gridSize: 1,
    pax: 120,
    ownerId: 'owner_sample',
    templateId: null,
    eventId: 'evt_1',
    objects: [],
    guests: [],
    suppliers: [],
    seats: [],
    seatCategories: [],
    updatedAt: new Date('2026-05-05T00:00:00.000Z'),
    ...overrides,
  };
}

function draft(status = 'in_review', clientName = 'Ana Reyes') {
  return {
    id: 'draft_1',
    status,
    createdByRole: 'pmcm-admin',
    event: {
      id: 'evt_1',
      clientName,
      clientPortalStatus: 'unlocked',
    },
  };
}

function createService(opsDraft: unknown) {
  const prisma: any = {};
  const update = vi.fn().mockResolvedValue(floorPlanRow());

  prisma.floorPlanObject = {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  prisma.floorPlan = {
    findUnique: vi.fn().mockResolvedValue({ ...floorPlanRow(), opsDraft }),
    upsert: vi.fn().mockResolvedValue(floorPlanRow()),
    update,
  };
  prisma.$transaction = vi.fn(async (callback) =>
    callback({
      floorPlan: prisma.floorPlan,
      floorPlanObject: prisma.floorPlanObject,
    }),
  );

  return { service: new PlansService(prisma), prisma };
}

describe('PlansService client floorplan permissions', () => {
  it('does not create a fallback floorplan when a plan id is missing', async () => {
    const { service, prisma } = createService(null);
    prisma.floorPlan.findUnique.mockResolvedValue(null);

    await expect(service.getPlan('missing_plan')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.floorPlan.upsert).not.toHaveBeenCalled();
  });


  it('allows a client to read their own unlocked event floorplan', async () => {
    const { service } = createService(draft('approved', 'Ana Reyes'));

    await expect(
      service.getPlan('plan_event_1', { actorRole: 'client', clientName: 'Ana Reyes' }),
    ).resolves.toMatchObject({ id: 'plan_event_1' });
  });

  it('blocks a client from reading another client event floorplan', async () => {
    const { service } = createService(draft('approved', 'Ana Reyes'));

    await expect(
      service.getPlan('plan_event_1', { actorRole: 'client', clientName: 'Other Client' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks anonymous plan reads', async () => {
    const { service } = createService(draft('approved', 'Ana Reyes'));

    await expect(service.getPlan('plan_event_1')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('allows a client to update their own unlocked event floorplan before approval', async () => {
    const { service, prisma } = createService(draft('in_review', 'Ana Reyes'));

    await expect(
      service.updatePlan('plan_event_1', { objects: [] }, { actorRole: 'client', clientName: 'Ana Reyes' }),
    ).resolves.toMatchObject({ id: 'plan_event_1' });

    expect(prisma.floorPlan.update).toHaveBeenCalled();
  });

  it('blocks a client from updating another client event floorplan', async () => {
    const { service } = createService(draft('in_review', 'Ana Reyes'));

    await expect(
      service.updatePlan('plan_event_1', { objects: [] }, { actorRole: 'client', clientName: 'Other Client' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks a client from updating an approved floorplan', async () => {
    const { service } = createService(draft('approved', 'Ana Reyes'));

    await expect(
      service.updatePlan('plan_event_1', { objects: [] }, { actorRole: 'client', clientName: 'Ana Reyes' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps PMCM floorplan updates available', async () => {
    const { service, prisma } = createService(draft('approved', 'Ana Reyes'));

    await expect(
      service.updatePlan('plan_event_1', { objects: [] }, { actorRole: 'pmcm-admin' }),
    ).resolves.toMatchObject({ id: 'plan_event_1' });

    expect(prisma.floorPlan.findUnique).not.toHaveBeenCalled();
    expect(prisma.floorPlan.update).toHaveBeenCalled();
  });
});
