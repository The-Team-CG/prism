import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { AuditService, AuditWriterAdapter } from '@prism/contexts/platform-ops';
import { NotificationOutboxService, NotificationOutboxWriterAdapter } from '@prism/contexts/platform-ops';
import { OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { CoordinatorsService } from './coordinators.service';

const event = {
  id: 'evt_main',
  eventName: 'Main Event',
  eventDate: new Date('2026-06-18T00:00:00.000Z'),
};

const coordinator = {
  id: 'coord_marco',
  userId: 'usr_coord',
  name: 'Marco Santos',
  email: 'marco@pmcm.test',
  photoUrl: null,
  roleTags: ['Floor Director'],
  skillsTags: ['floorplan execution'],
  active: true,
  createdAt: new Date('2026-04-29T00:00:00.000Z'),
};

const pmcmAdminActor = { id: 'admin_1', role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true };
const coordinatorActor = { id: 'coord_marco', role: OpsUserRole.Coordinator, name: 'Marco Santos', explicit: true };
const clientActor = { id: 'client_1', role: OpsUserRole.Client, name: 'Some Client', explicit: true };

function createAccessPolicy() {
  return {
    resolveActor: (_input: unknown, verifiedActor?: unknown) => verifiedActor ?? pmcmAdminActor,
    requireActorRole: async (actor: { role: string }, roles: string[], resource: string) => {
      if (!roles.includes(actor.role)) {
        throw new ForbiddenException(`${actor.role} cannot access ${resource}`);
      }
    },
    sameText: (left?: string | null, right?: string | null) =>
      Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase()),
    recordForbiddenAccess: async () => undefined,
  };
}

function createPrisma() {
  const assignments: any[] = [
    {
      id: 'coord_asg_conflict',
      eventId: 'evt_conflict',
      coordinatorId: coordinator.id,
      coordinatorName: coordinator.name,
      role: 'Floor Director',
      status: 'pending_acknowledgement',
      doubleBookingWarning: false,
      eventDate: event.eventDate,
      conflictEventId: null,
      conflictEventName: null,
      acknowledgedAt: null,
      createdAt: new Date('2026-04-28T00:00:00.000Z'),
      event: { id: 'evt_conflict', eventName: 'Other Event' },
    },
  ];
  const notifications: any[] = [];
  const audits: any[] = [];
  const transactionCalls: string[] = [];
  const queryOrder: string[] = [];

  const prisma = {
    opsEvent: { findUnique: async () => event },
    opsCoordinator: {
      findUnique: async () => coordinator,
      findMany: async () => [coordinator],
    },
    opsCoordinatorAssignment: {
      findFirst: async ({ where }: { where?: { id?: string } } = {}) => {
        queryOrder.push('assignment.findFirst');
        if (where?.id) {
          return assignments.find((item) => item.id === where.id) ?? null;
        }
        return assignments[0] ?? null;
      },
      findMany: async ({ where }: { where?: { eventId?: string; coordinatorId?: string; coordinatorName?: string } } = {}) =>
        assignments.filter((assignment) => {
          if (where?.eventId && assignment.eventId !== where.eventId) return false;
          if (where?.coordinatorId && assignment.coordinatorId !== where.coordinatorId) return false;
          if (where?.coordinatorName && assignment.coordinatorName !== where.coordinatorName) return false;
          return true;
        }),
      create: async ({ data }: { data: any }) => {
        const row = { ...data, createdAt: new Date(), event };
        assignments.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const index = assignments.findIndex((item) => item.id === where.id);
        if (index < 0) throw new Error('not found');
        assignments[index] = { ...assignments[index], ...data };
        return assignments[index];
      },
    },
    opsAuditLog: {
      findFirst: async () => null,
      create: async ({ data }: { data: unknown }) => {
        audits.push(data);
        return data;
      },
    },
    opsNotificationLog: {
      findFirst: async ({ where }: { where: { correlationId?: string } }) =>
        notifications.find((notification) => notification.correlationId === where.correlationId) ?? null,
      create: async ({ data }: { data: unknown }) => {
        notifications.push(data);
        return data;
      },
    },
    $transaction: async (callback: (tx: unknown) => unknown) => {
      transactionCalls.push('same_tx');
      return callback(prisma);
    },
    $executeRaw: async () => {
      queryOrder.push('pg_advisory_xact_lock');
      return 0;
    },
  };

  return {
    assignments,
    notifications,
    audits,
    transactionCalls,
    queryOrder,
    prisma,
  };
}

function createService(prisma: any, accessPolicy: any = createAccessPolicy()) {
  return new CoordinatorsService(
    prisma,
    new AuditWriterAdapter(new AuditService(prisma)),
    new NotificationOutboxWriterAdapter(new NotificationOutboxService(prisma)),
    new WorkflowCommandService(new PrismTransactionRunner(prisma)),
    accessPolicy,
  );
}

