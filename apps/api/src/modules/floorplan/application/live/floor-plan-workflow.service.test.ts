import { describe, expect, it, vi } from 'vitest';
import { FloorPlanWorkflowService } from './floor-plan-workflow.service';
import { WorkflowCommandService } from '@prism/kernel/event-core';

function createService() {
  const state = {
    events: [
      {
        id: 'evt_sample',
        inquiryId: 'inq_sample',
        // Bare new Date() on purpose: the conforme gate checks null vs non-null, so the value is
        // inert, and a dated literal here would be a future check:test-clocks liability.
        inquiry: { conformeSignedAt: new Date() },
        clientName: 'Ana Reyes',
        eventName: 'Ayala Summit',
        floorPlanStatus: 'not_started',
        readiness: 'Planning',
      },
    ] as any[],
    floorPlans: [] as any[],
    floorPlanObjects: [] as any[],
    floorPlanDrafts: [] as any[],
  };
  const prisma = {
    opsEvent: {
      findUnique: vi.fn(async ({ where }) => state.events.find((event) => event.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }) => {
        const event = state.events.find((item) => item.id === where.id);
        if (!event) throw new Error('event not found');
        Object.assign(event, data);
        return event;
      }),
    },
    floorPlan: {
      create: vi.fn(async ({ data }) => {
        const row = { ...data, updatedAt: data.updatedAt ?? new Date() };
        state.floorPlans.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }) => state.floorPlans.find((plan) => plan.id === where.id) ?? null),
    },
    floorPlanObject: {
      createMany: vi.fn(async ({ data }) => {
        state.floorPlanObjects.push(...data);
        return { count: data.length };
      }),
    },
    opsFloorPlanDraft: {
      create: vi.fn(async ({ data }) => {
        const row = { ...data, createdAt: data.createdAt ?? new Date(), updatedAt: data.updatedAt ?? new Date() };
        state.floorPlanDrafts.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where }) =>
        state.floorPlanDrafts.find((draft) => draft.id === where.id && draft.eventId === where.eventId) ?? null,
      ),
      update: vi.fn(async ({ where, data }) => {
        const draft = state.floorPlanDrafts.find((item) => item.id === where.id);
        if (!draft) throw new Error('draft not found');
        Object.assign(draft, data, { updatedAt: data.updatedAt ?? new Date() });
        return draft;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        let count = 0;
        for (const draft of state.floorPlanDrafts) {
          if (where?.eventId && draft.eventId !== where.eventId) continue;
          if (typeof where?.isActive === 'boolean' && draft.isActive !== where.isActive) continue;
          Object.assign(draft, data);
          count += 1;
        }
        return { count };
      }),
    },
    $transaction: vi.fn(async (callback) => callback(prisma)),
  };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const notificationOutboxWriter = { write: vi.fn(async () => undefined) };
  const service = new FloorPlanWorkflowService(
    prisma as any,
    auditWriter as any,
    notificationOutboxWriter as any,
    new WorkflowCommandService(),
  );
  return { service, state, prisma, auditWriter, notificationOutboxWriter };
}

