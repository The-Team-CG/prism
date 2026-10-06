import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { EventAccessPolicyService, type AuditWriter } from '@prism/kernel/access-control';
import { createFloorPlanDraftSchema, createFloorPlanPreferenceSchema } from '@prism/types';
import type { EventClientFloorplanAccessReader } from '../../../event-lifecycle/contracts/client-floorplan-access.port';
import { FloorPlanWorkflowService } from '../../application/live/floor-plan-workflow.service';
import { OpsEventFloorplansController } from './event-floorplans.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

const verifiedPmcmActor = { id: 'user_pmcm', actorId: 'user_pmcm', role: OpsUserRole.PmcmAdmin, actorRole: OpsUserRole.PmcmAdmin, email: 'mys@pmcm.test', actorEmail: 'mys@pmcm.test', name: 'Maxine', actorName: 'Maxine', expiresAt: '2026-07-03T12:00:00.000Z' };

function createController(options: { clientPortalStatus?: string } = {}) {
  const floorPlanWorkflowService = {
    createFloorPlanDraft: vi.fn(async () => ({ id: 'fpd_new' })),
    createFloorPlanPreference: vi.fn(async () => ({ id: 'fpd_pref' })),
    submitFloorPlanDraft: vi.fn(async () => ({ id: 'fpd_new', status: 'submitted' })),
    approveFloorPlanDraft: vi.fn(async () => ({ id: 'fpd_new', status: 'approved' })),
    getFloorPlanSnapshot: vi.fn(async () => ({ objects: [] })),
    requireEvent: vi.fn(async () => ({
      id: 'evt_sample',
      clientName: 'Ana Reyes',
      clientPortalStatus: options.clientPortalStatus ?? 'unlocked',
      inquiry: { email: 'ana@example.test' },
      supplierQuoteRequests: [{ supplierId: 'supplier_sonia', supplier: { email: 'sonia@example.test' } }],
      coordinatorAssignments: [{
        coordinatorId: 'coordinator_cara',
        coordinator: { userId: 'actor_coordinator', email: 'cara@example.test' },
      }],
    })),
  };
  const eventClientFloorplanAccessReader: EventClientFloorplanAccessReader = {
    hasActiveGrant: vi.fn(async () => false),
    listActiveSharedEvents: vi.fn(async () => []),
  };
  const auditWriter: AuditWriter = { write: vi.fn(async () => undefined) };
  const eventAccessPolicyService = new EventAccessPolicyService(auditWriter);
  vi.spyOn(eventAccessPolicyService, 'requireCanMutateOfficialFloorplan');
  vi.spyOn(eventAccessPolicyService, 'requireActorRole');
  vi.spyOn(eventAccessPolicyService, 'requireCanReadEvent');
  const recordForbiddenAccess = vi.spyOn(eventAccessPolicyService, 'recordForbiddenAccess');
  const controller = new OpsEventFloorplansController(
    floorPlanWorkflowService as unknown as FloorPlanWorkflowService,
    eventAccessPolicyService,
    eventClientFloorplanAccessReader,
  );
  return { controller, floorPlanWorkflowService, eventAccessPolicyService, eventClientFloorplanAccessReader, recordForbiddenAccess };
}

