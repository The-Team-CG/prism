import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { WorkflowCommandService, OpsUserRole, CoordinatorAssignmentStatus } from '@prism/kernel/event-core';
import { EventAccessPolicyService, type AuditWriter } from '@prism/kernel/access-control';
import { AuditService, AuditWriterAdapter, SecurityOperationsService } from '@prism/contexts/platform-ops';
import { NotificationOutboxService, NotificationOutboxWriterAdapter } from '@prism/contexts/platform-ops';
import { CoordinatorAssignmentCommandService } from './coordinator-assignment-command.service';
import { CoordinatorReliabilityNoteWriterService } from './coordinator-reliability-note-writer.service';
import { CoordinatorSuggestionsService } from './coordinator-suggestions.service';
import { CoordinatorLiveOpsCommandService } from '../../../live-ops/application/coordinator-live-ops-command.service';
import { EventDecisionService } from '../../../event-lifecycle/application/decisions/event-decision.service';

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
  let auditWriter: AuditWriter;
  let notificationWriter: NotificationOutboxWriterAdapter;

  beforeAll(async () => {
    if (!databaseUrl) return;
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) {
      process.env[variable] = databaseUrl;
    }
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();

    const auditService = new AuditService(prisma);
    auditWriter = new AuditWriterAdapter(auditService, new SecurityOperationsService(prisma, auditService));
    notificationWriter = new NotificationOutboxWriterAdapter(new NotificationOutboxService(prisma));
    const access = new EventAccessPolicyService(auditWriter);
    const workflow = new WorkflowCommandService(new PrismTransactionRunner(prisma));
    coordinators = new CoordinatorAssignmentCommandService(
      prisma,
      auditWriter,
      notificationWriter,
      workflow,
      access,
      new CoordinatorSuggestionsService(prisma),
      new CoordinatorReliabilityNoteWriterService(prisma),
    );
    liveOperations = new CoordinatorLiveOpsCommandService(prisma, coordinators);
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

  it('allows only one concurrent replacement to commit for the same outgoing assignment', async () => {
    const fixture = await createFixture(prisma, 1, 2);
    try {
      const outgoing = await prisma.opsCoordinatorAssignment.create({
        data: {
          id: `${fixture.eventIds[0]}_concurrent_outgoing`,
          eventId: fixture.eventIds[0],
          coordinatorId: fixture.coordinatorIds[0],
          coordinatorName: 'outgoing fixture coordinator',
          role: 'Floor Director',
          status: CoordinatorAssignmentStatus.Acknowledged,
          eventDate: new Date('2031-03-17T09:00:00.000Z'),
        },
      });
      const replacement = {
        replacementCoordinatorId: fixture.coordinatorIds[1],
        replacementRole: 'Floor Director',
        reason: 'Concurrent replacement test',
      } as const;

      const attempts = await Promise.allSettled([
        coordinators.replaceCoordinator(fixture.eventIds[0], outgoing.id, replacement, pmcmActor),
        coordinators.replaceCoordinator(fixture.eventIds[0], outgoing.id, replacement, pmcmActor),
      ]);

      expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
      const assignments = await prisma.opsCoordinatorAssignment.findMany({ where: { eventId: fixture.eventIds[0] } });
      expect(assignments).toHaveLength(2);
      expect(assignments.filter((item) => item.coordinatorId === fixture.coordinatorIds[1])).toHaveLength(1);
      expect(assignments.find((item) => item.id === outgoing.id)?.status).toBe(CoordinatorAssignmentStatus.Replaced);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });

  it('replays a replacement with one event-day log', async () => {
    const fixture = await createFixture(prisma, 1, 2);
    try {
      const outgoing = await prisma.opsCoordinatorAssignment.create({
        data: {
          id: `${fixture.eventIds[0]}_logged_outgoing`,
          eventId: fixture.eventIds[0],
          coordinatorId: fixture.coordinatorIds[0],
          coordinatorName: 'logged outgoing coordinator',
          role: 'Floor Director',
          status: CoordinatorAssignmentStatus.Acknowledged,
          eventDate: new Date('2031-03-17T09:00:00.000Z'),
        },
      });
      const input = {
        replacementCoordinatorId: fixture.coordinatorIds[1],
        replacementRole: 'Floor Director',
        reason: 'Replay-safe event-day logging',
      } as const;

      const first = await liveOperations.replaceCoordinatorAssignment(fixture.eventIds[0], outgoing.id, input, pmcmActor);
      const replay = await liveOperations.replaceCoordinatorAssignment(fixture.eventIds[0], outgoing.id, input, pmcmActor);
      const logs = await prisma.opsEventDayLog.findMany({
        where: { eventId: fixture.eventIds[0], actionType: 'coordinator_replaced', relatedId: outgoing.id },
      });

      expect(replay.replacementAssignment.id).toBe(first.replacementAssignment.id);
      expect(logs).toHaveLength(1);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });

  it('rolls back Operations assignment cancellation when the lifecycle transaction fails later', async () => {
    const fixture = await createFixture(prisma, 1, 1);
    const assignmentId = `${fixture.eventIds[0]}_rollback_assignment`;
    const eventDate = new Date('2031-03-17T09:00:00.000Z');
    try {
      await prisma.opsCoordinatorAssignment.create({
        data: {
          id: assignmentId,
          eventId: fixture.eventIds[0],
          coordinatorId: fixture.coordinatorIds[0],
          coordinatorName: 'rollback fixture coordinator',
          role: 'Floor Director',
          status: CoordinatorAssignmentStatus.Acknowledged,
          eventDate,
        },
      });

      await expect(prisma.$transaction(async (tx) => {
        await coordinators.applyEventDecisionAssignments(
          fixture.eventIds[0],
          { decision: 'cancelled', reason: 'Rollback test', supplierImpact: 'pending_review' },
          eventDate.toISOString(),
          eventDate.toISOString(),
          pmcmActor,
          { prisma: tx, actorId: pmcmActor.id, correlationId: `${fixture.eventIds[0]}_decision` },
        );
        throw new Error('simulate lifecycle decision failure');
      }, { isolationLevel: 'Serializable' })).rejects.toThrow('simulate lifecycle decision failure');

      const afterRollback = await prisma.opsCoordinatorAssignment.findUnique({ where: { id: assignmentId } });
      expect(afterRollback?.status).toBe(CoordinatorAssignmentStatus.Acknowledged);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });

  it('replays an idempotent event cancellation without releasing assignments twice', async () => {
    const fixture = await createFixture(prisma, 1, 1);
    try {
      await prisma.opsCoordinatorAssignment.create({
        data: {
          id: `${fixture.eventIds[0]}_replay_assignment`,
          eventId: fixture.eventIds[0],
          coordinatorId: fixture.coordinatorIds[0],
          coordinatorName: 'replay fixture coordinator',
          role: 'Floor Director',
          status: CoordinatorAssignmentStatus.Acknowledged,
          eventDate: new Date('2031-03-17T09:00:00.000Z'),
        },
      });
      const eventDecisions = new EventDecisionService(prisma, new EventAccessPolicyService(auditWriter), auditWriter, notificationWriter, coordinators);
      const input = {
        decision: 'cancelled',
        reason: 'Idempotent cancellation test',
        cancellationFeeAmount: 0,
        depositTreatment: 'pending_review',
        supplierImpact: 'pending_review',
        idempotencyKey: `${fixture.eventIds[0]}_cancel_once`,
      } as const;

      const first = await eventDecisions.decide(fixture.eventIds[0], input, pmcmActor);
      const replay = await eventDecisions.decide(fixture.eventIds[0], input, pmcmActor);

      expect(replay.id).toBe(first.id);
      expect(await prisma.opsEventDecision.count({ where: { eventId: fixture.eventIds[0] } })).toBe(1);
      const assignments = await prisma.opsCoordinatorAssignment.findMany({ where: { eventId: fixture.eventIds[0] } });
      expect(assignments).toHaveLength(1);
      expect(assignments[0].status).toBe(CoordinatorAssignmentStatus.Cancelled);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });

  it('replays one cancellation when same-key decision requests race', async () => {
    const fixture = await createFixture(prisma, 1, 1);
    try {
      const eventDecisions = new EventDecisionService(prisma, new EventAccessPolicyService(auditWriter), auditWriter, notificationWriter, coordinators);
      const input = {
        decision: 'cancelled',
        reason: 'Concurrent idempotent cancellation test',
        cancellationFeeAmount: 0,
        depositTreatment: 'pending_review',
        supplierImpact: 'pending_review',
        idempotencyKey: `${fixture.eventIds[0]}_cancel_race`,
      } as const;

      const results = await Promise.all([
        eventDecisions.decide(fixture.eventIds[0], input, pmcmActor),
        eventDecisions.decide(fixture.eventIds[0], input, pmcmActor),
      ]);

      expect(results[0].id).toBe(results[1].id);
      expect(await prisma.opsEventDecision.count({ where: { eventId: fixture.eventIds[0] } })).toBe(1);
      expect(await prisma.opsNotificationLog.count({ where: { eventId: fixture.eventIds[0] } })).toBe(1);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });
});
