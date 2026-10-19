import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EventAccessPolicyService, type AuditWriter } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismaService } from '@prism/kernel/database';
import type { FloorPlanCanvasObject, FloorPlanGuest, PrismVerifiedEventActor, UpdatePlanInput } from '@prism/types';
import { PlansService } from './plans.service';

const planUpdatedAt = '2026-05-05T00:00:00.000Z';

function floorPlanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan_event_1',
    name: 'Event floorplan',
    venue: 'Client venue',
    width: 30,
    height: 20,
    gridSize: 1,
    pax: 120,
    ownerId: 'owner_sample',
    templateId: null,
    eventId: 'evt_1',
    objects: [],
    guests: [],
    suppliers: [],
    seats: [],
    seatCategories: [],
    objectRows: [],
    updatedAt: new Date(planUpdatedAt),
    ...overrides,
  };
}

function draft(
  status = 'pmcm_draft',
  clientName = 'Ana Reyes',
  clientEmail = 'owner@example.test',
  sourceType = status === 'client_submitted' ? 'client_preference' : 'blank',
  eventOverrides: Record<string, unknown> = {},
) {
  return {
    id: 'draft_1',
    eventId: 'evt_1',
    floorPlanId: 'plan_event_1',
    name: 'Draft floorplan',
    status,
    isActive: status === 'approved',
    sourceType,
    event: {
      id: 'evt_1',
      clientName,
      clientPortalStatus: 'unlocked',
      archived: false,
      freezeStatus: 'open',
      inquiry: { email: clientEmail },
      ...eventOverrides,
    },
  };
}

function createService(opsDraft: unknown, overrides: Record<string, unknown> = {}) {
  const audit: AuditWriter = { write: vi.fn().mockResolvedValue(undefined) };
  const accessPolicy = new EventAccessPolicyService(audit);
  const update = vi.fn().mockResolvedValue(floorPlanRow({ opsDraft }));
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const createMany = vi.fn().mockResolvedValue({ count: 0 });
  const queryRawUnsafe = vi.fn().mockResolvedValue([{ id: 'evt_1' }]);
  const floorPlanObject = { deleteMany, createMany };
  const floorPlan = {
    findUnique: vi.fn().mockResolvedValue({ ...floorPlanRow({ opsDraft }), ...overrides }),
    upsert: vi.fn(),
    update,
  };
  const event = (opsDraft as { event?: Record<string, unknown> } | null)?.event ?? {
    id: 'evt_1',
    eventName: 'Ayala Summit',
    clientName: 'Ana Reyes',
    clientPortalStatus: 'unlocked',
    archived: false,
    freezeStatus: 'open',
    floorPlanStatus: 'in_review',
    readiness: 'Floorplan awaiting review',
    inquiry: { email: 'owner@example.test' },
  };
  const lifecycleEventReferences = {
    findFloorplanEvent: vi.fn(async (eventId: string) => event ? ({
      eventId,
      eventName: String(event.eventName ?? 'Ayala Summit'),
      clientName: String(event.clientName ?? 'Ana Reyes'),
      clientPortalStatus: String(event.clientPortalStatus ?? 'unlocked'),
      archived: Boolean(event.archived),
      freezeStatus: String(event.freezeStatus ?? 'open'),
      floorPlanStatus: String(event.floorPlanStatus ?? 'in_review'),
      readiness: String(event.readiness ?? ''),
      primaryClientEmail: String((event.inquiry as { email?: string } | undefined)?.email ?? 'owner@example.test'),
      conformeSigned: true,
      ocularVisitStatus: 'completed',
    }) : null),
  };
  const prisma = {
    floorPlan,
    floorPlanObject,
    $queryRawUnsafe: queryRawUnsafe,
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({ floorPlan, floorPlanObject, $queryRawUnsafe: queryRawUnsafe }),
    ),
  } as unknown as PrismaService;

  return {
    service: new PlansService(prisma, accessPolicy, audit, lifecycleEventReferences),
    prisma: { ...prisma, floorPlan, floorPlanObject, $queryRawUnsafe: queryRawUnsafe },
    audit,
    accessPolicy,
    lifecycleEventReferences,
  };
}

function verifiedActor(
  role: PrismVerifiedEventActor['actorRole'],
  email: string,
  name: string,
): PrismVerifiedEventActor {
  const actorId = `user_${email}`;
  return {
    id: actorId,
    actorId,
    role,
    actorRole: role,
    email,
    actorEmail: email,
    name,
    actorName: name,
    expiresAt: '2099-01-01T00:00:00.000Z',
  };
}

function clientActor(email: string, name = 'Ana Reyes') {
  const { accessPolicy } = createService(null);
  return accessPolicy.resolveVerifiedActor(verifiedActor('client', email, name));
}

