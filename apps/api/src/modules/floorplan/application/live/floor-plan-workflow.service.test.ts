import { describe, expect, it, vi } from 'vitest';
import { FloorPlanWorkflowService } from './floor-plan-workflow.service';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { FloorplanProjectionInput, FloorplanProjectionWriter } from '@prism/contexts/event-lifecycle';

function createService() {
  const state = {
    ocularVisitStatus: 'completed' as string | null,
    events: [
      {
        id: 'evt_sample',
        inquiryId: 'inq_sample',
        // Bare new Date() on purpose: the conforme gate checks null vs non-null, so the value is
        // inert, and a dated literal here would be a future check:test-clocks liability.
        inquiry: { email: 'ana@example.test', conformeSignedAt: new Date() },
        clientName: 'Ana Reyes',
        eventName: 'Ayala Summit',
        clientPortalStatus: 'unlocked',
        archived: false,
        freezeStatus: 'open',
        floorPlanStatus: 'not_started',
        readiness: 'Planning',
        floorPlanProjectionVersion: 0,
      },
    ] as any[],
    floorPlans: [] as any[],
    floorPlanObjects: [] as any[],
    floorPlanDrafts: [] as any[],
    venueTemplates: [] as any[],
    projectionClock: null as null | { eventId: string; version: number },
  };
  const prisma = {
    opsEvent: {
      findUnique: vi.fn(async ({ where }) => state.events.find((event) => event.id === where.id) ?? null),
      updateMany: vi.fn(async ({ where, data }) => {
        const event = state.events.find((item) => item.id === where.id);
        if (!event || event.floorPlanProjectionVersion >= where.floorPlanProjectionVersion.lt) return { count: 0 };
        Object.assign(event, data);
        return { count: 1 };
      }),
    },
    opsOcularVisitRequest: {
      findUnique: vi.fn(async () => state.ocularVisitStatus === null ? null : { status: state.ocularVisitStatus }),
    },
    floorPlan: {
      create: vi.fn(async ({ data }) => {
        const row = { ...data, updatedAt: data.updatedAt ?? new Date() };
        state.floorPlans.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }) => state.floorPlans.find((plan) => plan.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }) => {
        const plan = state.floorPlans.find((item) => item.id === where.id);
        if (!plan) throw new Error('plan not found');
        Object.assign(plan, data);
        return plan;
      }),
    },
    floorPlanObject: {
      createMany: vi.fn(async ({ data }) => {
        state.floorPlanObjects.push(...data);
        return { count: data.length };
      }),
      deleteMany: vi.fn(async ({ where }) => {
        const remaining = state.floorPlanObjects.filter((object) => object.floorPlanId !== where.floorPlanId);
        const count = state.floorPlanObjects.length - remaining.length;
        state.floorPlanObjects.splice(0, state.floorPlanObjects.length, ...remaining);
        return { count };
      }),
    },
    venueTemplate: {
      findUnique: vi.fn(async ({ where }) => state.venueTemplates.find((template) => template.id === where.id) ?? null),
    },
    opsFloorPlanDraft: {
      create: vi.fn(async ({ data }) => {
        const row = { ...data, createdAt: data.createdAt ?? new Date(), updatedAt: data.updatedAt ?? new Date() };
        state.floorPlanDrafts.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where }) =>
        state.floorPlanDrafts.filter((draft) =>
          where.eventId.in.includes(draft.eventId) &&
          where.status.in.includes(draft.status) &&
          (!where.sourceType || draft.sourceType !== where.sourceType.not),
        ),
      ),
      findFirst: vi.fn(async ({ where }) =>
        (() => {
          const draft = state.floorPlanDrafts.find((item) =>
            Object.entries(where).every(([key, value]) => {
              if (key === 'sourceType' && typeof value === 'object' && value !== null && 'not' in value) {
                return item.sourceType !== value.not;
              }
              return item[key] === value;
            }),
          );
          return draft ? { ...draft } : null;
        })(),
      ),
      findUnique: vi.fn(async ({ where }) => state.floorPlanDrafts.find((draft) => draft.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }) => {
        const draft = state.floorPlanDrafts.find((item) => item.id === where.id);
        if (!draft) throw new Error('draft not found');
        Object.assign(draft, data, { updatedAt: data.updatedAt ?? new Date() });
        return draft;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        let count = 0;
        for (const draft of state.floorPlanDrafts) {
          if (where?.id && draft.id !== where.id) continue;
          if (where?.eventId && draft.eventId !== where.eventId) continue;
          if (typeof where?.isActive === 'boolean' && draft.isActive !== where.isActive) continue;
          if (where?.status && draft.status !== where.status) continue;
          if (typeof where?.sourceType === 'string' && draft.sourceType !== where.sourceType) continue;
          if (where?.sourceType?.not && draft.sourceType === where.sourceType.not) continue;
          Object.assign(draft, data);
          count += 1;
        }
        return { count };
      }),
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
    $queryRawUnsafe: vi.fn(async () => []),
    $transaction: vi.fn(async (callback) => callback(prisma)),
  };
  const lifecycleEventReferences = {
    findFloorplanEvent: vi.fn(async (eventId: string, transaction?: PrismTransactionContext) => {
      const event = await (transaction?.prisma ?? prisma).opsEvent.findUnique({ where: { id: eventId } });
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
        ocularVisitStatus: state.ocularVisitStatus,
      };
    }),
  };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const notificationOutboxWriter = { write: vi.fn(async () => undefined) };
  const lifecycleProjectionWriter: FloorplanProjectionWriter = {
    project: vi.fn(async (input: FloorplanProjectionInput, transaction: PrismTransactionContext) => {
      const result = await transaction.prisma.opsEvent.updateMany({
        where: { id: input.eventId, floorPlanProjectionVersion: { lt: input.version } },
        data: { ...input.state, floorPlanProjectionVersion: input.version },
      });
      if (result.count !== 1) throw new ConflictException('Stale floorplan projection version');
      return { applied: true, version: input.version };
    }),
  };
  const service = new FloorPlanWorkflowService(
    prisma as any,
    auditWriter as any,
    notificationOutboxWriter as any,
    new WorkflowCommandService(),
    lifecycleProjectionWriter,
    lifecycleEventReferences,
  );
  return { service, state, prisma, auditWriter, notificationOutboxWriter, lifecycleProjectionWriter, lifecycleEventReferences };
}

