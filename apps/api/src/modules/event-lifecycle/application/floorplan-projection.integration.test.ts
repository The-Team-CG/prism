import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type AuditWriter } from '@prism/kernel/access-control';
import { WorkflowCommandService, OpsUserRole } from '@prism/kernel/event-core';
import { FloorplanProjectionService } from './floorplan-projection.service';
import { FloorplanEventReferenceService } from './onboarding/floorplan-event-reference.service';
import { FloorPlanWorkflowService, FloorPlanReviewService } from '@prism/contexts/floorplan';
import type { FloorplanProjectionWriter } from '../contracts/floorplan-projection.port';
import type { NotificationOutboxWriter } from '@prism/contexts/platform-ops';
import { createFloorPlanRevisionCommentSchema } from '@prism/types';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();

function validateDatabaseUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '55437' || parsed.pathname !== '/prism_p0') {
    throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
  }
}

if (databaseUrl) validateDatabaseUrl(databaseUrl);

const databaseSuite = describe.skipIf(!databaseUrl);
const actor = { actorId: 'p0_floorplan_pmcm', name: 'P0 Floorplan PMCM', role: 'pmcm-admin' } as const;
const clientActor = {
  id: 'p0_floorplan_client',
  role: OpsUserRole.Client,
  name: 'P0 Floorplan Client',
  email: 'p0-floorplan-client@example.test',
  explicit: true,
  verified: true,
};

async function createFixture(prisma: PrismaService) {
  const prefix = `p0_floorplan_${randomUUID().replaceAll('-', '')}`;
  const inquiryId = `${prefix}_inquiry`;
  const eventId = `${prefix}_event`;
  const eventDate = new Date('2031-05-21T09:00:00.000Z');
  await prisma.opsInquiry.create({
    data: {
      id: inquiryId,
      clientName: 'P0 Floorplan Client',
      email: clientActor.email,
      eventName: `${prefix} Inquiry`,
      eventDate,
      clientType: 'corporate',
      normalizedEmail: clientActor.email,
      conformeSignedAt: new Date(),
    },
  });
  await prisma.opsEvent.create({
    data: {
      id: eventId,
      inquiryId,
      clientName: 'P0 Floorplan Client',
      eventName: `${prefix} Event`,
      eventDate,
      status: 'planning',
    },
  });
  await prisma.opsOcularVisitRequest.create({
    data: { id: `${prefix}_ocular`, eventId, status: 'completed' },
  });
  return { inquiryId, eventId };
}

async function cleanupFixture(prisma: PrismaService, fixture: { inquiryId: string; eventId: string }) {
  await prisma.opsFloorPlanDraft.deleteMany({ where: { eventId: fixture.eventId } });
  await prisma.opsFloorPlanProjectionClock.deleteMany({ where: { eventId: fixture.eventId } });
  await prisma.floorPlan.deleteMany({ where: { eventId: fixture.eventId } });
  await prisma.opsOcularVisitRequest.deleteMany({ where: { eventId: fixture.eventId } });
  await prisma.opsEvent.deleteMany({ where: { id: fixture.eventId } });
  await prisma.opsInquiry.deleteMany({ where: { id: fixture.inquiryId } });
}

function createWorkflow(prisma: PrismaService, projectionWriter = new FloorplanProjectionService()) {
  const auditWriter: AuditWriter = { write: async () => undefined };
  const notificationWriter: NotificationOutboxWriter = { write: async () => undefined };
  const workflow = new FloorPlanWorkflowService(
    prisma,
    auditWriter,
    notificationWriter,
    new WorkflowCommandService(),
    projectionWriter,
    new FloorplanEventReferenceService(prisma),
  );
  return { workflow, auditWriter, notificationWriter };
}

databaseSuite('Floorplan lifecycle projection PostgreSQL invariants', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    if (!databaseUrl) return;
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) {
      process.env[variable] = databaseUrl;
    }
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('rolls back plan, draft, and projection clock when Lifecycle rejects the projection', async () => {
    const fixture = await createFixture(prisma);
    const failingWriter: FloorplanProjectionWriter = { project: async () => { throw new ConflictException('injected stale projection'); } };
    const { workflow } = createWorkflow(prisma, failingWriter);

    try {
      await expect(workflow.createFloorPlanDraft(
        fixture.eventId,
        { name: 'Rollback verification', sourceType: 'blank' },
        actor,
      )).rejects.toThrow('injected stale projection');

      expect(await prisma.floorPlan.count({ where: { eventId: fixture.eventId } })).toBe(0);
      expect(await prisma.opsFloorPlanDraft.count({ where: { eventId: fixture.eventId } })).toBe(0);
      expect(await prisma.opsFloorPlanProjectionClock.findUnique({ where: { eventId: fixture.eventId } })).toBeNull();
      expect((await prisma.opsEvent.findUnique({ where: { id: fixture.eventId } }))?.floorPlanProjectionVersion).toBe(0);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });

  it('serializes concurrent approval and client revision so only one review transition commits', async () => {
    const fixture = await createFixture(prisma);
    const { workflow, auditWriter, notificationWriter } = createWorkflow(prisma);
    const review = new FloorPlanReviewService(
      prisma,
      { requireActorRole: async () => undefined } as unknown as EventAccessPolicyService,
      workflow,
      auditWriter,
      notificationWriter,
      new FloorplanEventReferenceService(prisma),
    );

    try {
      const draft = await workflow.createFloorPlanDraft(
        fixture.eventId,
        { name: 'Concurrent review', sourceType: 'blank' },
        actor,
      );
      await workflow.submitFloorPlanDraft(fixture.eventId, draft.id, actor);
      const comment = createFloorPlanRevisionCommentSchema.parse({ revisionNote: 'Please adjust the aisle.' });
      const results = await Promise.allSettled([
        workflow.approveFloorPlanDraft(fixture.eventId, draft.id, actor),
        review.submitRevisionComment(fixture.eventId, draft.id, comment, clientActor),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const [savedDraft, savedEvent] = await Promise.all([
        prisma.opsFloorPlanDraft.findUnique({ where: { id: draft.id } }),
        prisma.opsEvent.findUnique({ where: { id: fixture.eventId } }),
      ]);
      expect(savedEvent?.floorPlanProjectionVersion).toBe(3);
      expect(savedEvent?.floorPlanStatus).toBe(savedDraft?.status);
      expect(['approved', 'revision_requested']).toContain(savedDraft?.status);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });

  it('allows at most one active draft per event while keeping inactive history', async () => {
    const fixture = await createFixture(prisma);
    const createDraft = async (suffix: string, isActive: boolean) => {
      const floorPlanId = `${fixture.eventId}_plan_${suffix}`;
      await prisma.floorPlan.create({ data: { id: floorPlanId, name: suffix, ownerId: actor.actorId, eventId: fixture.eventId } });
      return prisma.opsFloorPlanDraft.create({ data: {
        id: `${fixture.eventId}_draft_${suffix}`,
        eventId: fixture.eventId,
        floorPlanId,
        name: suffix,
        status: 'approved',
        isActive,
        createdByRole: 'pmcm-admin',
      } });
    };

    try {
      await createDraft('first', true);
      await createDraft('history', false);
      await expect(createDraft('second', true)).rejects.toThrow(/floor_plan_drafts_one_active_per_event_key|unique/i);
      expect(await prisma.opsFloorPlanDraft.count({ where: { eventId: fixture.eventId, isActive: true } })).toBe(1);
      expect(await prisma.opsFloorPlanDraft.count({ where: { eventId: fixture.eventId } })).toBe(2);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });
});
