import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { WorkflowCommandService, OpsUserRole, CoordinatorAssignmentStatus } from '@prism/kernel/event-core';
import { EventAccessPolicyService, type AuditWriter } from '@prism/kernel/access-control';
import { AuditService, AuditWriterAdapter } from '@prism/contexts/platform-ops';
import { NotificationOutboxService, NotificationOutboxWriterAdapter } from '@prism/contexts/platform-ops';
import { CoordinatorAssignmentCommandService } from './coordinator-assignment-command.service';
import { CoordinatorLiveOpsCommandService } from '../../../live-ops/application/coordinator-live-ops-command.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();

function validateDatabaseUrl(value: string) {
  const parsed = new URL(value);
  if (
    parsed.hostname !== '127.0.0.1' ||
    parsed.port !== '55437' ||
    parsed.pathname !== '/prism_p0'
  ) {
    throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
  }
}

if (databaseUrl) validateDatabaseUrl(databaseUrl);

const databaseSuite = describe.skipIf(!databaseUrl);

type Fixture = {
  inquiryId: string;
  eventIds: string[];
  coordinatorIds: string[];
};

const pmcmActor = {
  id: 'p0_w03_pmcm',
  role: OpsUserRole.PmcmAdmin,
  name: 'P0 W03 PMCM',
  email: 'p0-w03-pmcm@example.test',
  explicit: true,
};

function eventId(prefix: string, label: string) {
  return `${prefix}_event_${label}`;
}

async function createFixture(prisma: PrismaService, eventCount: number, coordinatorCount: number): Promise<Fixture> {
  const prefix = `p0_w03_${randomUUID().replaceAll('-', '')}`;
  const inquiryId = `${prefix}_inquiry`;
  const eventIds = Array.from({ length: eventCount }, (_, index) => eventId(prefix, `${index}`));
  const coordinatorIds = Array.from({ length: coordinatorCount }, (_, index) => `${prefix}_coord_${index}`);
  const eventDate = new Date('2031-03-17T09:00:00.000Z');

  await prisma.opsInquiry.create({
    data: {
      id: inquiryId,
      clientName: `${prefix} Client`,
      email: `${prefix}@example.test`,
      eventName: `${prefix} Inquiry`,
      eventDate,
      clientType: 'corporate',
      normalizedEmail: `${prefix}@example.test`,
    },
  });
  await prisma.opsEvent.createMany({
    data: eventIds.map((id, index) => ({
      id,
      inquiryId,
      clientName: `${prefix} Client`,
      eventName: `${prefix} Event ${index}`,
      eventDate,
    })),
  });
  await prisma.opsCoordinator.createMany({
    data: coordinatorIds.map((id, index) => ({
      id,
      name: `${prefix} Coordinator ${index}`,
      email: `${id}@example.test`,
      roleTags: ['Floor Director'],
      active: true,
    })),
  });
  return { inquiryId, eventIds, coordinatorIds };
}

async function cleanupFixture(prisma: PrismaService, fixture: Fixture) {
  await prisma.opsCoordinatorAssignment.deleteMany({ where: { eventId: { in: fixture.eventIds } } });
  await prisma.opsCoordinatorReliabilityNote.deleteMany({ where: { eventId: { in: fixture.eventIds } } });
  await prisma.opsNotificationLog.deleteMany({ where: { eventId: { in: fixture.eventIds } } });
  await prisma.opsAuditLog.deleteMany({ where: { eventId: { in: fixture.eventIds } } });
  await prisma.opsEvent.deleteMany({ where: { id: { in: fixture.eventIds } } });
  await prisma.opsCoordinator.deleteMany({ where: { id: { in: fixture.coordinatorIds } } });
  await prisma.opsInquiry.deleteMany({ where: { id: fixture.inquiryId } });
}

databaseSuite('CoordinatorsService PostgreSQL concurrency invariants', () => {
  let prisma: PrismaService;
  let coordinators: CoordinatorAssignmentCommandService;
  let liveOperations: CoordinatorLiveOpsCommandService;

  beforeAll(async () => {
    if (!databaseUrl) return;
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) {
      process.env[variable] = databaseUrl;
    }
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();

    const auditService = new AuditService(prisma);
    const auditWriter: AuditWriter = new AuditWriterAdapter(auditService);
    const notificationWriter = new NotificationOutboxWriterAdapter(new NotificationOutboxService(prisma));
    const access = new EventAccessPolicyService(auditWriter);
    const workflow = new WorkflowCommandService(new PrismTransactionRunner(prisma));
    coordinators = new CoordinatorAssignmentCommandService(prisma, auditWriter, notificationWriter, workflow, access);
    liveOperations = new CoordinatorLiveOpsCommandService(prisma, auditWriter, notificationWriter, workflow);
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('allows only one competing same-date assignment to commit', async () => {
    const fixture = await createFixture(prisma, 2, 1);
    try {
      const attempts = await Promise.allSettled(
        fixture.eventIds.map((id) => coordinators.assignCoordinator(id, {
          coordinatorId: fixture.coordinatorIds[0],
          role: 'Floor Director',
        }, pmcmActor)),
      );
      expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
      const assignments = await prisma.opsCoordinatorAssignment.findMany({ where: { eventId: { in: fixture.eventIds } } });
      expect(assignments).toHaveLength(1);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });

  it('does not treat cancelled assignments as active same-date conflicts', async () => {
    const fixture = await createFixture(prisma, 2, 1);
    try {
      await prisma.opsCoordinatorAssignment.create({
        data: {
          id: `${fixture.eventIds[0]}_cancelled_assignment`,
          eventId: fixture.eventIds[0],
          coordinatorId: fixture.coordinatorIds[0],
          coordinatorName: 'cancelled fixture coordinator',
          role: 'Floor Director',
          status: CoordinatorAssignmentStatus.Cancelled,
          eventDate: new Date('2031-03-17T09:00:00.000Z'),
        },
      });
      const created = await coordinators.assignCoordinator(fixture.eventIds[1], {
        coordinatorId: fixture.coordinatorIds[0],
        role: 'Floor Director',
      }, pmcmActor);
      expect(created.eventId).toBe(fixture.eventIds[1]);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });

  it('shares the coordinator-day lock between regular assignment and live-ops replacement', async () => {
    const fixture = await createFixture(prisma, 3, 2);
    try {
      const outgoing = await prisma.opsCoordinatorAssignment.create({
        data: {
          id: `${fixture.eventIds[0]}_outgoing_assignment`,
          eventId: fixture.eventIds[0],
          coordinatorId: fixture.coordinatorIds[0],
          coordinatorName: 'outgoing fixture coordinator',
          role: 'Floor Director',
          status: CoordinatorAssignmentStatus.Acknowledged,
          eventDate: new Date('2031-03-17T09:00:00.000Z'),
        },
      });

      const attempts = await Promise.allSettled([
        coordinators.assignCoordinator(fixture.eventIds[2], {
          coordinatorId: fixture.coordinatorIds[1],
          role: 'Floor Director',
        }, pmcmActor),
        liveOperations.replaceCoordinatorAssignment(fixture.eventIds[1], outgoing.id, {
          replacementCoordinatorId: fixture.coordinatorIds[1],
          role: 'Floor Director',
          reason: 'P0 concurrency verification',
        }, pmcmActor),
      ]);
      expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
      const targetAssignments = await prisma.opsCoordinatorAssignment.findMany({
        where: {
          coordinatorId: fixture.coordinatorIds[1],
          eventId: { in: fixture.eventIds },
        },
      });
      expect(targetAssignments).toHaveLength(1);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });
});
