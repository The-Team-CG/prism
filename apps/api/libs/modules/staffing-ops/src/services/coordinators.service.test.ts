import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PrismTransactionRunner } from '../../../../core/shared-kernel/src';
import { AuditService, AuditWriterAdapter } from '@prism/modules/trust-ops';
import { NotificationOutboxService, NotificationOutboxWriterAdapter } from '@prism/modules/notification-ops';
import { WorkflowCommandService } from '@prism/modules/event-core';
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

  const prisma = {
    opsEvent: { findUnique: async () => event },
    opsCoordinator: {
      findUnique: async () => coordinator,
      findMany: async () => [coordinator],
    },
    opsCoordinatorAssignment: {
      findFirst: async () => assignments[0],
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
      update: async ({ data }: { data: any }) => {
        assignments[1] = { ...assignments[1], ...data };
        return assignments[1];
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
  };

  return {
    assignments,
    notifications,
    audits,
    transactionCalls,
    prisma,
  };
}

function createService(prisma: any) {
  return new CoordinatorsService(
    prisma,
    new AuditWriterAdapter(new AuditService(prisma)),
    new NotificationOutboxWriterAdapter(new NotificationOutboxService(prisma)),
    new WorkflowCommandService(new PrismTransactionRunner(prisma)),
  );
}
describe('CoordinatorsService', () => {
  it('blocks a same-date conflict until PMCM overrides it', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);

    await expect(
      service.assignCoordinator(event.id, { coordinatorId: coordinator.id, role: 'Floor Director' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const assignment = await service.assignCoordinator(event.id, {
      coordinatorId: coordinator.id,
      role: 'Floor Director',
      overrideConflict: true,
    });

    expect(assignment.doubleBookingWarning).toBe(true);
    expect(assignment.conflictEventName).toBe('Other Event');
    expect(fake.notifications).toHaveLength(2);
    expect(fake.audits).toHaveLength(1);
    expect(fake.transactionCalls).toEqual(['same_tx']);
  });


  it('reads active coordinator directory and coordinator assignments for workspace payloads', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);
    await service.assignCoordinator(event.id, {
      coordinatorId: coordinator.id,
      role: 'Floor Director',
      overrideConflict: true,
    });

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

  it('acknowledges a pending coordinator assignment', async () => {
    const fake = createPrisma();
    const service = createService(fake.prisma as any);
    await service.assignCoordinator(event.id, {
      coordinatorId: coordinator.id,
      role: 'Floor Director',
      overrideConflict: true,
    });

    const acknowledged = await service.acknowledgeCoordinator(event.id, 'coord_asg_new');

    expect(acknowledged.status).toBe('acknowledged');
    expect(acknowledged.acknowledgedAt).toBeTruthy();
    expect(fake.transactionCalls).toEqual(['same_tx', 'same_tx']);
  });
});