describe('OpsEventFloorplansController', () => {
  it('keeps event floorplan routes under the events route base', () => {
    expect(controllerPath(OpsEventFloorplansController)).toBe('events');
  });

  it('keeps snapshot reads behind the verified event-session guard', () => {
    const guards = Reflect.getMetadata('__guards__', OpsEventFloorplansController.prototype.getFloorPlanSnapshot) as Function[];
    expect(guards).toContain(EventSessionGuard);
  });

  it('does not inject PrismaService into the controller', () => {
    const { controller } = createController();
    expect((controller as unknown as Record<string, unknown>).prisma).toBeUndefined();
  });

  it('serves official floorplan commands through FloorPlanWorkflowService with route policy', async () => {
    const { controller, floorPlanWorkflowService, eventAccessPolicyService } = createController();
    const input = createFloorPlanDraftSchema.parse({ name: 'Official', sourceType: 'blank' });
    await expect(controller.createFloorPlanDraft('evt_sample', input, verifiedPmcmActor as any)).resolves.toEqual({ id: 'fpd_new' });
    await expect(controller.submitFloorPlanDraft('evt_sample', 'fpd_new', verifiedPmcmActor as any)).resolves.toEqual({ id: 'fpd_new', status: 'submitted' });
    await expect(controller.approveFloorPlanDraft('evt_sample', 'fpd_new', verifiedPmcmActor as any)).resolves.toEqual({ id: 'fpd_new', status: 'approved' });

    expect(eventAccessPolicyService.requireCanMutateOfficialFloorplan).toHaveBeenCalledTimes(3);
    expect(floorPlanWorkflowService.createFloorPlanDraft).toHaveBeenCalledWith('evt_sample', { name: 'Official', sourceType: 'blank' }, { actorId: 'user_pmcm', name: 'Maxine', role: OpsUserRole.PmcmAdmin });
    expect(floorPlanWorkflowService.submitFloorPlanDraft).toHaveBeenCalledWith('evt_sample', 'fpd_new', { name: 'Maxine', role: OpsUserRole.PmcmAdmin });
    expect(floorPlanWorkflowService.approveFloorPlanDraft).toHaveBeenCalledWith('evt_sample', 'fpd_new', { name: 'Maxine', role: OpsUserRole.PmcmAdmin });
  });

  it('serves client preferences and snapshots through floorplan ownership', async () => {
    const { controller, floorPlanWorkflowService, eventAccessPolicyService } = createController();
    const actor = {
      id: 'client_ana',
      actorId: 'client_ana',
      role: OpsUserRole.Client,
      actorRole: OpsUserRole.Client,
      email: 'ana@example.test',
      actorEmail: 'ana@example.test',
      name: 'Ana Reyes',
      actorName: 'Ana Reyes',
      clientName: 'Ana Reyes',
      expiresAt: '2026-07-03T12:00:00.000Z',
    };

    const preference = createFloorPlanPreferenceSchema.parse({
      name: 'Client Preference',
      seatingStyle: 'banquet',
      stagePreference: 'front',
      flowNotes: 'Wide aisle',
      guestCount: 120,
      constraints: [],
    });
    await expect(
      controller.createFloorPlanPreference(
        'evt_sample',
        preference,
        actor,
      ),
    ).resolves.toEqual({ id: 'fpd_pref' });
    await expect(controller.getFloorPlanSnapshot('evt_sample', 'fpd_pref', { type: 'submitted' }, actor)).resolves.toEqual({ objects: [] });

    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledWith(
      expect.objectContaining({ role: OpsUserRole.Client, name: 'Ana Reyes', verified: true }),
      [OpsUserRole.Client, OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'client floorplan preference',
      'evt_sample',
    );
    expect(floorPlanWorkflowService.requireEvent).toHaveBeenCalledWith('evt_sample');
    expect(floorPlanWorkflowService.createFloorPlanPreference).toHaveBeenCalledWith(
      'evt_sample',
      expect.objectContaining({ name: 'Client Preference' }),
      { actorId: 'client_ana', name: 'Ana Reyes', role: OpsUserRole.Client },
    );
    expect(floorPlanWorkflowService.getFloorPlanSnapshot).toHaveBeenCalledWith('evt_sample', 'fpd_pref', 'submitted');
  });

  describe('official floorplan snapshot access', () => {
    function actorOfRole(role: (typeof OpsUserRole)[keyof typeof OpsUserRole], name: string) {
      return {
        id: `actor_${role}`,
        actorId: `actor_${role}`,
        role,
        actorRole: role,
        email: `${name.toLowerCase()}@example.test`,
        actorEmail: `${name.toLowerCase()}@example.test`,
        name,
        actorName: name,
        expiresAt: '2026-07-03T12:00:00.000Z',
      } as any;
    }

    it('rejects a supplier asking for the pre-approval submitted snapshot, and audits it', async () => {
      const { controller, floorPlanWorkflowService, eventAccessPolicyService } = createController();

      await expect(
        controller.getFloorPlanSnapshot('evt_sample', 'fpd_x', { type: 'submitted' }, actorOfRole(OpsUserRole.Supplier, 'Sonia')),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(eventAccessPolicyService.recordForbiddenAccess).toHaveBeenCalledWith(
        expect.objectContaining({ role: OpsUserRole.Supplier }),
        'official floorplan submitted snapshot',
        'evt_sample',
      );
      expect(floorPlanWorkflowService.getFloorPlanSnapshot).not.toHaveBeenCalled();
    });

    it('rejects a coordinator asking for the pre-approval submitted snapshot, and audits it', async () => {
      const { controller, floorPlanWorkflowService, eventAccessPolicyService } = createController();

      await expect(
        controller.getFloorPlanSnapshot('evt_sample', 'fpd_x', { type: 'submitted' }, actorOfRole(OpsUserRole.Coordinator, 'Cara')),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(eventAccessPolicyService.recordForbiddenAccess).toHaveBeenCalledWith(
        expect.objectContaining({ role: OpsUserRole.Coordinator }),
        'official floorplan submitted snapshot',
        'evt_sample',
      );
      expect(floorPlanWorkflowService.getFloorPlanSnapshot).not.toHaveBeenCalled();
    });

    it('still serves the submitted snapshot to PMCM', async () => {
      const { controller, floorPlanWorkflowService } = createController();

      await expect(
        controller.getFloorPlanSnapshot('evt_sample', 'fpd_x', { type: 'submitted' }, actorOfRole(OpsUserRole.PmcmAdmin, 'Maxine')),
      ).resolves.toEqual({ objects: [] });

      expect(floorPlanWorkflowService.getFloorPlanSnapshot).toHaveBeenCalledWith('evt_sample', 'fpd_x', 'submitted');
    });

    it('still serves the submitted snapshot to the client, who is invited to review it', async () => {
      const { controller, floorPlanWorkflowService } = createController();

      await expect(
        controller.getFloorPlanSnapshot('evt_sample', 'fpd_x', { type: 'submitted' }, actorOfRole(OpsUserRole.Client, 'Ana')),
      ).resolves.toEqual({ objects: [] });

      expect(floorPlanWorkflowService.getFloorPlanSnapshot).toHaveBeenCalledWith('evt_sample', 'fpd_x', 'submitted');
    });

    it('still serves the submitted snapshot to System', async () => {
      const { controller, floorPlanWorkflowService } = createController();

      await expect(
        controller.getFloorPlanSnapshot('evt_sample', 'fpd_x', { type: 'submitted' }, actorOfRole(OpsUserRole.System, 'System')),
      ).resolves.toEqual({ objects: [] });

      expect(floorPlanWorkflowService.getFloorPlanSnapshot).toHaveBeenCalledWith('evt_sample', 'fpd_x', 'submitted');
    });

    it.each([OpsUserRole.Client, OpsUserRole.PmcmAdmin, OpsUserRole.System])(
      'serves approved snapshots to %s',
      async (role) => {
        const { controller, floorPlanWorkflowService } = createController();
        const name = role === OpsUserRole.Client ? 'Ana' : 'Maxine';

        await expect(
          controller.getFloorPlanSnapshot('evt_sample', 'fpd_x', { type: 'approved' }, actorOfRole(role, name)),
        ).resolves.toEqual({ objects: [] });
        expect(floorPlanWorkflowService.getFloorPlanSnapshot).toHaveBeenCalledWith('evt_sample', 'fpd_x', 'approved');
      },
    );

    it('rejects an event-scoped supplier from approved snapshots and audits the role denial', async () => {
      const { controller, floorPlanWorkflowService, recordForbiddenAccess } = createController();

      await expect(
        controller.getFloorPlanSnapshot('evt_sample', 'fpd_x', { type: 'approved' }, actorOfRole(OpsUserRole.Supplier, 'Sonia')),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(recordForbiddenAccess).toHaveBeenCalledWith(
        expect.objectContaining({ role: OpsUserRole.Supplier }),
        'official floorplan approved snapshot',
        'evt_sample',
      );
      expect(floorPlanWorkflowService.getFloorPlanSnapshot).not.toHaveBeenCalled();
    });

    it.each(['submitted', 'approved'] as const)(
      'allows a secondary Client with an active event grant to read the %s snapshot',
      async (type) => {
        const { controller, floorPlanWorkflowService, eventClientFloorplanAccessReader, recordForbiddenAccess } = createController();
        eventClientFloorplanAccessReader.hasActiveGrant = vi.fn(async () => true);
        const secondary = actorOfRole(OpsUserRole.Client, 'Sally');

        await expect(controller.getFloorPlanSnapshot('evt_sample', 'fpd_shared', { type }, secondary)).resolves.toEqual({ objects: [] });
        expect(eventClientFloorplanAccessReader.hasActiveGrant).toHaveBeenCalledWith('evt_sample', 'actor_client');
        expect(floorPlanWorkflowService.getFloorPlanSnapshot).toHaveBeenCalledWith('evt_sample', 'fpd_shared', type);
        expect(recordForbiddenAccess).not.toHaveBeenCalled();
      },
    );

    it('denies a secondary Client without an active grant before reading the snapshot', async () => {
      const { controller, floorPlanWorkflowService, eventClientFloorplanAccessReader, recordForbiddenAccess } = createController();
      const secondary = actorOfRole(OpsUserRole.Client, 'Sally');

      await expect(controller.getFloorPlanSnapshot('evt_sample', 'fpd_shared', { type: 'approved' }, secondary)).rejects.toBeInstanceOf(ForbiddenException);
      expect(eventClientFloorplanAccessReader.hasActiveGrant).toHaveBeenCalledWith('evt_sample', 'actor_client');
      expect(recordForbiddenAccess).toHaveBeenCalledWith(
        expect.objectContaining({ role: OpsUserRole.Client }),
        'official floorplan snapshot',
        'evt_sample',
      );
      expect(floorPlanWorkflowService.getFloorPlanSnapshot).not.toHaveBeenCalled();
    });

    it('does not use a grant for a locked Client portal', async () => {
      const { controller, floorPlanWorkflowService, eventClientFloorplanAccessReader, recordForbiddenAccess } = createController({
        clientPortalStatus: 'locked',
      });
      eventClientFloorplanAccessReader.hasActiveGrant = vi.fn(async () => false);
      const secondary = actorOfRole(OpsUserRole.Client, 'Sally');

      await expect(controller.getFloorPlanSnapshot('evt_sample', 'fpd_shared', { type: 'approved' }, secondary)).rejects.toBeInstanceOf(ForbiddenException);
      expect(eventClientFloorplanAccessReader.hasActiveGrant).toHaveBeenCalledWith('evt_sample', 'actor_client');
      expect(recordForbiddenAccess).toHaveBeenCalled();
      expect(floorPlanWorkflowService.getFloorPlanSnapshot).not.toHaveBeenCalled();
    });

    it('does not consult a Client grant for non-Client roles', async () => {
      const { controller, floorPlanWorkflowService, eventClientFloorplanAccessReader } = createController();
      eventClientFloorplanAccessReader.hasActiveGrant = vi.fn(async () => true);

      await expect(controller.getFloorPlanSnapshot('evt_sample', 'fpd_x', { type: 'submitted' }, actorOfRole(OpsUserRole.Supplier, 'Sonia'))).rejects.toBeInstanceOf(ForbiddenException);
      expect(eventClientFloorplanAccessReader.hasActiveGrant).not.toHaveBeenCalled();
      expect(floorPlanWorkflowService.getFloorPlanSnapshot).not.toHaveBeenCalled();
    });

    it('denies an unknown actor before the snapshot workflow and audits the denial', async () => {
      const { controller, floorPlanWorkflowService, eventClientFloorplanAccessReader, recordForbiddenAccess } = createController();

      await expect(controller.getFloorPlanSnapshot('evt_sample', 'fpd_x', { type: 'approved' }, actorOfRole(OpsUserRole.Unknown, 'Unknown'))).rejects.toBeInstanceOf(ForbiddenException);
      expect(eventClientFloorplanAccessReader.hasActiveGrant).not.toHaveBeenCalled();
      expect(recordForbiddenAccess).toHaveBeenCalledWith(
        expect.objectContaining({ role: OpsUserRole.Unknown }),
        'official floorplan snapshot',
        'evt_sample',
      );
      expect(floorPlanWorkflowService.getFloorPlanSnapshot).not.toHaveBeenCalled();
    });

    it('allows an active event-assigned coordinator to read only the approved snapshot', async () => {
      const { controller, floorPlanWorkflowService, eventAccessPolicyService } = createController();

      await expect(
        controller.getFloorPlanSnapshot('evt_sample', 'fpd_x', { type: 'approved' }, actorOfRole(OpsUserRole.Coordinator, 'Cara')),
      ).resolves.toEqual({ objects: [] });

      expect(eventAccessPolicyService.requireCanReadEvent).toHaveBeenCalledWith(
        expect.objectContaining({ role: OpsUserRole.Coordinator, eventId: 'evt_sample' }),
        expect.objectContaining({ id: 'evt_sample' }),
        'official floorplan snapshot',
        expect.any(Object),
      );
      expect(floorPlanWorkflowService.getFloorPlanSnapshot).toHaveBeenCalledWith('evt_sample', 'fpd_x', 'approved');
    });

    it('denies an unassigned coordinator from approved snapshots and audits the event-access denial', async () => {
      const { controller, floorPlanWorkflowService, recordForbiddenAccess } = createController();
      const unassignedActor = {
        ...actorOfRole(OpsUserRole.Coordinator, 'Mina'),
        id: 'actor_unassigned',
        actorId: 'actor_unassigned',
      };

      await expect(
        controller.getFloorPlanSnapshot('evt_sample', 'fpd_x', { type: 'approved' }, unassignedActor),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(recordForbiddenAccess).toHaveBeenCalledWith(
        expect.objectContaining({ role: OpsUserRole.Coordinator }),
        'official floorplan snapshot',
        'evt_sample',
      );
      expect(floorPlanWorkflowService.getFloorPlanSnapshot).not.toHaveBeenCalled();
    });

    it.each(['submitted', 'approved'] as const)(
      'denies guests from %s snapshots before the reader and audits the event-access denial',
      async (type) => {
        const { controller, floorPlanWorkflowService, recordForbiddenAccess } = createController();

        await expect(
          controller.getFloorPlanSnapshot('evt_sample', 'fpd_x', { type }, actorOfRole(OpsUserRole.Guest, 'Gigi')),
        ).rejects.toBeInstanceOf(ForbiddenException);

        expect(recordForbiddenAccess).toHaveBeenCalledWith(
          expect.objectContaining({ role: OpsUserRole.Guest }),
          'official floorplan snapshot',
          'evt_sample',
        );
        expect(floorPlanWorkflowService.getFloorPlanSnapshot).not.toHaveBeenCalled();
      },
    );
  });
});
