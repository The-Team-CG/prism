import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { FloorPlanClientReviewService } from './floorplan-client-review.service';

function setup(email = 'client@example.test') {
  const snapshot = { id: 'plan-1', objects: [{ id: 'stage', x: 10 }] };
  const eventState = { clientPortalStatus: 'unlocked', archived: false, freezeStatus: 'open', floorPlanStatus: 'in_review', readiness: 'Floorplan awaiting review' };
  const draft: Record<string, unknown> = { id: 'draft-1', eventId: 'event-1', name: 'Main layout', status: 'in_review', revisionComment: '', reviewedAt: null, submittedSnapshot: snapshot, approvedSnapshot: null };
  const decisions: Array<Record<string, any>> = [];
  const prisma: any = {
    opsFloorPlanDraft: {
      findFirst: vi.fn(async () => draft),
      updateMany: vi.fn(async ({ where, data }: { where: { status: string }; data: Record<string, unknown> }) => {
        if (draft.status !== where.status) return { count: 0 };
        Object.assign(draft, data);
        return { count: 1 };
      }),
    },
    opsFloorPlanClientDecision: {
      findUnique: vi.fn(async ({ where }: { where: { idempotencyKey: string } }) => decisions.find((item) => item.idempotencyKey === where.idempotencyKey) ?? null),
      findFirst: vi.fn(async ({ where }: { where: { draftId: string; snapshotHash: string; actorId: string } }) => decisions.find((item) => item.draftId === where.draftId && item.snapshotHash === where.snapshotHash && item.actorId === where.actorId) ?? null),
      findMany: vi.fn(async () => decisions),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const created = { ...data, createdAt: new Date('2026-10-01T00:00:00.000Z') };
        decisions.push(created);
        return created;
      }),
    },
    opsFloorPlanClientAnnotation: { create: vi.fn(), findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
  };
  const access = {
    requireActorRole: vi.fn(async () => undefined),
    requireCanReadEvent: vi.fn(async () => undefined),
  };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const notifications = { write: vi.fn(async () => undefined) };
  const lifecycleEventReferences = { findFloorplanEvent: vi.fn(async () => ({
    eventId: 'event-1', eventName: 'Event', clientName: 'Client', ...eventState,
    primaryClientEmail: 'client@example.test', conformeSigned: true, ocularVisitStatus: 'complete',
  })) };
  const workflow = { projectLifecycleState: vi.fn(async (_tx: unknown, _eventId: string, projection: { floorPlanStatus: string; readiness: string }) => { Object.assign(eventState, projection); }) };
  const service = new FloorPlanClientReviewService(prisma as never, access as never, auditWriter as never, notifications as never, lifecycleEventReferences as never, workflow as never);
  const actor = { id: 'client-1', role: OpsUserRole.Client, email, name: 'Client' } as never;
  const currentHash = async () => (await service.getReview('event-1', 'draft-1', actor)).snapshotHash;
  return { service, prisma, actor, draft, eventState, decisions, workflow, auditWriter, notifications, currentHash };
}

