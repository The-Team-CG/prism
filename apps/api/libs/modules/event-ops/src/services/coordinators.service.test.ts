import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AuditService } from './audit.service';
import { CoordinatorsService } from './coordinators.service';
import { NotificationOutboxService } from './notification-outbox.service';
import { WorkflowCommandService } from './workflow-command.service';

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
  const notifications: unknown[] = [];
  const audits: unknown[] = [];

  return {
    assignments,
    notifications,
    audits,
    prisma: {
      opsEvent: { findUnique: async () => event },
      opsCoordinator: {
        findUnique: async () => coordinator,
        findMany: async () => [coordinator],
      },
      opsCoordinatorAssignment: {
        findFirst: async () => assignments[0],
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
        create: async ({ data }: { data: unknown }) => {
          notifications.push(data);
          return data;
        },
      },
    },
  };
}

function createService(prisma: any) {
  return new CoordinatorsService(
    prisma,
    new AuditService(prisma),
    new NotificationOutboxService(prisma),
    new WorkflowCommandService(),
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
  });
});