describe('FloorPlanWorkflowService', () => {
  it('validates persisted preference and snapshot JSON before mapping the shared read contract', () => {
    const { service } = createService();
    const now = new Date('2026-10-04T00:00:00.000Z');

    const mapped = service.mapFloorPlanDraft({
      id: 'fpd_1',
      eventId: 'evt_sample',
      floorPlanId: 'plan_1',
      name: 'Official',
      status: 'approved',
      isActive: true,
      sourceType: 'blank',
      createdByRole: 'pmcm-admin',
      clientPreference: { seatingStyle: 'banquet', stagePreference: 'center', flowNotes: 'Clear entrance', guestCount: 120, constraints: [] },
      submittedSnapshot: { id: 'plan_1', name: 'Official', venue: 'Hall A', width: 100, height: 60, gridSize: 10, pax: 120, objects: [] },
      approvedSnapshot: ['unexpected', 'array'],
      submittedAt: now,
      reviewedAt: null,
      approvedAt: now,
      submittedSnapshotAt: now,
      approvedSnapshotAt: now,
      revisionComment: '',
      createdAt: now,
      updatedAt: now,
    });

    expect(mapped.clientPreference).toMatchObject({ seatingStyle: 'banquet', guestCount: 120 });
    expect(mapped.submittedSnapshot).toMatchObject({ id: 'plan_1', venue: 'Hall A' });
    expect(mapped).not.toHaveProperty('approvedSnapshot');
  });

  it('blocksOfficialDraftWithoutOcularVisit', async () => {
    const { service, state } = createService();
    state.ocularVisitStatus = null;

    await expect(service.createFloorPlanDraft(
      'evt_sample',
      { name: 'Official Layout', sourceType: 'blank' },
      { actorId: 'user_pmcm_1', name: 'PMCM Admin', role: 'pmcm-admin' },
    )).rejects.toThrow('Official floor plan requires a completed or waived ocular visit');
    expect(state.floorPlans).toHaveLength(0);
  });

  it('blocksOfficialDraftForUnknownOcularState', async () => {
    const { service, state } = createService();
    state.ocularVisitStatus = 'unexpected';

    await expect(service.createFloorPlanDraft(
      'evt_sample',
      { name: 'Official Layout', sourceType: 'blank' },
      { actorId: 'user_pmcm_1', name: 'PMCM Admin', role: 'pmcm-admin' },
    )).rejects.toThrow('Official floor plan requires a completed or waived ocular visit');
    expect(state.floorPlans).toHaveLength(0);
  });

  it('fails closed when the Lifecycle owner no longer has the referenced event', async () => {
    const { service, state } = createService();
    state.events.length = 0;

    await expect(service.createFloorPlanDraft(
      'evt_sample',
      { name: 'Official Layout', sourceType: 'blank' },
      { actorId: 'user_pmcm_1', name: 'PMCM Admin', role: 'pmcm-admin' },
    )).rejects.toThrow('Event not found');
    expect(state.floorPlans).toHaveLength(0);
  });

  it.each([
    ['archived', { archived: true }],
    ['frozen', { freezeStatus: 'frozen' }],
  ])('blocks a client preference while the event is %s', async (_state, eventChanges) => {
    const { service, state } = createService();
    Object.assign(state.events[0], eventChanges);

    await expect(service.createFloorPlanPreference(
      'evt_sample',
      {
        name: 'Client Preference',
        seatingStyle: 'banquet',
        stagePreference: 'center',
        flowNotes: 'Keep the entrance clear.',
        guestCount: 120,
        constraints: [],
      },
      { actorId: 'user_client_1', name: 'Ana Reyes', role: 'client' },
    )).rejects.toThrow('cannot be changed');
    expect(state.floorPlans).toHaveLength(0);
  });

  it.each(['completed', 'waived'])('allowsOfficialDraftAfter%s', async (status) => {
    const { service, state } = createService();
    state.ocularVisitStatus = status;

    const draft = await service.createFloorPlanDraft(
      'evt_sample',
      { name: 'Official Layout', sourceType: 'blank' },
      { actorId: 'user_pmcm_1', name: 'PMCM Admin', role: 'pmcm-admin' },
    );

    expect(draft.status).toBe('pmcm_draft');
    expect(state.floorPlanDrafts).toHaveLength(1);
  });

  it('keeps client preferences outside the official conforme and ocular gates', async () => {
    const { service, state } = createService();
    state.ocularVisitStatus = null;
    state.events[0].clientPortalStatus = 'unlocked';

    await service.createFloorPlanPreference(
      'evt_sample',
      {
        name: 'Client Preference',
        seatingStyle: 'banquet',
        stagePreference: 'center',
        flowNotes: 'Please keep registration near entrance.',
        guestCount: 180,
        constraints: [],
      },
      { actorId: 'user_client_1', name: 'Ana Reyes', role: 'client' },
    );

    expect(state.floorPlanDrafts).toHaveLength(1);
  });

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

  it('copies a venue-library preset into the official draft and ignores client-sent layout objects', async () => {
    const { service, state } = createService();
    state.venueTemplates.push({
      id: 'tpl_gala',
      pax: 120,
      includeGuests: false,
      includeSuppliers: false,
      guests: [],
      suppliers: [],
      floorPlan: {
        width: 40,
        height: 25,
        gridSize: 2,
        objects: [],
        objectRows: [{ objectId: 'stage', objectData: { id: 'stage', kind: 'stage' }, zIndex: 0 }],
      },
    });

    const draft = await service.createFloorPlanDraft(
      'evt_sample',
      {
        name: 'Gala Layout',
        sourceType: 'template',
        venueTemplateId: 'tpl_gala',
        objects: [{ id: 'client-table', kind: 'table' }],
        width: 5,
      },
      { actorId: 'user_pmcm_1', name: 'PMCM Admin', role: 'pmcm-admin' },
    );

    expect(draft.sourceType).toBe('template');
    expect(state.floorPlans[0]).toMatchObject({ width: 40, height: 25, gridSize: 2, pax: 120 });
    expect(state.floorPlanObjects.map((row) => row.objectId)).toEqual(['stage']);
  });

  it('rejects a venue-library preset that does not exist without creating a draft', async () => {
    const { service, state } = createService();

    await expect(service.createFloorPlanDraft(
      'evt_sample',
      { name: 'Missing Preset', sourceType: 'template', venueTemplateId: 'tpl_missing' },
      { actorId: 'user_pmcm_1', name: 'PMCM Admin', role: 'pmcm-admin' },
    )).rejects.toMatchObject({ status: 404 });
    expect(state.floorPlans).toHaveLength(0);
    expect(state.floorPlanDrafts).toHaveLength(0);
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

  it('submits a draft and projects its status through the Lifecycle owner with an increasing version', async () => {
    const { service, state, lifecycleProjectionWriter } = createService();
    const actor = { actorId: 'user_pmcm_1', name: 'PMCM Admin', role: 'pmcm-admin' } as const;
    const draft = await service.createFloorPlanDraft('evt_sample', { name: 'Official Layout', sourceType: 'blank' }, actor);

    const submitted = await service.submitFloorPlanDraft('evt_sample', draft.id, actor);

    expect(submitted.status).toBe('in_review');
    expect(state.events[0]).toMatchObject({
      floorPlanStatus: 'in_review',
      floorPlanId: draft.floorPlanId,
      readiness: 'Floorplan awaiting review',
      floorPlanProjectionVersion: 2,
    });
    expect(lifecycleProjectionWriter.project).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventId: 'evt_sample',
        version: 2,
        state: expect.objectContaining({ floorPlanStatus: 'in_review', floorPlanId: draft.floorPlanId }),
      }),
      expect.objectContaining({ correlationId: 'floorplan-projection:evt_sample:2' }),
    );
  });

  it('allows only one concurrent submission of the same draft', async () => {
    const { service, state } = createService();
    const actor = { actorId: 'user_pmcm_1', name: 'PMCM Admin', role: 'pmcm-admin' } as const;
    const draft = await service.createFloorPlanDraft('evt_sample', { name: 'Official Layout', sourceType: 'blank' }, actor);

    const results = await Promise.allSettled([
      service.submitFloorPlanDraft('evt_sample', draft.id, actor),
      service.submitFloorPlanDraft('evt_sample', draft.id, actor),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(state.floorPlanDrafts[0].status).toBe('in_review');
    expect(state.events[0]).toMatchObject({ floorPlanStatus: 'in_review', floorPlanProjectionVersion: 2 });
  });

  it('does not submit a reopened client preference as an official floorplan', async () => {
    const { service, state } = createService();
    state.floorPlanDrafts.push({
      id: 'fpd_preference',
      eventId: 'evt_sample',
      floorPlanId: 'plan_preference',
      name: 'Client preference',
      status: 'revision_requested',
      sourceType: 'client_preference',
      createdByRole: 'client',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.submitFloorPlanDraft('evt_sample', 'fpd_preference', {
        name: 'PMCM Admin',
        role: 'pmcm-admin',
      }),
    ).rejects.toThrow('Client preferences cannot be submitted as official floorplans');
    expect(state.floorPlanDrafts[0]?.status).toBe('revision_requested');
  });

  it('approves only a submitted draft and keeps the Lifecycle projection synchronized', async () => {
    const { service, state } = createService();
    const actor = { actorId: 'user_pmcm_1', name: 'PMCM Admin', role: 'pmcm-admin' } as const;
    const draft = await service.createFloorPlanDraft('evt_sample', { name: 'Official Layout', sourceType: 'blank' }, actor);
    await service.submitFloorPlanDraft('evt_sample', draft.id, actor);

    const approved = await service.approveFloorPlanDraft('evt_sample', draft.id, actor);

    expect(approved).toMatchObject({ status: 'approved', isActive: true });
    expect(state.events[0]).toMatchObject({
      floorPlanStatus: 'approved',
      floorPlanId: draft.floorPlanId,
      readiness: 'Floorplan approved',
      floorPlanProjectionVersion: 3,
    });
  });

  it('does not approve a client preference as the active official floorplan', async () => {
    const { service, state, prisma } = createService();
    state.floorPlanDrafts.push({
      id: 'fpd_preference',
      eventId: 'evt_sample',
      floorPlanId: 'plan_preference',
      name: 'Client preference',
      status: 'in_review',
      sourceType: 'client_preference',
      createdByRole: 'client',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.approveFloorPlanDraft('evt_sample', 'fpd_preference', {
        name: 'PMCM Admin',
        role: 'pmcm-admin',
      }),
    ).rejects.toThrow('Client preferences cannot be approved as official floorplans');
    expect(state.floorPlanDrafts[0]?.isActive).toBe(false);
    expect(prisma.opsFloorPlanDraft.updateMany).not.toHaveBeenCalled();
  });

  it('rejects approval when a concurrent client revision changed the draft after the initial read', async () => {
    const { service, state, lifecycleEventReferences } = createService();
    const actor = { actorId: 'user_pmcm_1', name: 'PMCM Admin', role: 'pmcm-admin' } as const;
    const draft = await service.createFloorPlanDraft('evt_sample', { name: 'Official Layout', sourceType: 'blank' }, actor);
    await service.submitFloorPlanDraft('evt_sample', draft.id, actor);
    const readEvent = lifecycleEventReferences.findFloorplanEvent.getMockImplementation();

    lifecycleEventReferences.findFloorplanEvent.mockImplementationOnce(async (eventId, transaction) => {
      state.floorPlanDrafts[0].status = 'revision_requested';
      if (!readEvent) throw new Error('Lifecycle test reader is not configured');
      return readEvent(eventId, transaction);
    });

    await expect(service.approveFloorPlanDraft('evt_sample', draft.id, actor))
      .rejects.toThrow('Floorplan draft changed before approval');
    expect(state.floorPlanDrafts[0].status).toBe('revision_requested');
    expect(state.events[0]).toMatchObject({ floorPlanStatus: 'in_review', floorPlanProjectionVersion: 2 });
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

  it('reads current Lifecycle gates through its owner capability inside the write transaction', async () => {
    const { service, lifecycleEventReferences, prisma } = createService();

    await service.createFloorPlanDraft(
      'evt_sample',
      { name: 'Official Layout', sourceType: 'blank' },
      { actorId: 'user_pmcm_1', name: 'PMCM Admin', role: 'pmcm-admin' },
    );

    expect(lifecycleEventReferences.findFloorplanEvent).toHaveBeenCalledWith(
      'evt_sample',
      expect.objectContaining({ prisma: expect.anything(), correlationId: 'floorplan-create:evt_sample' }),
    );
    expect(prisma.opsEvent.findUnique).toHaveBeenCalledWith({ where: { id: 'evt_sample' } });
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

  it('rejects a second client preference for the same event without creating another draft', async () => {
    const { service, state } = createService();
    state.events[0].clientPortalStatus = 'unlocked';
    const input = {
      name: 'Client Preference',
      seatingStyle: 'banquet',
      stagePreference: 'center',
      flowNotes: 'Keep registration near entrance.',
      guestCount: 180,
      constraints: ['VIP tables near stage'],
    };
    const actor = { actorId: 'user_client_1', name: 'Ana Reyes', role: 'client' as const };

    await service.createFloorPlanPreference('evt_sample', input, actor);
    await expect(service.createFloorPlanPreference('evt_sample', input, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(state.floorPlans).toHaveLength(1);
    expect(state.floorPlanDrafts).toHaveLength(1);
  });

  it('lets the client create a preference when a PMCM-created preference row exists', async () => {
    const { service, state } = createService();
    state.floorPlanDrafts.push({
      id: 'fpd_pmcm_preference',
      eventId: 'evt_sample',
      floorPlanId: 'plan_pmcm_preference',
      name: 'PMCM preference placeholder',
      status: 'pmcm_draft',
      isActive: false,
      sourceType: 'client_preference',
      createdByRole: 'pmcm-admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const saved = await service.createFloorPlanPreference(
      'evt_sample',
      {
        name: 'Client Preference',
        seatingStyle: 'banquet',
        stagePreference: 'center',
        flowNotes: 'Keep registration near entrance.',
        guestCount: 180,
        constraints: [],
      },
      { actorId: 'user_client_1', name: 'Ana Reyes', role: 'client' },
    );

    expect(saved).toMatchObject({ sourceType: 'client_preference', createdByRole: 'client', status: 'client_submitted' });
    expect(state.floorPlanDrafts).toHaveLength(2);
  });

  it('resubmits an explicitly reopened preference by updating the same draft and plan', async () => {
    const { service, state, prisma, notificationOutboxWriter } = createService();
    state.events[0].clientPortalStatus = 'unlocked';
    state.floorPlans.push({
      id: 'plan_preference',
      eventId: 'evt_sample',
      ownerId: 'user_client_1',
      name: 'Old preference',
      venue: 'Ayala Summit',
      width: 30,
      height: 20,
      gridSize: 1,
      pax: 120,
      objects: [],
      guests: [],
      suppliers: [],
      seats: [],
      seatCategories: [],
      updatedAt: new Date(),
    });
    state.floorPlanDrafts.push({
      id: 'fpd_preference',
      eventId: 'evt_sample',
      floorPlanId: 'plan_preference',
      name: 'Old preference',
      status: 'revision_requested',
      isActive: false,
      sourceType: 'client_preference',
      createdByRole: 'client',
      clientPreference: { seatingStyle: 'old', stagePreference: 'old', flowNotes: '', guestCount: 120, constraints: [], notes: '' },
      revisionComment: 'Please widen the aisle.',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createFloorPlanPreference(
      'evt_sample',
      {
        name: 'Updated preference',
        seatingStyle: 'banquet',
        stagePreference: 'center',
        flowNotes: 'Keep registration near entrance.',
        guestCount: 180,
        constraints: ['VIP tables near stage'],
      },
      { actorId: 'user_client_1', name: 'Ana Reyes', role: 'client' },
    );

    expect(result).toMatchObject({ id: 'fpd_preference', status: 'client_submitted', name: 'Updated preference' });
    expect(state.floorPlanDrafts).toHaveLength(1);
    expect(state.floorPlans).toHaveLength(1);
    expect(state.floorPlanDrafts[0].clientPreference).toMatchObject({ seatingStyle: 'banquet', guestCount: 180 });
    expect(state.floorPlanDrafts[0].revisionComment).toBe('');
    expect(prisma.floorPlan.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'plan_preference' } }));
    expect(notificationOutboxWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt_sample', recipient: 'PMCM Admin' }),
      undefined,
    );
  });

  it('reopens the same submitted client preference for PMCM review and notifies the client', async () => {
    const { service, state, auditWriter, notificationOutboxWriter, prisma } = createService();
    state.events[0].floorPlanStatus = 'client_submitted';
    state.floorPlanDrafts.push({
      id: 'fpd_preference',
      eventId: 'evt_sample',
      floorPlanId: 'plan_preference',
      name: 'Client preference',
      status: 'client_submitted',
      isActive: false,
      sourceType: 'client_preference',
      createdByRole: 'client',
      clientPreference: { seatingStyle: 'banquet', stagePreference: 'center', flowNotes: '', guestCount: 120, constraints: [] },
      revisionComment: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const reopened = await service.reopenClientPreference('evt_sample', 'fpd_preference', {
      actorId: 'user_pmcm_1',
      name: 'Maxine',
      role: 'pmcm-admin',
    });

    expect(reopened).toMatchObject({ id: 'fpd_preference', status: 'revision_requested' });
    expect(state.floorPlanDrafts).toHaveLength(1);
    expect(state.events[0].floorPlanStatus).toBe('revision_requested');
    expect(state.floorPlanDrafts[0].reviewedAt).toBeInstanceOf(Date);
    expect(auditWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_sample',
        actor: 'Maxine',
        actorRole: 'pmcm-admin',
        affectedType: 'floor_plan_draft',
        affectedId: 'fpd_preference',
      }),
      expect.objectContaining({ actorId: 'user_pmcm_1', prisma }),
    );
    expect(notificationOutboxWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt_sample', recipient: 'Client' }),
      expect.objectContaining({ actorId: 'user_pmcm_1', prisma }),
    );
  });

  it('does not reopen a client preference after the official floorplan is approved', async () => {
    const { service, state, auditWriter, notificationOutboxWriter } = createService();
    state.events[0].floorPlanStatus = 'approved';
    state.floorPlanDrafts.push({
      id: 'fpd_preference',
      eventId: 'evt_sample',
      floorPlanId: 'plan_preference',
      name: 'Client preference',
      status: 'client_submitted',
      isActive: false,
      sourceType: 'client_preference',
      createdByRole: 'client',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.reopenClientPreference('evt_sample', 'fpd_preference', {
        actorId: 'user_pmcm_1',
        name: 'Maxine',
        role: 'pmcm-admin',
      }),
    ).rejects.toThrow('A client preference cannot be reopened after official floorplan approval');

    expect(state.floorPlanDrafts[0]?.status).toBe('client_submitted');
    expect(auditWriter.write).not.toHaveBeenCalled();
    expect(notificationOutboxWriter.write).not.toHaveBeenCalled();
  });

  it('does not reopen a preference while an approved official plan remains active', async () => {
    const { service, state, auditWriter, notificationOutboxWriter } = createService();
    state.events[0].floorPlanStatus = 'in_review';
    state.floorPlanDrafts.push(
      {
        id: 'fpd_official',
        eventId: 'evt_sample',
        floorPlanId: 'plan_official',
        name: 'Official layout',
        status: 'approved',
        isActive: true,
        sourceType: 'blank',
        createdByRole: 'pmcm-admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'fpd_preference',
        eventId: 'evt_sample',
        floorPlanId: 'plan_preference',
        name: 'Client preference',
        status: 'client_submitted',
        isActive: false,
        sourceType: 'client_preference',
        createdByRole: 'client',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    await expect(
      service.reopenClientPreference('evt_sample', 'fpd_preference', {
        actorId: 'user_pmcm_1',
        name: 'Maxine',
        role: 'pmcm-admin',
      }),
    ).rejects.toThrow('A client preference cannot be reopened after official floorplan approval');

    expect(state.floorPlanDrafts[1]?.status).toBe('client_submitted');
    expect(auditWriter.write).not.toHaveBeenCalled();
    expect(notificationOutboxWriter.write).not.toHaveBeenCalled();
  });

  it('does not reopen an official floorplan as a client preference', async () => {
    const { service, state, auditWriter, notificationOutboxWriter } = createService();
    state.floorPlanDrafts.push({
      id: 'fpd_official',
      eventId: 'evt_sample',
      floorPlanId: 'plan_official',
      name: 'Official',
      status: 'client_submitted',
      isActive: false,
      sourceType: 'blank',
      createdByRole: 'pmcm-admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.reopenClientPreference('evt_sample', 'fpd_official', {
        actorId: 'user_pmcm_1',
        name: 'Maxine',
        role: 'pmcm-admin',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(state.floorPlanDrafts[0].status).toBe('client_submitted');
    expect(auditWriter.write).not.toHaveBeenCalled();
    expect(notificationOutboxWriter.write).not.toHaveBeenCalled();
  });

  it('rejects a preference ID outside the requested event scope', async () => {
    const { service, state } = createService();
    state.floorPlanDrafts.push({
      id: 'fpd_other_event',
      eventId: 'evt_other',
      floorPlanId: 'plan_other_event',
      name: 'Other event preference',
      status: 'client_submitted',
      isActive: false,
      sourceType: 'client_preference',
      createdByRole: 'client',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.reopenClientPreference('evt_sample', 'fpd_other_event', {
        actorId: 'user_pmcm_1',
        name: 'Maxine',
        role: 'pmcm-admin',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(state.floorPlanDrafts[0].status).toBe('client_submitted');
  });

  it('rejects reopening a preference that is already waiting for client revision', async () => {
    const { service, state, notificationOutboxWriter } = createService();
    state.floorPlanDrafts.push({
      id: 'fpd_preference',
      eventId: 'evt_sample',
      floorPlanId: 'plan_preference',
      name: 'Client preference',
      status: 'revision_requested',
      isActive: false,
      sourceType: 'client_preference',
      createdByRole: 'client',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.reopenClientPreference('evt_sample', 'fpd_preference', {
        actorId: 'user_pmcm_1',
        name: 'Maxine',
        role: 'pmcm-admin',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(state.floorPlanDrafts[0].status).toBe('revision_requested');
    expect(notificationOutboxWriter.write).not.toHaveBeenCalled();
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
      submittedSnapshot: {
        id: 'plan_sample', name: 'Official Layout', venue: 'Hall', width: 1200, height: 800, gridSize: 20, pax: 180,
        objects: [{ id: 'stage', x: 10 }],
      },
      approvedSnapshot: {
        id: 'plan_sample', name: 'Official Layout', venue: 'Hall', width: 1200, height: 800, gridSize: 20, pax: 180,
        objects: [{ id: 'stage', x: 20 }],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const submitted = await service.getFloorPlanSnapshot('evt_sample', 'fpd_sample', 'submitted');
    const approved = await service.getFloorPlanSnapshot('evt_sample', 'fpd_sample', 'approved');

    expect(submitted.objects?.[0]).toMatchObject({ x: 10 });
    expect(approved.objects?.[0]).toMatchObject({ x: 20 });
    expect(state.floorPlanDrafts[0].approvedSnapshot.objects[0].x).toBe(20);
  });

  it('publishes the current canvas snapshot under the Lifecycle event lock and rejects archived events', async () => {
    const { service, state, lifecycleEventReferences } = createService();
    const draft = await service.createFloorPlanDraft(
      'evt_sample',
      { name: 'Official Layout', sourceType: 'blank', objects: [{ id: 'stage', kind: 'stage', x: 10, y: 10 }] },
      { actorId: 'user_pmcm_1', name: 'PMCM', role: 'pmcm-admin' },
    );
    const plan = state.floorPlans[0];
    plan.objects = [{ id: 'stage', x: 27 }];
    const submitted = await service.submitFloorPlanDraft('evt_sample', draft.id, { name: 'PMCM', role: 'pmcm-admin' });
    expect(lifecycleEventReferences.findFloorplanEvent).toHaveBeenCalledWith(
      'evt_sample',
      expect.objectContaining({ correlationId: `floorplan-submit:${draft.id}` }),
    );
    const submittedSnapshot = submitted.submittedSnapshot;
    if (!submittedSnapshot || typeof submittedSnapshot !== 'object' || !('objects' in submittedSnapshot) || !Array.isArray(submittedSnapshot.objects)) {
      throw new Error('The submitted floorplan snapshot was not persisted');
    }
    expect(submittedSnapshot.objects[0]).toMatchObject({ x: 27 });

    state.events[0].archived = true;
    await expect(service.approveFloorPlanDraft('evt_sample', draft.id, { name: 'PMCM', role: 'pmcm-admin' })).rejects.toThrow('Archived events cannot be changed');
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

  it('does not serve a floorplan draft from a different event', async () => {
    const { service, state, prisma } = createService();
    state.floorPlanDrafts.push({
      id: 'fpd_other_event',
      eventId: 'evt_other',
      floorPlanId: 'plan_other_event',
      name: 'Other Event Layout',
      status: 'approved',
      approvedSnapshot: { objects: [{ id: 'private-stage' }] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.getFloorPlanSnapshot('evt_sample', 'fpd_other_event', 'approved')).rejects.toThrow(
      'Floorplan draft not found',
    );
    expect(prisma.opsFloorPlanDraft.findFirst).toHaveBeenCalledWith({
      where: { id: 'fpd_other_event', eventId: 'evt_sample' },
    });
    expect(prisma.floorPlan.findUnique).not.toHaveBeenCalled();
  });

  it('lists only official snapshot entries for the supplied shared events', async () => {
    const { service, state, prisma } = createService();
    state.floorPlanDrafts.push(
      {
        id: 'fpd_review',
        eventId: 'evt_shared',
        name: 'Review Layout',
        status: 'in_review',
        sourceType: 'blank',
        updatedAt: new Date(),
      },
      {
        id: 'fpd_revision',
        eventId: 'evt_shared',
        name: 'Revision Layout',
        status: 'revision_requested',
        sourceType: 'blank',
        updatedAt: new Date(),
      },
      {
        id: 'fpd_approved',
        eventId: 'evt_other',
        name: 'Approved Layout',
        status: 'approved',
        sourceType: 'template',
        updatedAt: new Date(),
      },
      {
        id: 'fpd_preference',
        eventId: 'evt_shared',
        name: 'Client Preference',
        status: 'client_submitted',
        sourceType: 'client_preference',
        updatedAt: new Date(),
      },
      {
        id: 'fpd_reopened_preference',
        eventId: 'evt_shared',
        name: 'Reopened Preference',
        status: 'revision_requested',
        sourceType: 'client_preference',
        updatedAt: new Date(),
      },
      {
        id: 'fpd_unshared',
        eventId: 'evt_unshared',
        name: 'Unshared Layout',
        status: 'approved',
        sourceType: 'blank',
        updatedAt: new Date(),
      },
    );

    await expect(service.listClientSnapshotEntries(['evt_shared', 'evt_other'])).resolves.toEqual([
      {
        eventId: 'evt_shared',
        draftId: 'fpd_review',
        draftName: 'Review Layout',
        draftStatus: 'in_review',
        availableSnapshots: ['submitted'],
      },
      {
        eventId: 'evt_shared',
        draftId: 'fpd_revision',
        draftName: 'Revision Layout',
        draftStatus: 'revision_requested',
        availableSnapshots: ['submitted'],
      },
      {
        eventId: 'evt_other',
        draftId: 'fpd_approved',
        draftName: 'Approved Layout',
        draftStatus: 'approved',
        availableSnapshots: ['submitted', 'approved'],
      },
    ]);
    expect(prisma.opsFloorPlanDraft.findMany).toHaveBeenCalledWith({
      where: {
        eventId: { in: ['evt_shared', 'evt_other'] },
        status: { in: ['in_review', 'revision_requested', 'approved'] },
        sourceType: { not: 'client_preference' },
      },
      select: { eventId: true, id: true, name: true, status: true, updatedAt: true },
      orderBy: [{ eventId: 'asc' }, { updatedAt: 'desc' }, { id: 'asc' }],
    });
  });

  it('skips the draft query when there are no shared events', async () => {
    const { service, prisma } = createService();

    await expect(service.listClientSnapshotEntries([])).resolves.toEqual([]);
    expect(prisma.opsFloorPlanDraft.findMany).not.toHaveBeenCalled();
  });
});
