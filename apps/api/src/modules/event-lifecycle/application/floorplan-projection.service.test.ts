import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import { FloorplanProjectionService } from './floorplan-projection.service';

function createService() {
  const event = {
    id: 'evt_floorplan',
    floorPlanProjectionVersion: 0,
    floorPlanStatus: 'not_started',
    floorPlanId: null,
    floorPlanSubmittedAt: null,
    floorPlanReviewedAt: null,
    readiness: 'Planning',
  };
  const prisma = {
    opsEvent: {
      updateMany: vi.fn(async ({ where, data }) => {
        if (where.id !== event.id || event.floorPlanProjectionVersion >= where.floorPlanProjectionVersion.lt) {
          return { count: 0 };
        }
        Object.assign(event, data);
        return { count: 1 };
      }),
      findUnique: vi.fn(async ({ where }) => where.id === event.id ? event : null),
    },
  };
  const service = new FloorplanProjectionService();
  const transaction = { prisma, correlationId: 'floorplan-projection-test' } as unknown as PrismTransactionContext;
  return { service, event, prisma, transaction };
}

describe('FloorplanProjectionService', () => {
  it('applies newer owner state and rejects a delayed older projection', async () => {
    const { service, event, transaction } = createService();
    const newer = {
      eventId: event.id,
      version: 4,
      state: { floorPlanStatus: 'approved', readiness: 'Floorplan approved' },
    };

    await expect(service.project(newer, transaction)).resolves.toEqual({ applied: true, version: 4 });
    await expect(service.project({
      eventId: event.id,
      version: 3,
      state: { floorPlanStatus: 'in_review', readiness: 'Floorplan awaiting review' },
    }, transaction)).rejects.toBeInstanceOf(ConflictException);

    expect(event).toMatchObject({
      floorPlanProjectionVersion: 4,
      floorPlanStatus: 'approved',
      readiness: 'Floorplan approved',
    });
  });

  it('accepts an identical same-version retry and rejects conflicting reuse', async () => {
    const { service, event, transaction } = createService();
    const state = { floorPlanStatus: 'client_submitted', readiness: 'Client layout preference received' };
    await service.project({ eventId: event.id, version: 1, state }, transaction);

    await expect(service.project({ eventId: event.id, version: 1, state }, transaction))
      .resolves.toEqual({ applied: false, version: 1 });
    await expect(service.project({
      eventId: event.id,
      version: 1,
      state: { floorPlanStatus: 'approved' },
    }, transaction)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid versions and empty projection state before writing', async () => {
    const { service, event, prisma, transaction } = createService();

    await expect(service.project({ eventId: event.id, version: 0, state: { floorPlanStatus: 'approved' } }, transaction))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.project({ eventId: event.id, version: 1, state: {} }, transaction))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsEvent.updateMany).not.toHaveBeenCalled();
  });
});
