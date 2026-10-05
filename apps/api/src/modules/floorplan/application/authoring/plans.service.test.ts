import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventAccessPolicyService, type AuditWriter } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { describe, expect, it, vi } from 'vitest';
import { PlansService } from './plans.service';

const primaryClient = {
  id: 'client_ana',
  role: OpsUserRole.Client,
  email: 'ana@example.test',
  name: 'Ana Reyes',
  clientName: 'Ana Reyes',
  explicit: true,
  verified: true,
};

function floorPlanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan_event_1',
    name: 'Client editable plan',
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
    updatedAt: new Date('2026-05-05T00:00:00.000Z'),
    ...overrides,
  };
}

function draft({
  status = 'in_review',
  sourceType = 'blank',
  clientName = 'Ana Reyes',
  inquiryEmail = 'ana@example.test',
  clientPortalStatus = 'unlocked',
}: {
  status?: string;
  sourceType?: string;
  clientName?: string;
  inquiryEmail?: string;
  clientPortalStatus?: string;
} = {}) {
  return {
    id: 'draft_1',
    status,
    sourceType,
    createdByRole: sourceType === 'client_preference' ? 'client' : 'pmcm-admin',
    event: {
      id: 'evt_1',
      clientName,
      clientPortalStatus,
      inquiry: { email: inquiryEmail },
    },
  };
}

function createService(opsDraft: unknown) {
  const prisma: any = {};
  const update = vi.fn().mockResolvedValue(floorPlanRow());
  const auditWriter: AuditWriter = { write: vi.fn().mockResolvedValue(undefined) };
  const eventAccessPolicyService = new EventAccessPolicyService(auditWriter);

  prisma.floorPlanObject = {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  prisma.floorPlan = {
    findUnique: vi.fn().mockResolvedValue({ ...floorPlanRow(), opsDraft }),
    upsert: vi.fn().mockResolvedValue(floorPlanRow()),
    update,
  };
  prisma.$transaction = vi.fn(async (callback) =>
    callback({
      floorPlan: prisma.floorPlan,
      floorPlanObject: prisma.floorPlanObject,
    }),
  );

  return { service: new PlansService(prisma, eventAccessPolicyService), prisma, auditWriter };
}

describe('PlansService client floorplan permissions', () => {
  it('does not create a fallback floorplan when a plan id is missing', async () => {
    const { service, prisma } = createService(null);
    prisma.floorPlan.findUnique.mockResolvedValue(null);

    await expect(service.getPlan('missing_plan', primaryClient)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.floorPlan.upsert).not.toHaveBeenCalled();
  });

  it('allows the verified primary client to read their unlocked client preference', async () => {
    const { service } = createService(draft({ status: 'client_submitted', sourceType: 'client_preference' }));

    await expect(service.getPlan('plan_event_1', primaryClient)).resolves.toMatchObject({ id: 'plan_event_1' });
  });

  it('allows the verified primary client to update their unlocked client preference', async () => {
    const { service, prisma } = createService(draft({ status: 'client_submitted', sourceType: 'client_preference' }));

    await expect(service.updatePlan('plan_event_1', { objects: [] }, primaryClient)).resolves.toMatchObject({ id: 'plan_event_1' });
    expect(prisma.floorPlan.update).toHaveBeenCalled();
  });

  it.each(['pmcm_draft', 'in_review', 'revision_requested', 'approved'])(
    'blocks the client from reading an official %s plan',
    async (status) => {
      const { service } = createService(draft({ status, sourceType: 'blank' }));

      await expect(service.getPlan('plan_event_1', primaryClient)).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it.each(['pmcm_draft', 'in_review', 'revision_requested', 'approved'])(
    'blocks the client from updating an official %s plan',
    async (status) => {
      const { service, prisma } = createService(draft({ status, sourceType: 'blank' }));

      await expect(service.updatePlan('plan_event_1', { objects: [] }, primaryClient)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.floorPlan.update).not.toHaveBeenCalled();
    },
  );

  it('blocks a same-name client whose verified email does not match the event inquiry', async () => {
    const { service, auditWriter } = createService(draft({ sourceType: 'client_preference' }));

    await expect(
      service.getPlan('plan_event_1', { ...primaryClient, email: 'imposter@example.test' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(auditWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({ actorEmail: 'imposter@example.test', eventId: 'evt_1' }),
    );
  });

  it('requires verified client identity even when supplied email and name match', async () => {
    const { service, auditWriter } = createService(draft({ sourceType: 'client_preference' }));

    await expect(
      service.getPlan('plan_event_1', { ...primaryClient, verified: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(auditWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({ actorEmail: 'ana@example.test', eventId: 'evt_1' }),
    );
  });

  it.each([OpsUserRole.Supplier, OpsUserRole.Coordinator, OpsUserRole.Guest])(
    'blocks %s from reading a client preference',
    async (role) => {
      const { service } = createService(draft({ sourceType: 'client_preference' }));

      await expect(
        service.getPlan('plan_event_1', { ...primaryClient, role, email: 'other@example.test' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it.each([OpsUserRole.PmcmAdmin, OpsUserRole.System])(
    'preserves %s access to official plan reads and writes',
    async (role) => {
      const { service, prisma } = createService(draft({ status: 'approved', sourceType: 'blank' }));
      const actor = { role, name: 'PMCM actor', explicit: true, verified: true };

      await expect(service.getPlan('plan_event_1', actor)).resolves.toMatchObject({ id: 'plan_event_1' });
      await expect(service.updatePlan('plan_event_1', { objects: [] }, actor)).resolves.toMatchObject({ id: 'plan_event_1' });
      expect(prisma.floorPlan.update).toHaveBeenCalled();
    },
  );
});