describe('FloorPlanClientReviewService', () => {
  it('rejects a decision against an older snapshot before recording or notifying', async () => {
    const { service, prisma, actor } = setup();
    await expect(service.decide('event-1', 'draft-1', {
      snapshotHash: 'a'.repeat(64), action: 'approve', comment: '', idempotencyKey: 'decision-old-snapshot',
    }, actor)).rejects.toThrow('The floorplan changed after this review was opened; reload the latest snapshot');
    expect(prisma.opsFloorPlanClientDecision.create).not.toHaveBeenCalled();
  });

  it('refuses floorplan decisions from a non-primary client contact', async () => {
    const { service, prisma, actor } = setup('other@example.test');
    await expect(service.decide('event-1', 'draft-1', {
      snapshotHash: 'a'.repeat(64), action: 'approve', comment: '', idempotencyKey: 'wrong-client',
    }, actor)).rejects.toThrow('Only the primary client contact can review the official floorplan');
    expect(prisma.opsFloorPlanClientDecision.create).not.toHaveBeenCalled();
  });

  it('records a revision request and returns the layout to PMCM in one transaction', async () => {
    const { service, prisma, actor, draft, eventState, decisions, workflow, auditWriter, notifications, currentHash } = setup();
    const snapshotHash = await currentHash();

    const result = await service.decide('event-1', 'draft-1', { snapshotHash, action: 'request_revision', comment: 'Add a registration desk', idempotencyKey: 'revise-1' }, actor);

    expect(result).toMatchObject({ draftId: 'draft-1', action: 'request_revision', comment: 'Add a registration desk' });
    expect(decisions).toHaveLength(1);
    expect(draft).toMatchObject({ status: 'revision_requested', revisionComment: 'Add a registration desk' });
    expect(eventState).toMatchObject({ floorPlanStatus: 'revision_requested', readiness: 'Floorplan revision requested by client' });
    expect(workflow.projectLifecycleState).toHaveBeenCalledWith(prisma, 'event-1', expect.objectContaining({ floorPlanStatus: 'revision_requested' }));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(auditWriter.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'Client requested floorplan revision', affectedType: 'floorplan_client_decision' }), expect.anything());
    expect(notifications.write).toHaveBeenCalledTimes(1);
  });

  it('records an approval against the snapshot without moving the draft out of review', async () => {
    const { service, actor, draft, decisions, workflow, currentHash } = setup();
    const snapshotHash = await currentHash();

    await service.decide('event-1', 'draft-1', { snapshotHash, action: 'approve', comment: '', idempotencyKey: 'approve-1' }, actor);

    expect(decisions).toHaveLength(1);
    expect(draft.status).toBe('in_review');
    expect(workflow.projectLifecycleState).not.toHaveBeenCalled();
  });

  it('answers a retried revision request with the recorded decision after the draft left review', async () => {
    const { service, actor, decisions, notifications, currentHash } = setup();
    const snapshotHash = await currentHash();
    const input = { snapshotHash, action: 'request_revision' as const, comment: 'Add a registration desk', idempotencyKey: 'revise-retry' };

    const first = await service.decide('event-1', 'draft-1', input, actor);
    const retry = await service.decide('event-1', 'draft-1', { ...input }, actor);

    expect(retry.id).toBe(first.id);
    expect(decisions).toHaveLength(1);
    expect(notifications.write).toHaveBeenCalledTimes(1);
    await expect(service.decide('event-1', 'draft-1', { ...input, action: 'approve', comment: '' }, actor)).rejects.toThrow('Idempotency key was reused');
  });

  it.each([
    ['the event is frozen', (ctx: ReturnType<typeof setup>) => { ctx.eventState.freezeStatus = 'frozen'; }],
    ['the client portal is locked', (ctx: ReturnType<typeof setup>) => { ctx.eventState.clientPortalStatus = 'locked'; }],
    ['the event is archived', (ctx: ReturnType<typeof setup>) => { ctx.eventState.archived = true; }],
    ['the draft is already approved', (ctx: ReturnType<typeof setup>) => { ctx.draft.status = 'approved'; ctx.draft.approvedSnapshot = ctx.draft.submittedSnapshot; }],
  ])('refuses a revision request and changes nothing when %s', async (_label, block) => {
    const ctx = setup();
    const snapshotHash = await ctx.currentHash();
    block(ctx);
    const statusBefore = ctx.draft.status;

    await expect(ctx.service.decide('event-1', 'draft-1', { snapshotHash, action: 'request_revision', comment: 'Move the stage', idempotencyKey: 'revise-blocked' }, ctx.actor)).rejects.toThrow(BadRequestException);

    expect(ctx.decisions).toHaveLength(0);
    expect(ctx.draft.status).toBe(statusBefore);
    expect(ctx.workflow.projectLifecycleState).not.toHaveBeenCalled();
    expect(ctx.notifications.write).not.toHaveBeenCalled();
  });
});
