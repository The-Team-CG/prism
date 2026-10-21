import { randomUUID, createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { WorkflowCommandService, OpsUserRole } from '@prism/kernel/event-core';
import { FloorPlanWorkflowService } from '../../src/modules/floorplan/application/live/floor-plan-workflow.service';
import { FloorPlanClientReviewService } from '../../src/modules/floorplan/application/live/floorplan-client-review.service';
import { FloorplanProjectionService } from '../../src/modules/event-lifecycle/application/floorplan-projection.service';
import { FloorplanEventReferenceService } from '../../src/modules/event-lifecycle/application/onboarding/floorplan-event-reference.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));
if (databaseUrl && !live) throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');

function stableHash(value: unknown): string {
  const canonical = (item: unknown): string => {
    if (item === null || typeof item !== 'object') return JSON.stringify(item) ?? 'null';
    if (Array.isArray(item)) return `[${item.map(canonical).join(',')}]`;
    return `{${Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  };
  return createHash('sha256').update(canonical(value)).digest('hex');
}

describe.skipIf(!live)('official floorplan and client review serialization against PostgreSQL', () => {
  it('publishes the current canvas on submit and approve so an older snapshot hash cannot authorize a client decision', async () => {
    const url = databaseUrl!;
    process.env.P0_TEST_DATABASE_URL = url;
    process.env.DATABASE_URL = url;
    process.env.PRISMA_DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    process.env.DB_SSL = 'false';
    const prisma = new PrismaService();
    const suffix = randomUUID().replaceAll('-', '');
    const inquiryId = `floorplan_review_inquiry_${suffix}`;
    const eventId = `floorplan_review_event_${suffix}`;
    const planId = `floorplan_review_plan_${suffix}`;
    const draftId = `floorplan_review_draft_${suffix}`;
    const audit = { write: async () => undefined };
    const notifications = { write: async () => undefined };
    const access = { requireActorRole: async () => undefined, requireCanReadEvent: async () => undefined };
    const workflow = new FloorPlanWorkflowService(
      prisma, audit, notifications, new WorkflowCommandService(),
      new FloorplanProjectionService(), new FloorplanEventReferenceService(prisma),
    );
    const review = new FloorPlanClientReviewService(prisma, access as never, audit, notifications, new FloorplanEventReferenceService(prisma));
    const client = { id: `client_${suffix}`, role: OpsUserRole.Client, email: `${suffix}@example.test`, name: 'Portal Test Client' } as never;

    try {
      const email = `${suffix}@example.test`;
      await prisma.opsInquiry.create({ data: {
        id: inquiryId, clientName: 'Floorplan Review Client', email, normalizedEmail: email,
        eventName: 'Floorplan Review Test', eventDate: new Date('2031-04-18T09:00:00.000Z'),
        clientType: 'corporate', status: 'accepted', conformeSignedAt: new Date(),
      } });
      await prisma.opsEvent.create({ data: {
        id: eventId, inquiryId, clientName: 'Floorplan Review Client', eventName: 'Floorplan Review Test',
        eventDate: new Date('2031-04-18T09:00:00.000Z'), clientPortalStatus: 'unlocked',
      } });
      await prisma.floorPlan.create({ data: {
        id: planId, name: 'Official layout', ownerId: 'pmcm-test', eventId,
        objects: [{ id: 'stage', kind: 'stage', x: 10, y: 10 }],
      } });
      await prisma.opsFloorPlanDraft.create({ data: {
        id: draftId, eventId, floorPlanId: planId, name: 'Official layout', status: 'pmcm_draft',
        createdByRole: OpsUserRole.PmcmAdmin,
      } });

      await workflow.submitFloorPlanDraft(eventId, draftId, { name: 'Portal Test PMCM', role: OpsUserRole.PmcmAdmin });
      const oldReview = await review.getReview(eventId, draftId, client);
      const oldHash = oldReview.snapshotHash;
      expect(stableHash(oldReview.snapshot)).toBe(oldHash);

      await prisma.floorPlan.update({ where: { id: planId }, data: { objects: [{ id: 'stage', kind: 'stage', x: 42, y: 10 }] } });
      await workflow.approveFloorPlanDraft(eventId, draftId, { name: 'Portal Test PMCM', role: OpsUserRole.PmcmAdmin });
      const current = await prisma.opsFloorPlanDraft.findUniqueOrThrow({ where: { id: draftId } });
      expect((current.approvedSnapshot as { objects: Array<{ x: number }> }).objects[0]?.x).toBe(42);
      await expect(review.decide(eventId, draftId, {
        snapshotHash: oldHash, action: 'approve', comment: '', idempotencyKey: `old-snapshot-${suffix}`,
      }, client)).rejects.toThrow('The floorplan changed after this review was opened; reload the latest snapshot');
      expect(await prisma.opsFloorPlanClientDecision.count({ where: { eventId, draftId } })).toBe(0);
    } finally {
      await prisma.opsEvent.deleteMany({ where: { id: eventId } });
      await prisma.opsInquiry.deleteMany({ where: { id: inquiryId } });
      await prisma.floorPlan.deleteMany({ where: { id: planId } });
      await prisma.$disconnect();
    }
  });
});