function pmcmActor() {
  const { accessPolicy } = createService(null);
  return accessPolicy.resolveVerifiedActor(verifiedActor('pmcm-admin', 'pmcm@example.test', 'PMCM Admin'));
}

function changes(overrides: Partial<UpdatePlanInput> = {}): UpdatePlanInput {
  return { expectedUpdatedAt: planUpdatedAt, objects: [], ...overrides };
}

describe('PlansService floorplan permissions and versioning', () => {
  it('returns not found for a missing plan without creating a fallback', async () => {
    const { service, prisma } = createService(null);
    prisma.floorPlan.findUnique.mockResolvedValue(null);

    await expect(service.getPlan('missing_plan', pmcmActor())).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.floorPlan.upsert).not.toHaveBeenCalled();
  });

  it('allows a verified owner to read their own unlocked client preference', async () => {
    const { service } = createService(draft('client_submitted'));

    await expect(service.getPlan('plan_event_1', clientActor('owner@example.test'))).resolves.toMatchObject({
      id: 'plan_event_1',
    });
  });

  it('blocks a linked secondary client from reading the raw preference plan', async () => {
    const { service } = createService(draft('client_submitted'));

    await expect(service.getPlan('plan_event_1', clientActor('secondary@example.test'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('requires a verified identity even when the primary email matches', async () => {
    const { service } = createService(draft('client_submitted'));
    const actor = { ...clientActor('owner@example.test'), verified: false };

    await expect(service.getPlan('plan_event_1', actor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['pmcm_draft', 'in_review', 'revision_requested', 'approved'])(
    'blocks Client raw-plan read and write for official %s drafts',
    async (status) => {
      const { service, prisma } = createService(draft(status, 'Ana Reyes', 'owner@example.test', 'blank'));
      const owner = clientActor('owner@example.test');

      await expect(service.getPlan('plan_event_1', owner)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.updatePlan('plan_event_1', changes(), owner)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.floorPlan.update).not.toHaveBeenCalled();
    },
  );

  it.each([OpsUserRole.Supplier, OpsUserRole.Coordinator, OpsUserRole.Guest])(
    'blocks %s raw-plan access to client preferences',
    async (role) => {
      const { service } = createService(draft('client_submitted'));
      const actor = { ...clientActor('owner@example.test'), role };

      await expect(service.getPlan('plan_event_1', actor)).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('blocks a different verified client with the same display name from reading a preference', async () => {
    const { service, audit } = createService(draft('client_submitted'));

    await expect(service.getPlan('plan_event_1', clientActor('other@example.test'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'evt_1',
      actorEmail: 'other@example.test',
    }));
  });

  it('blocks a different verified client with the same display name from updating a preference', async () => {
    const { service, prisma, audit } = createService(draft('client_submitted'));

    await expect(
      service.updatePlan('plan_event_1', changes({ width: 45 }), clientActor('other@example.test')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.floorPlan.update).not.toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'evt_1',
      actorEmail: 'other@example.test',
    }));
  });
  it('keeps official plan reads on the event-scoped snapshot endpoint', async () => {
    const { service } = createService(draft('in_review', 'Ana Reyes', 'owner@example.test', 'blank'));

    await expect(service.getPlan('plan_event_1', clientActor('owner@example.test'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('blocks anonymous plan reads', async () => {
    const { service, accessPolicy } = createService(draft('client_submitted'));

    await expect(service.getPlan('plan_event_1', accessPolicy.resolveActor({}))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('blocks a verified owner from reading while the client portal is locked', async () => {
    const { service, audit } = createService(
      draft('client_submitted', 'Ana Reyes', 'owner@example.test', 'client_preference', { clientPortalStatus: 'locked' }),
    );

    await expect(service.getPlan('plan_event_1', clientActor('owner@example.test'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt_1' }));
  });

  it('fails closed when the Lifecycle owner record is missing', async () => {
    const { service, prisma, lifecycleEventReferences } = createService(draft('pmcm_draft'));
    lifecycleEventReferences.findFloorplanEvent.mockResolvedValue(null);

    await expect(service.updatePlan('plan_event_1', changes(), pmcmActor())).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.floorPlan.update).not.toHaveBeenCalled();
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('blocks the event owner from editing a PMCM-created official draft', async () => {
    const { service, prisma, audit } = createService(draft('pmcm_draft'));

    await expect(service.updatePlan('plan_event_1', changes(), clientActor('owner@example.test'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.floorPlan.update).not.toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'evt_1',
      actorEmail: 'owner@example.test',
    }));
  });

  it('allows a verified client to update only their own submitted preference', async () => {
    const { service, prisma, audit, lifecycleEventReferences } = createService(draft('client_submitted'));

    await expect(
      service.updatePlan('plan_event_1', changes({ width: 45 }), clientActor('owner@example.test')),
    ).resolves.toMatchObject({ id: 'plan_event_1' });

    expect(prisma.floorPlan.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'plan_event_1', updatedAt: new Date(planUpdatedAt) },
    }));
    expect(lifecycleEventReferences.findFloorplanEvent).toHaveBeenCalledWith(
      'evt_1',
      expect.objectContaining({ prisma: expect.anything() }),
    );
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'evt_1',
      actorRole: 'client',
      actorEmail: 'owner@example.test',
    }), expect.objectContaining({ actorId: 'user_owner@example.test' }));
  });

  it('does not let a client add guest, supplier, or seating data to a preference', async () => {
    const { service, prisma } = createService(draft('client_submitted'));

    await expect(
      service.updatePlan('plan_event_1', changes({ guests: [] }), clientActor('owner@example.test')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.floorPlan.update).not.toHaveBeenCalled();
  });

  it.each(['in_review', 'approved'])('blocks PMCM edits after submission or approval (%s)', async (status) => {
    const { service, prisma } = createService(draft(status));

    await expect(service.updatePlan('plan_event_1', changes(), pmcmActor())).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.floorPlan.update).not.toHaveBeenCalled();
  });

  it.each([
    ['archived', { archived: true }],
    ['frozen', { freezeStatus: 'frozen' }],
  ])('blocks PMCM edits to %s events', async (_label, eventOverrides) => {
    const { service, prisma } = createService(draft('pmcm_draft', 'Ana Reyes', 'owner@example.test', 'blank', eventOverrides));

    await expect(service.updatePlan('plan_event_1', changes(), pmcmActor())).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.floorPlan.update).not.toHaveBeenCalled();
  });

  it('rejects a stale canvas version without writing or auditing a mutation', async () => {
    const { service, prisma, audit } = createService(draft('pmcm_draft'));

    await expect(
      service.updatePlan(
        'plan_event_1',
        changes({ expectedUpdatedAt: '2026-05-06T00:00:00.000Z' }),
        pmcmActor(),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.floorPlan.update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it('rechecks the Lifecycle freeze state inside the serializable write transaction', async () => {
    const { service, prisma, audit, lifecycleEventReferences } = createService(draft('pmcm_draft'));
    lifecycleEventReferences.findFloorplanEvent.mockResolvedValue({
      eventId: 'evt_1',
      eventName: 'Ayala Summit',
      clientName: 'Ana Reyes',
      clientPortalStatus: 'unlocked',
      archived: false,
      freezeStatus: 'frozen',
      floorPlanStatus: 'in_review',
      readiness: 'Floorplan awaiting review',
      primaryClientEmail: 'owner@example.test',
      conformeSigned: true,
      ocularVisitStatus: 'completed',
    });

    await expect(service.updatePlan('plan_event_1', changes(), pmcmActor())).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.floorPlan.update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it('rejects a plan version changed after authorization but before the transaction write', async () => {
    const { service, prisma, audit } = createService(draft('pmcm_draft'));
    prisma.floorPlan.findUnique
      .mockReset()
      .mockResolvedValueOnce(floorPlanRow({ opsDraft: draft('pmcm_draft') }))
      .mockResolvedValueOnce({
        id: 'plan_event_1',
        name: 'Event floorplan',
        eventId: 'evt_1',
        updatedAt: new Date(planUpdatedAt),
        opsDraft: { eventId: 'evt_1' },
      })
      .mockResolvedValueOnce(floorPlanRow({
        opsDraft: draft('pmcm_draft'),
        updatedAt: new Date('2026-05-06T00:00:00.000Z'),
      }));

    await expect(service.updatePlan('plan_event_1', changes(), pmcmActor())).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.floorPlan.update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it('allows a verified PMCM actor to update an open draft and records the actor in the transaction audit', async () => {
    const { service, prisma, audit } = createService(draft('pmcm_draft'));

    await expect(service.updatePlan('plan_event_1', changes(), pmcmActor())).resolves.toMatchObject({
      id: 'plan_event_1',
    });

    expect(prisma.floorPlan.update).toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'evt_1',
      actor: 'PMCM Admin',
      actorRole: 'pmcm-admin',
      actorEmail: 'pmcm@example.test',
      actionType: 'update',
    }), expect.objectContaining({ actorId: 'user_pmcm@example.test' }));
  });

  it('preserves System raw-plan access for official plans', async () => {
    const { service, prisma } = createService(draft('pmcm_draft'));
    const systemActor = { role: OpsUserRole.System, name: 'System', explicit: true, verified: true };

    await expect(service.getPlan('plan_event_1', systemActor)).resolves.toMatchObject({ id: 'plan_event_1' });
    await expect(service.updatePlan('plan_event_1', changes(), systemActor)).resolves.toMatchObject({
      id: 'plan_event_1',
    });
    expect(prisma.floorPlan.update).toHaveBeenCalled();
  });
});

const eventGuestRoster: FloorPlanGuest[] = [
  { id: 'g-ana', name: 'Ana Reyes', rsvp: 'confirmed' },
  { id: 'g-ben', name: 'Ben Cruz', rsvp: 'pending' },
  { id: 'g-dee', name: 'Dee Lim', rsvp: 'declined' },
];

function editorTable(overrides: Partial<FloorPlanCanvasObject> = {}): FloorPlanCanvasObject {
  return {
    id: 't1',
    name: 'Table 1',
    kind: 'ellipse',
    category: 'furniture',
    x: 1,
    y: 1,
    w: 2,
    h: 2,
    rotation: 0,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    seats: 2,
    locked: false,
    hidden: false,
    ...overrides,
  };
}

describe('PlansService table assignment eligibility on official saves', () => {
  it.each([
    {
      case: 'unknown guest',
      objects: [editorTable({ assignedGuestIds: ['g-nobody'] })],
      message: 'Only guests on this event guest list can be seated.',
    },
    {
      case: 'declined guest',
      objects: [editorTable({ assignedGuestIds: ['g-dee'] })],
      message: 'Guests who declined cannot be seated.',
    },
    {
      case: 'non-table object',
      objects: [editorTable({ category: 'stage', assignedGuestIds: ['g-ana'] })],
      message: 'Guests can only be seated at visible seating tables.',
    },
    {
      case: 'hidden table',
      objects: [editorTable({ hidden: true, assignedGuestIds: ['g-ana'] })],
      message: 'Hidden tables cannot take guests.',
    },
    {
      case: 'table over capacity',
      objects: [editorTable({ seats: 1, assignedGuestIds: ['g-ana', 'g-ben'] })],
      message: 'This table has no free seats.',
    },
    {
      case: 'guest listed at two tables',
      objects: [
        editorTable({ assignedGuestIds: ['g-ana'] }),
        editorTable({ id: 't2', assignedGuestIds: ['g-ana'] }),
      ],
      message: 'A guest can only be seated at one table.',
    },
  ])('rejects a PMCM save with a $case and writes nothing', async ({ objects, message }) => {
    const { service, prisma, audit } = createService(draft('pmcm_draft'));

    const attempt = service.updatePlan('plan_event_1', changes({ objects, guests: eventGuestRoster }), pmcmActor());

    await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
    await expect(attempt).rejects.toThrow(message);
    expect(prisma.floorPlan.update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it('accepts a save whose seated guests are known, not declined, and within table capacity', async () => {
    const { service, prisma } = createService(draft('pmcm_draft'));
    const objects = [
      editorTable({ assignedGuestIds: ['g-ana', 'g-ben'] }),
      editorTable({ id: 't2', assignedGuestIds: [] }),
    ];

    await expect(
      service.updatePlan('plan_event_1', changes({ objects, guests: eventGuestRoster }), pmcmActor()),
    ).resolves.toMatchObject({ id: 'plan_event_1' });
    expect(prisma.floorPlan.update).toHaveBeenCalled();
  });

  it('keeps saving plans that carry no seat assignment fields, including legacy kernel-shaped objects', async () => {
    const { service, prisma } = createService(draft('pmcm_draft'));
    const legacyObject = {
      id: 'legacy-stage',
      kind: 'stage' as const,
      position: { x: 0, y: 0 },
      size: { width: 4, height: 2 },
      rotation: 0,
      zIndex: 0,
    };

    await expect(
      service.updatePlan(
        'plan_event_1',
        changes({ objects: [editorTable(), legacyObject], guests: eventGuestRoster }),
        pmcmActor(),
      ),
    ).resolves.toMatchObject({ id: 'plan_event_1' });
    expect(prisma.floorPlan.update).toHaveBeenCalled();
  });

  it('checks stored seat assignments when a guest roster save would strand a seated guest', async () => {
    const seated = editorTable({ assignedGuestIds: ['g-ana'] });
    const { service, prisma } = createService(draft('pmcm_draft'), {
      objectRows: [{ objectId: 't1', objectData: seated, zIndex: 0 }],
    });

    await expect(
      service.updatePlan('plan_event_1', { expectedUpdatedAt: planUpdatedAt, guests: [] }, pmcmActor()),
    ).rejects.toThrow('Only guests on this event guest list can be seated.');
    expect(prisma.floorPlan.update).not.toHaveBeenCalled();
  });
});
