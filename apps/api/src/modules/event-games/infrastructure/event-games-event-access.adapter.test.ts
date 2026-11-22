import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import type { PrismaService } from '@prism/kernel/database';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismVerifiedEventActor } from '@prism/types';
import { describe, expect, it, vi } from 'vitest';
import { EventGamesEventAccessAdapter } from './event-games-event-access.adapter';

const eventId = 'evt_1';

type FakeAssignment = { coordinatorId: string; status: string; coordinator: { userId: string; email: string } };

function assignment(status: string): FakeAssignment {
  return { coordinatorId: 'coord_1', status, coordinator: { userId: 'user_coord', email: 'coord@example.com' } };
}

/** Fake prisma for readEventAccessScope; the assignment rows stand in for what the scope query returns. */
function createAdapter({ event = { id: eventId, clientName: 'Ana Reyes' } as object | null, assignments = [] as FakeAssignment[] } = {}) {
  const prisma = {
    opsEvent: { findUnique: vi.fn(async () => event) },
    opsSupplierQuoteRequest: { findMany: vi.fn(async () => []) },
    opsCoordinatorAssignment: { findMany: vi.fn(async () => assignments) },
  } as unknown as PrismaService;
  const write = vi.fn();
  const recordIntegrityIncident = vi.fn().mockResolvedValue(undefined);
  const policy = new EventAccessPolicyService({ write, recordIntegrityIncident } as any);
  return { adapter: new EventGamesEventAccessAdapter(prisma, policy), write };
}

function actor(role: string, overrides: Partial<PrismVerifiedEventActor> = {}): PrismVerifiedEventActor {
  const id = role === OpsUserRole.Coordinator ? 'user_coord' : `user_${role}`;
  const email = role === OpsUserRole.Coordinator ? 'coord@example.com' : `${role}@example.com`;
  return {
    id, actorId: id, role, actorRole: role, email, actorEmail: email, name: role, actorName: role,
    expiresAt: '2099-01-01T00:00:00.000Z', sessionId: 'session_1', ...overrides,
  } as PrismVerifiedEventActor;
}

describe('EventGamesEventAccessAdapter', () => {
  it('lets a coordinator with a current assignment host games', async () => {
    const { adapter } = createAdapter({ assignments: [assignment('confirmed')] });
    await expect(adapter.assertHostAccess(eventId, actor(OpsUserRole.Coordinator))).resolves.toBeUndefined();
  });

  it('rejects a coordinator who is not assigned to the event', async () => {
    const { adapter, write } = createAdapter({ assignments: [] });
    await expect(adapter.assertHostAccess(eventId, actor(OpsUserRole.Coordinator))).rejects.toBeInstanceOf(ForbiddenException);
    expect(write).toHaveBeenCalled();
  });

  it('rejects a coordinator whose assignment was declined', async () => {
    const { adapter } = createAdapter({ assignments: [assignment('declined')] });
    await expect(adapter.assertHostAccess(eventId, actor(OpsUserRole.Coordinator))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets PMCM admins host games without an assignment', async () => {
    const { adapter } = createAdapter({ assignments: [] });
    await expect(adapter.assertHostAccess(eventId, actor(OpsUserRole.PmcmAdmin))).resolves.toBeUndefined();
  });

  it('returns NotFound when the event does not exist', async () => {
    const { adapter } = createAdapter({ event: null });
    await expect(adapter.assertHostAccess(eventId, actor(OpsUserRole.PmcmAdmin))).rejects.toBeInstanceOf(NotFoundException);
    await expect(adapter.assertAdminAccess(eventId, actor(OpsUserRole.PmcmAdmin))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps response review for PMCM admins only', async () => {
    const { adapter } = createAdapter({ assignments: [assignment('confirmed')] });
    await expect(adapter.assertAdminAccess(eventId, actor(OpsUserRole.Coordinator))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(adapter.assertAdminAccess(eventId, actor(OpsUserRole.PmcmAdmin))).resolves.toBeUndefined();
  });
});