describe('FloorPlanWorkflowService', () => {
  it('creates PMCM official floorplan drafts with canvas object rows intact', async () => {
    const { service, state, auditWriter } = createService();

    const draft = await service.createFloorPlanDraft(
      'evt_sample',
      {
        name: 'Official Layout',
        sourceType: 'blank',
        objects: [{ id: 'stage', kind: 'stage', x: 10, y: 20, svgMarkup: '<svg />' }],
      },
      { actorId: 'user_pmcm_1', name: 'PMCM Admin', role: 'pmcm-admin' },
    );

    expect(draft.status).toBe('pmcm_draft');
    expect(draft.createdByRole).toBe('pmcm-admin');
    expect(state.floorPlans).toHaveLength(1);
    expect(state.floorPlans[0]).toMatchObject({ ownerId: 'user_pmcm_1' });
    expect(state.floorPlanDrafts[0]).toMatchObject({ name: 'Official Layout', status: 'pmcm_draft' });
    expect(state.floorPlanObjects[0]).toMatchObject({ objectId: 'stage', kind: 'stage', svgMarkup: '<svg />' });
    expect(state.events[0]).toMatchObject({ floorPlanStatus: 'pmcm_draft', readiness: 'Floorplan draft in progress' });
    expect(auditWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_sample',
        actor: 'PMCM Admin',
        action: 'Created floorplan draft: Official Layout',
        affectedType: 'floor_plan_draft',
      }),
      undefined,
    );
  });

  it('retains the verified System role for a system-created official draft', async () => {
    const { service, state } = createService();

    const draft = await service.createFloorPlanDraft(
      'evt_sample',
      { name: 'System-authored Layout', sourceType: 'blank' },
      { actorId: 'system_seed', name: 'System', role: 'system' },
    );

    expect(draft.createdByRole).toBe('system');
    expect(state.floorPlanDrafts[0].createdByRole).toBe('system');
  });
  it('rejects an official floorplan draft when the conforme is unsigned', async () => {
    const { service, state } = createService();
    state.events[0].inquiry = { conformeSignedAt: null };

    await expect(
      service.createFloorPlanDraft(
        'evt_sample',
        { name: 'Official Layout', sourceType: 'blank' },
        { actorId: 'user_pmcm_1', name: 'PMCM Admin', role: 'pmcm-admin' },
      ),
    ).rejects.toThrow('Official floor plan requires a signed conforme');

    expect(state.floorPlans).toHaveLength(0);
    expect(state.floorPlanDrafts).toHaveLength(0);
    expect(state.events[0]).toMatchObject({ floorPlanStatus: 'not_started', readiness: 'Planning' });
  });

  it('reads conforme state through its own focused query, not the access-scope include', async () => {
    const { service, prisma } = createService();

    await service.createFloorPlanDraft(
      'evt_sample',
      { name: 'Official Layout', sourceType: 'blank' },
      { actorId: 'user_pmcm_1', name: 'PMCM Admin', role: 'pmcm-admin' },
    );

    // Proves the gate actually issued its own conforme read rather than being bypassed.
    expect(prisma.opsEvent.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt_sample' },
        select: expect.objectContaining({ inquiry: { select: { conformeSignedAt: true } } }),
      }),
    );
  });

  it('creates client layout preferences without making them official approved layouts', async () => {
    const { service, state, notificationOutboxWriter } = createService();
    state.events[0].clientPortalStatus = 'unlocked';

    const draft = await service.createFloorPlanPreference(
      'evt_sample',
      {
        name: 'Client Preference',
        seatingStyle: 'banquet',
        stagePreference: 'center',
        flowNotes: 'Keep registration near entrance.',
        guestCount: 180,
        constraints: ['VIP tables near stage'],
        objects: [{ id: 'vip-zone', kind: 'zone' }],
      },
      { actorId: 'user_client_1', name: 'Ana Reyes', role: 'client' },
    );

    expect(draft.status).toBe('client_submitted');
    expect(draft.createdByRole).toBe('client');
    expect(state.floorPlans[0]).toMatchObject({ ownerId: 'user_client_1' });
    expect(state.floorPlanDrafts[0].clientPreference).toMatchObject({ seatingStyle: 'banquet', guestCount: 180 });
    expect(state.events[0]).toMatchObject({ floorPlanStatus: 'client_submitted', readiness: 'Client layout preference received' });
    expect(notificationOutboxWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_sample',
        recipient: 'PMCM Admin',
        message: 'Client submitted a layout preference: Client Preference',
      }),
      undefined,
    );
  });

  it('does not let a client layout preference downgrade an already-approved floorplan', async () => {
    const { service, state, notificationOutboxWriter } = createService();
    state.events[0].clientPortalStatus = 'unlocked';
    state.events[0].floorPlanStatus = 'approved';
    state.events[0].readiness = 'Floorplan approved';

    const draft = await service.createFloorPlanPreference(
      'evt_sample',
      {
        name: 'Post-approval Preference',
        seatingStyle: 'banquet',
        stagePreference: 'center',
        flowNotes: 'Please widen the aisle.',
        guestCount: 180,
        constraints: [],
      },
      { actorId: 'user_client_1', name: 'Ana Reyes', role: 'client' },
    );

    // The preference itself is still recorded...
    expect(draft.status).toBe('client_submitted');
    expect(draft.createdByRole).toBe('client');
    expect(state.floorPlans[0]).toMatchObject({ ownerId: 'user_client_1' });
    // ...and PMCM is still told the client wants changes.
    expect(notificationOutboxWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_sample',
        recipient: 'PMCM Admin',
        message: 'Client submitted a layout preference: Post-approval Preference',
      }),
      undefined,
    );
    // ...but the approved event is not knocked out of approved state.
    expect(state.events[0]).toMatchObject({ floorPlanStatus: 'approved', readiness: 'Floorplan approved' });
  });

  it('returns submitted and approved snapshots without mutating stored canvas state', async () => {
    const { service, state } = createService();
    state.floorPlanDrafts.push({
      id: 'fpd_sample',
      eventId: 'evt_sample',
      floorPlanId: 'plan_sample',
      name: 'Official Layout',
      status: 'approved',
      isActive: true,
      sourceType: 'blank',
      createdByRole: 'pmcm-admin',
      submittedSnapshot: { objects: [{ id: 'stage', x: 10 }] },
      approvedSnapshot: { objects: [{ id: 'stage', x: 20 }] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const submitted = await service.getFloorPlanSnapshot('evt_sample', 'fpd_sample', 'submitted');
    const approved = await service.getFloorPlanSnapshot('evt_sample', 'fpd_sample', 'approved');

    expect((submitted as any).objects[0].x).toBe(10);
    expect((approved as any).objects[0].x).toBe(20);
    expect(state.floorPlanDrafts[0].approvedSnapshot.objects[0].x).toBe(20);
  });

  it('recovers legacy official drafts that predate persisted snapshots', async () => {
    const { service, state } = createService();
    state.floorPlans.push({
      id: 'plan_legacy',
      name: 'Legacy Layout',
      venue: 'Legacy Venue',
      width: 1200,
      height: 800,
      gridSize: 20,
      pax: 180,
      objects: [{ id: 'stage', kind: 'stage', x: 10 }],
      guests: [],
      suppliers: [],
      seats: [],
      seatCategories: [],
      updatedAt: new Date(),
    });
    state.floorPlanDrafts.push({
      id: 'fpd_legacy',
      eventId: 'evt_sample',
      floorPlanId: 'plan_legacy',
      name: 'Legacy Layout',
      status: 'approved',
      isActive: true,
      sourceType: 'template',
      createdByRole: 'pmcm-admin',
      submittedSnapshot: null,
      approvedSnapshot: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.getFloorPlanSnapshot('evt_sample', 'fpd_legacy', 'approved')).resolves.toMatchObject({
      id: 'plan_legacy',
      venue: 'Legacy Venue',
      objects: [{ id: 'stage', kind: 'stage', x: 10 }],
    });
  });

  it('does not recover non-official drafts through the official snapshot endpoint', async () => {
    const { service, state } = createService();
    state.floorPlans.push({ id: 'plan_draft', name: 'Draft', objects: [] });
    state.floorPlanDrafts.push({
      id: 'fpd_draft',
      eventId: 'evt_sample',
      floorPlanId: 'plan_draft',
      name: 'Draft',
      status: 'pmcm_draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.getFloorPlanSnapshot('evt_sample', 'fpd_draft', 'approved')).rejects.toThrow(
      'Floorplan snapshot not found',
    );
  });
});
