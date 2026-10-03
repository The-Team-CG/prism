import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { createFloorPlanRevisionCommentSchema } from '@prism/types';
import { FloorPlanReviewService } from './floor-plan-review.service';

function createService() {
  const state = {
    events: [
      {
        id: 'evt_sample',
        inquiry: { email: 'ana@example.test' },
        clientPortalStatus: 'unlocked',
        archived: false,
        floorPlanStatus: 'in_review',
        readiness: 'Floorplan awaiting review',
        floorPlanProjectionVersion: 0,
      },
    ] as any[],
    drafts: [
      {
        id: 'fpd_review',
        eventId: 'evt_sample',
        floorPlanId: 'plan_sample',
        name: 'Official Layout',
        status: 'in_review',
        isActive: false,
        sourceType: 'blank',
        createdByRole: 'pmcm-admin',
        revisionComment: '',
        reviewedAt: null,
        submittedSnapshotAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any[],
    auditLogs: [] as any[],
    projectionClock: null as null | { eventId: string; version: number },
  };
  const prisma = {
    opsEvent: {
      findUnique: vi.fn(async ({ where }) =>
        state.events.find((event) => event.id === where.id) ?? null,
      ),
      updateMany: vi.fn(async ({ where, data }) => {
        const event = state.events.find((item) => item.id === where.id);
        if (!event || event.floorPlanProjectionVersion >= where.floorPlanProjectionVersion.lt) return { count: 0 };
        Object.assign(event, data);
        return { count: 1 };
      }),
    },
    opsFloorPlanDraft: {
      findFirst: vi.fn(async ({ where }) =>
        state.drafts.find((draft) => draft.id === where.id && draft.eventId === where.eventId) ?? null,
      ),
      findUnique: vi.fn(async ({ where }) => state.drafts.find((draft) => draft.id === where.id) ?? null),
      updateMany: vi.fn(async ({ where, data }) => {
        const targets = state.drafts.filter((draft) =>
          draft.id === where.id && draft.eventId === where.eventId && (!where.status || draft.status === where.status),
        );
        for (const draft of targets) Object.assign(draft, data);
        return { count: targets.length };
      }),
    },
    opsAuditLog: {
      findFirst: vi.fn(async ({ where }) =>
        state.auditLogs.find((audit) => audit.eventId === where.eventId && audit.affectedId === where.affectedId) ?? null,
      ),
    },
    opsFloorPlanProjectionClock: {
      upsert: vi.fn(async ({ where, create, update }) => {
        const current = state.projectionClock;
        if (current && current.eventId === where.eventId) {
          current.version += update.version.increment;
          return current;
        }
        const created = { ...create };
        state.projectionClock = created;
        return created;
      }),
    },
    $transaction: vi.fn(async (callback) => callback(prisma)),
  };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const notificationOutboxWriter = { write: vi.fn(async () => undefined) };
  const eventAccessPolicyService = {
    requireActorRole: vi.fn(async () => undefined),
    resolveActor: vi.fn(),
    canReadEvent: vi.fn(),
    recordForbiddenAccess: vi.fn(async () => undefined),
    requireCanReadEvent: vi.fn(async () => undefined),
  };
  const floorPlanWorkflowService = {
    mapFloorPlanDraft: vi.fn((draft) => ({ id: draft.id, status: draft.status, revisionComment: draft.revisionComment })),
    projectLifecycleState: vi.fn(async (tx, eventId, stateProjection) => {
      const clock = await tx.opsFloorPlanProjectionClock.upsert({
        where: { eventId },
        create: { eventId, version: 1 },
        update: { version: { increment: 1 } },
      });
      const updated = await tx.opsEvent.updateMany({
        where: { id: eventId, floorPlanProjectionVersion: { lt: clock.version } },
        data: { ...stateProjection, floorPlanProjectionVersion: clock.version },
      });
      if (updated.count !== 1) throw new Error('Stale floorplan projection version');
    }),
  };
  const service = new FloorPlanReviewService(
    prisma as any,
    eventAccessPolicyService as any,
    floorPlanWorkflowService as any,
    auditWriter as any,
    notificationOutboxWriter as any,
  );
  return { service, state, auditWriter, notificationOutboxWriter, eventAccessPolicyService, floorPlanWorkflowService };
}

const clientActor = {
  id: 'client_ana',
  role: OpsUserRole.Client,
  email: 'ana@example.test',
  name: 'Ana Reyes',
  explicit: true,
  verified: true,
};

const input = createFloorPlanRevisionCommentSchema.parse({
  revisionNote: 'Please move the mingle space next to the bar.',
});

describe('FloorPlanReviewService', () => {
  it('records a client revision comment on an in-review floorplan draft', async () => {
    const { service, state, auditWriter, notificationOutboxWriter, eventAccessPolicyService, floorPlanWorkflowService } = createService();

    const result = await service.submitRevisionComment('evt_sample', 'fpd_review', input, clientActor);

    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledWith(clientActor, [OpsUserRole.Client], 'floorplan revision comment', 'evt_sample');
    expect(state.drafts[0]).toMatchObject({
      status: 'revision_requested',
      revisionComment: 'Please move the mingle space next to the bar.',
    });
    expect(state.events[0]).toMatchObject({ floorPlanStatus: 'revision_requested', readiness: 'Floorplan revision requested by client' });
    expect(result).toMatchObject({ id: 'fpd_review', status: 'revision_requested', revisionComment: expect.any(String) });
    expect(auditWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_sample',
        actor: 'Ana Reyes',
        action: 'Requested floorplan revision: Official Layout',
        affectedType: 'floorplan_client_review',
        affectedId: 'floorplan-review:evt_sample:fpd_review:first',
        metadata: expect.objectContaining({ draftId: 'fpd_review', revisionNote: input.revisionNote }),
      }),
      expect.objectContaining({ correlationId: 'floorplan-review:evt_sample:fpd_review:first' }),
    );
    expect(notificationOutboxWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_sample',
        recipient: 'PMCM Admin',
        message: 'Client requested a floorplan revision: Official Layout',
        correlationId: 'floorplan-review:evt_sample:fpd_review:first',
        idempotencyKey: 'floorplan-review:evt_sample:fpd_review:first',
      }),
      expect.objectContaining({
        prisma: expect.anything(),
        correlationId: 'floorplan-review:evt_sample:fpd_review:first',
        actorId: clientActor.id,
      }),
    );
    expect(state.events[0]).toMatchObject({ floorPlanProjectionVersion: 1 });
    expect(floorPlanWorkflowService.projectLifecycleState).toHaveBeenCalledWith(
      expect.anything(),
      'evt_sample',
      { floorPlanStatus: 'revision_requested', readiness: 'Floorplan revision requested by client' },
    );
  });

  it('allows only one concurrent review decision to leave the in-review state', async () => {
    const { service, state, notificationOutboxWriter } = createService();

    const results = await Promise.allSettled([
      service.submitRevisionComment('evt_sample', 'fpd_review', input, clientActor),
      service.submitRevisionComment('evt_sample', 'fpd_review', input, clientActor),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(state.drafts[0].status).toBe('revision_requested');
    expect(state.events[0]).toMatchObject({ floorPlanStatus: 'revision_requested', floorPlanProjectionVersion: 1 });
    expect(notificationOutboxWriter.write).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-primary client contact', async () => {
    const { service } = createService();

    await expect(
      service.submitRevisionComment('evt_sample', 'fpd_review', input, {
        ...clientActor,
        email: 'other@example.test',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(service).toBeDefined();
  });

  it('rejects revision comments while the client portal is locked', async () => {
    const { service, state } = createService();
    state.events[0].clientPortalStatus = 'locked';

    await expect(service.submitRevisionComment('evt_sample', 'fpd_review', input, clientActor)).rejects.toThrow(BadRequestException);
  });

  it('rejects revision comments on archived events', async () => {
    const { service, state } = createService();
    state.events[0].archived = true;

    await expect(service.submitRevisionComment('evt_sample', 'fpd_review', input, clientActor)).rejects.toThrow(BadRequestException);
  });

  it('rejects revision comments when the draft is not in review', async () => {
    const { service, state } = createService();
    state.drafts[0].status = 'approved';

    await expect(service.submitRevisionComment('evt_sample', 'fpd_review', input, clientActor)).rejects.toThrow(BadRequestException);
  });

  it('replays a prior revision comment idempotently for the same key and payload', async () => {
    const { service, state, notificationOutboxWriter } = createService();
    state.drafts[0].status = 'revision_requested';
    state.drafts[0].revisionComment = input.revisionNote;
    state.auditLogs.push({
      id: 'audit_prior',
      eventId: 'evt_sample',
      affectedType: 'floorplan_client_review',
      affectedId: 'floorplan-review:evt_sample:fpd_review:first',
      metadata: {
        action: 'request_revision',
        draftId: 'fpd_review',
        revisionNote: input.revisionNote,
        actorEmail: 'ana@example.test',
        actorId: 'client_ana',
      },
    });

    const result = await service.submitRevisionComment('evt_sample', 'fpd_review', input, clientActor);

    expect(result).toMatchObject({ id: 'fpd_review', status: 'revision_requested' });
    expect(notificationOutboxWriter.write).not.toHaveBeenCalled();
  });

  it('rejects idempotency key reuse for a different payload', async () => {
    const { service, state } = createService();
    state.auditLogs.push({
      id: 'audit_prior',
      eventId: 'evt_sample',
      affectedType: 'floorplan_client_review',
      affectedId: 'floorplan-review:evt_sample:fpd_review:first',
      metadata: {
        action: 'request_revision',
        draftId: 'fpd_review',
        revisionNote: 'A different comment',
        actorEmail: 'ana@example.test',
        actorId: 'client_ana',
      },
    });

    await expect(service.submitRevisionComment('evt_sample', 'fpd_review', input, clientActor)).rejects.toThrow(BadRequestException);
  });
});
