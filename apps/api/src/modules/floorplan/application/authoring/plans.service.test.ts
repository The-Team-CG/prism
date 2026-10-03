import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EventAccessPolicyService, type AuditWriter } from '@prism/kernel/access-control';
import type { PrismaService } from '@prism/kernel/database';
import type { PrismVerifiedEventActor, UpdatePlanInput } from '@prism/types';
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
  const floorPlanObject = { deleteMany, createMany };
  const floorPlan = {
    findUnique: vi.fn().mockResolvedValue({ ...floorPlanRow({ opsDraft }), ...overrides }),
    upsert: vi.fn(),
    update,
  };
  const prisma = {
    floorPlan,
    floorPlanObject,
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({ floorPlan, floorPlanObject }),
    ),
  } as unknown as PrismaService;

  return {
    service: new PlansService(prisma, accessPolicy, audit),
    prisma: { ...prisma, floorPlan, floorPlanObject },
    audit,
    accessPolicy,
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
    const { service, prisma, audit } = createService(draft('client_submitted'));

    await expect(
      service.updatePlan('plan_event_1', changes({ width: 45 }), clientActor('owner@example.test')),
    ).resolves.toMatchObject({ id: 'plan_event_1' });

    expect(prisma.floorPlan.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'plan_event_1', updatedAt: new Date(planUpdatedAt) },
    }));
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

  it('rechecks the event freeze state inside the serializable write transaction', async () => {
    const { service, prisma, audit } = createService(draft('pmcm_draft'));
    prisma.floorPlan.findUnique
      .mockReset()
      .mockResolvedValueOnce(floorPlanRow({ opsDraft: draft('pmcm_draft') }))
      .mockResolvedValueOnce({
        updatedAt: new Date(planUpdatedAt),
        opsDraft: { status: 'pmcm_draft', event: { archived: false, freezeStatus: 'frozen' } },
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
        updatedAt: new Date('2026-05-06T00:00:00.000Z'),
        opsDraft: { status: 'pmcm_draft', event: { archived: false, freezeStatus: 'open' } },
      });

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
});