describe('CoordinatorsService', () => {
  it('blocks a same-date conflict until PMCM overrides it', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);

    await expect(
      service.assignCoordinator(event.id, { coordinatorId: coordinator.id, role: 'Floor Director' }, pmcmAdminActor),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'COORDINATOR_DOUBLE_BOOKING',
        sameRoleSuggestions: [],
      }),
    });

    const assignment = await service.assignCoordinator(
      event.id,
      {
        coordinatorId: coordinator.id,
        role: 'Floor Director',
        overrideConflict: true,
      },
      pmcmAdminActor,
    );

    expect(assignment.doubleBookingWarning).toBe(true);
    expect(assignment.conflictEventName).toBe('Other Event');
    expect(fake.notifications).toHaveLength(2);
    expect(fake.audits).toHaveLength(1);
    expect(fake.transactionCalls).toEqual(['same_tx']);
    expect(fake.queryOrder.lastIndexOf('pg_advisory_xact_lock')).toBeLessThan(
      fake.queryOrder.lastIndexOf('assignment.findFirst'),
    );
  });

  it('rejects assignCoordinator for a non-PmcmAdmin actor', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);

    await expect(
      service.assignCoordinator(
        event.id,
        { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
        clientActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reads active coordinator directory and coordinator assignments for workspace payloads', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);
    await service.assignCoordinator(
      event.id,
      {
        coordinatorId: coordinator.id,
        role: 'Floor Director',
        overrideConflict: true,
      },
      pmcmAdminActor,
    );

    await expect(service.listCoordinators()).resolves.toEqual([
      expect.objectContaining({ id: 'coord_marco', name: 'Marco Santos' }),
    ]);
    const assignments = await service.listAssignmentsForCoordinator(coordinator.id, coordinator.name);
    expect(assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coordinatorId: 'coord_marco',
          eventId: 'evt_main',
          role: 'Floor Director',
        }),
      ]),
    );
  });

  it('acknowledges a pending coordinator assignment for a PmcmAdmin actor', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);
    const created = await service.assignCoordinator(
      event.id,
      {
        coordinatorId: coordinator.id,
        role: 'Floor Director',
        overrideConflict: true,
      },
      pmcmAdminActor,
    );

    const acknowledged = await service.acknowledgeCoordinator(event.id, created.id, pmcmAdminActor);

    expect(acknowledged.status).toBe('acknowledged');
    expect(acknowledged.acknowledgedAt).toBeTruthy();
    expect(fake.transactionCalls).toEqual(['same_tx', 'same_tx']);
  });

  it('allows a Coordinator actor to acknowledge their own assignment (AC8 scoping decision)', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);
    const created = await service.assignCoordinator(
      event.id,
      {
        coordinatorId: coordinator.id,
        role: 'Floor Director',
        overrideConflict: true,
      },
      pmcmAdminActor,
    );

    const acknowledged = await service.acknowledgeCoordinator(event.id, created.id, coordinatorActor);

    expect(acknowledged.status).toBe('acknowledged');
  });

  it('rejects acknowledgeCoordinator for an actor that is neither PmcmAdmin nor Coordinator', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);
    const created = await service.assignCoordinator(
      event.id,
      {
        coordinatorId: coordinator.id,
        role: 'Floor Director',
        overrideConflict: true,
      },
      pmcmAdminActor,
    );

    await expect(service.acknowledgeCoordinator(event.id, created.id, clientActor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects acknowledgeCoordinator when a Coordinator actor is not the assignment owner (PA-276)', async () => {
    const fake = createPrisma();
    const coordinatorB = { ...coordinator, id: 'coord_taylor', name: 'Taylor Cruz', email: 'taylor@pmcm.test' };

    // Local override: this test needs two resolvable coordinators; other tests in this
    // file rely on createPrisma()'s single-coordinator fixture and must stay unaffected.
    (fake.prisma.opsCoordinator as any).findMany = async () => [coordinator, coordinatorB];
    (fake.prisma.opsCoordinator as any).findUnique = async ({ where }: { where: { id: string } }) =>
      [coordinator, coordinatorB].find((item) => item.id === where.id) ?? null;

    const service = createService(fake.prisma as any);
    const assignmentForB = await service.assignCoordinator(
      event.id,
      { coordinatorId: coordinatorB.id, role: 'Floor Director', overrideConflict: true },
      pmcmAdminActor,
    );

    await expect(
      service.acknowledgeCoordinator(event.id, assignmentForB.id, coordinatorActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects acknowledgeCoordinator when the assignment does not belong to the route eventId (PA-276)', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);
    const created = await service.assignCoordinator(
      event.id,
      { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
      pmcmAdminActor,
    );

    await expect(
      service.acknowledgeCoordinator('evt_conflict', created.id, pmcmAdminActor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects acknowledgeCoordinator when the assignment is already withdrawn or replaced', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);
    const created = await service.assignCoordinator(
      event.id,
      { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
      pmcmAdminActor,
    );
    await service.withdrawCoordinator(event.id, created.id, {}, pmcmAdminActor);

    await expect(
      service.acknowledgeCoordinator(event.id, created.id, pmcmAdminActor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-owning Coordinator with Forbidden even when the assignment is withdrawn or replaced, ownership checked before status', async () => {
    const fake = createPrisma();
    const coordinatorB = { ...coordinator, id: 'coord_taylor', name: 'Taylor Cruz', email: 'taylor@pmcm.test' };
    (fake.prisma.opsCoordinator as any).findMany = async () => [coordinator, coordinatorB];
    (fake.prisma.opsCoordinator as any).findUnique = async ({ where }: { where: { id: string } }) =>
      [coordinator, coordinatorB].find((item) => item.id === where.id) ?? null;

    const service = createService(fake.prisma as any);
    const assignmentForB = await service.assignCoordinator(
      event.id,
      { coordinatorId: coordinatorB.id, role: 'Floor Director', overrideConflict: true },
      pmcmAdminActor,
    );
    await service.withdrawCoordinator(event.id, assignmentForB.id, {}, pmcmAdminActor);

    await expect(
      service.acknowledgeCoordinator(event.id, assignmentForB.id, coordinatorActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('withdrawCoordinator', () => {
    it('withdraws a pending assignment', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);
      const created = await service.assignCoordinator(
        event.id,
        { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
        pmcmAdminActor,
      );

      const withdrawn = await service.withdrawCoordinator(event.id, created.id, { reason: 'No longer available' }, pmcmAdminActor);

      expect(withdrawn.status).toBe('cancelled');
      expect(fake.notifications.length).toBeGreaterThan(0);
      expect(fake.audits.some((entry: any) => entry.action?.includes('Withdrew'))).toBe(true);
    });

    it('rejects a non-PmcmAdmin actor', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);
      const created = await service.assignCoordinator(
        event.id,
        { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
        pmcmAdminActor,
      );

      await expect(
        service.withdrawCoordinator(event.id, created.id, {}, coordinatorActor),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects withdrawing an assignment that is already cancelled or replaced', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);
      const created = await service.assignCoordinator(
        event.id,
        { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
        pmcmAdminActor,
      );
      await service.withdrawCoordinator(event.id, created.id, {}, pmcmAdminActor);

      await expect(
        service.withdrawCoordinator(event.id, created.id, {}, pmcmAdminActor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects withdrawing an assignment that does not exist', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);

      await expect(
        service.withdrawCoordinator(event.id, 'coord_asg_missing', {}, pmcmAdminActor),
      ).rejects.toThrow('Coordinator assignment not found');
    });
  });

  describe('replaceCoordinator', () => {
    it('replaces an assignment with a new coordinator atomically', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);
      const created = await service.assignCoordinator(
        event.id,
        { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
        pmcmAdminActor,
      );
      fake.transactionCalls.length = 0;

      const result = await service.replaceCoordinator(
        event.id,
        created.id,
        { replacementCoordinatorId: coordinator.id, replacementRole: 'Floor Director', reason: 'Scheduling conflict', overrideConflict: true },
        pmcmAdminActor,
      );

      expect(result.outgoing.status).toBe('replaced');
      expect(result.outgoing.replacedByAssignmentId).toBe(result.incoming.id);
      expect(result.outgoing.replacementReason).toBe('Scheduling conflict');
      expect(result.outgoing.replacedBy).toBe(pmcmAdminActor.name);
      expect(result.incoming.status).toBe('pending_acknowledgement');
      expect(fake.transactionCalls).toEqual(['same_tx']);
    });

    it('rejects a non-PmcmAdmin actor', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);
      const created = await service.assignCoordinator(
        event.id,
        { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
        pmcmAdminActor,
      );

      await expect(
        service.replaceCoordinator(
          event.id,
          created.id,
          { replacementCoordinatorId: coordinator.id, overrideConflict: true },
          coordinatorActor,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a same-date conflict on the replacement coordinator until overridden', async () => {
      const fake = createPrisma();
      const service = createService(fake.prisma as any);
      const created = await service.assignCoordinator(
        event.id,
        { coordinatorId: coordinator.id, role: 'Floor Director', overrideConflict: true },
        pmcmAdminActor,
      );

      await expect(
        service.replaceCoordinator(
          event.id,
          created.id,
          { replacementCoordinatorId: coordinator.id, replacementRole: 'Floor Director' },
          pmcmAdminActor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
