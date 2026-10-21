import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { FloorplanEventReference, FloorplanEventReferenceReader } from '@prism/contexts/event-lifecycle/floorplan-reference';
import type { FloorplanProjectionInput, FloorplanProjectionWriter } from '@prism/contexts/event-lifecycle';
import { createFloorPlanPreferenceSchema } from '@prism/types';
import { FloorPlanWorkflowService } from './floor-plan-workflow.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const databaseSuite = describe.skipIf(!databaseUrl);

if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '55437' || parsed.pathname !== '/prism_p0') {
    throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
  }
}

const client = {
  actorId: 'p0_floorplan_preference_client',
  name: 'P0 Floorplan Preference Client',
  role: 'client',
} as const;
const pmcm = {
  actorId: 'p0_floorplan_preference_pmcm',
  name: 'P0 Floorplan Preference PMCM',
  role: 'pmcm-admin',
} as const;

async function createFixture(prisma: PrismaService) {
  const prefix = `p0_floorplan_preference_${randomUUID().replaceAll('-', '')}`;
  const inquiryId = `${prefix}_inquiry`;
  const eventId = `${prefix}_event`;
  const email = `${prefix}@example.test`;
  await prisma.opsInquiry.create({
    data: {
      id: inquiryId,
      clientName: 'P0 Floorplan Preference Client',
      email,
      eventName: `${prefix} Inquiry`,
      eventDate: new Date('2031-05-21T09:00:00.000Z'),
      clientType: 'corporate',
      normalizedEmail: email,
      conformeSignedAt: new Date(),
    },
  });
  await prisma.opsEvent.create({
    data: {
      id: eventId,
      inquiryId,
      clientName: 'P0 Floorplan Preference Client',
      eventName: `${prefix} Event`,
      eventDate: new Date('2031-05-21T09:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
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

function createWorkflow(prisma: PrismaService) {
  const eventReferences: FloorplanEventReferenceReader = {
    async findFloorplanEvent(eventId: string, transaction?: PrismTransactionContext): Promise<FloorplanEventReference | null> {
      const database = transaction?.prisma ?? prisma;
      if (transaction) {
        // QUERY_AUDIT_RAW_SQL: reproduce the Lifecycle event lock used by its public reader.
        const lockedEvents = await transaction.prisma.$queryRawUnsafe<Array<{ id: string }>>(
          'SELECT "id" FROM "event_lifecycle"."events" WHERE "id" = $1 FOR UPDATE',
          eventId,
        );
        if (lockedEvents.length === 0) return null;
        // QUERY_AUDIT_RAW_SQL: keep the production lock order event first, then ocular request.
        await transaction.prisma.$queryRawUnsafe(
          'SELECT "id" FROM "event_lifecycle"."ocular_visit_requests" WHERE "event_id" = $1 FOR UPDATE',
          eventId,
        );
      }
      const event = await database.opsEvent.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          eventName: true,
          clientName: true,
          clientPortalStatus: true,
          archived: true,
          freezeStatus: true,
          floorPlanStatus: true,
          readiness: true,
          inquiry: { select: { email: true, conformeSignedAt: true } },
          ocularVisitRequest: { select: { status: true } },
        },
      });
      if (!event) return null;
      return {
        eventId: event.id,
        eventName: event.eventName,
        clientName: event.clientName,
        clientPortalStatus: event.clientPortalStatus,
        archived: event.archived,
        freezeStatus: event.freezeStatus,
        floorPlanStatus: event.floorPlanStatus,
        readiness: event.readiness,
        primaryClientEmail: event.inquiry?.email ?? null,
        conformeSigned: Boolean(event.inquiry?.conformeSignedAt),
        ocularVisitStatus: event.ocularVisitRequest?.status ?? null,
      };
    },
  };
  const projectionWriter: FloorplanProjectionWriter = {
    async project(input: FloorplanProjectionInput, transaction: PrismTransactionContext) {
      const updated = await transaction.prisma.opsEvent.updateMany({
        where: { id: input.eventId, floorPlanProjectionVersion: { lt: input.version } },
        data: { ...input.state, floorPlanProjectionVersion: input.version },
      });
      return { applied: updated.count === 1, version: input.version };
    },
  };
  const workflow = new FloorPlanWorkflowService(
    prisma,
    { write: async () => undefined },
    { write: async () => undefined },
    new WorkflowCommandService(),
    projectionWriter,
    eventReferences,
  );
  return workflow;
}

databaseSuite('Floorplan client preference PostgreSQL invariants', () => {
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

  it('serializes concurrent first submissions, then reopens and resubmits the same preference', async () => {
    const fixture = await createFixture(prisma);
    const workflow = createWorkflow(prisma);
    const input = createFloorPlanPreferenceSchema.parse({
      name: 'Client seating preference',
      seatingStyle: 'Banquet',
      stagePreference: 'North wall',
      flowNotes: 'Keep registration clear of the entrance.',
      guestCount: 180,
      constraints: ['Keep emergency exits visible'],
    });

    try {
      const attempts = await Promise.allSettled([
        workflow.createFloorPlanPreference(fixture.eventId, input, client),
        workflow.createFloorPlanPreference(fixture.eventId, input, client),
      ]);
      const accepted = attempts.filter((attempt) => attempt.status === 'fulfilled');
      expect(accepted).toHaveLength(1);
      expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);

      const [savedPreference] = await prisma.opsFloorPlanDraft.findMany({
        where: { eventId: fixture.eventId, sourceType: 'client_preference' },
      });
      expect(savedPreference).toMatchObject({ status: 'client_submitted', sourceType: 'client_preference' });
      const planCountBeforeRevision = await prisma.floorPlan.count({ where: { eventId: fixture.eventId } });
      expect(planCountBeforeRevision).toBe(1);

      const reopened = await workflow.reopenClientPreference(fixture.eventId, savedPreference!.id, pmcm);
      expect(reopened).toMatchObject({ id: savedPreference!.id, status: 'revision_requested' });
      const resubmitted = await workflow.createFloorPlanPreference(fixture.eventId, input, client);
      expect(resubmitted).toMatchObject({ id: savedPreference!.id, status: 'client_submitted' });
      expect(await prisma.opsFloorPlanDraft.count({ where: { eventId: fixture.eventId, sourceType: 'client_preference' } })).toBe(1);
      expect(await prisma.floorPlan.count({ where: { eventId: fixture.eventId } })).toBe(planCountBeforeRevision);
    } finally {
      await cleanupFixture(prisma, fixture);
    }
  });
});
