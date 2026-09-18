import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { createFloorPlanDraftSchema, createFloorPlanPreferenceSchema } from '@prism/types';
import { OpsEventFloorplansController } from './event-floorplans.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

const verifiedPmcmActor = { id: 'user_pmcm', actorId: 'user_pmcm', role: OpsUserRole.PmcmAdmin, actorRole: OpsUserRole.PmcmAdmin, email: 'mys@pmcm.test', actorEmail: 'mys@pmcm.test', name: 'Maxine', actorName: 'Maxine', expiresAt: '2026-07-03T12:00:00.000Z' };

function createController() {
  const floorPlanWorkflowService = {
    createFloorPlanDraft: vi.fn(async () => ({ id: 'fpd_new' })),
    createFloorPlanPreference: vi.fn(async () => ({ id: 'fpd_pref' })),
    submitFloorPlanDraft: vi.fn(async () => ({ id: 'fpd_new', status: 'submitted' })),
    approveFloorPlanDraft: vi.fn(async () => ({ id: 'fpd_new', status: 'approved' })),
    getFloorPlanSnapshot: vi.fn(async () => ({ objects: [] })),
    requireEvent: vi.fn(async () => ({ id: 'evt_sample', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked' })),
  };
  const recordForbiddenAccess = vi.fn(async (_actor: any, _resource: string, _eventId?: string) => undefined);
  const eventAccessPolicyService = {
    resolveActor: vi.fn((input: any = {}, verified?: any) => ({ role: verified?.actorRole ?? input.actorRole ?? OpsUserRole.PmcmAdmin, name: verified?.actorName ?? input.actorName ?? 'Maxine' })),
    requireCanMutateOfficialFloorplan: vi.fn(async () => undefined),
    // Mirrors the real EventAccessPolicyService.requireActorRole: denies AND audits. The stub used
    // to resolve unconditionally, which would let a role-gate regression pass unnoticed.
    requireActorRole: vi.fn(async (actor: any, allowedRoles: any[], resource: string, eventId?: string) => {
      if (allowedRoles.includes(actor.role)) return;
      await recordForbiddenAccess(actor, resource, eventId);
      throw new ForbiddenException(`${actor.role} cannot access ${resource}`);
    }),
    canReadEvent: vi.fn(() => true),
    requireCanReadEvent: vi.fn(async () => undefined),
    recordForbiddenAccess,
  };
  const controller = new OpsEventFloorplansController(
    floorPlanWorkflowService as any,
    eventAccessPolicyService as any,
  );
  return { controller, floorPlanWorkflowService, eventAccessPolicyService };
}

describe('OpsEventFloorplansController', () => {
  it('keeps event floorplan routes under the events route base', () => {
    expect(controllerPath(OpsEventFloorplansController)).toBe('events');
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
    expect(floorPlanWorkflowService.createFloorPlanDraft).toHaveBeenCalledWith('evt_sample', { name: 'Official', sourceType: 'blank' }, { name: 'Maxine', role: OpsUserRole.PmcmAdmin });
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
      { role: OpsUserRole.Client, name: 'Ana Reyes' },
      [OpsUserRole.Client, OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'client floorplan preference',
      'evt_sample',
    );
    expect(floorPlanWorkflowService.requireEvent).toHaveBeenCalledWith('evt_sample');
    expect(floorPlanWorkflowService.createFloorPlanPreference).toHaveBeenCalledWith(
      'evt_sample',
      expect.objectContaining({ name: 'Client Preference' }),
      { name: 'Ana Reyes', role: OpsUserRole.Client },
    );
    expect(floorPlanWorkflowService.getFloorPlanSnapshot).toHaveBeenCalledWith('evt_sample', 'fpd_pref', 'submitted');
  });

  describe('official floorplan submitted snapshot access (EP-05-S01 AC5)', () => {
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

    it('leaves approved-snapshot reads untouched for a non-PMCM, non-client actor', async () => {
      const { controller, floorPlanWorkflowService, eventAccessPolicyService } = createController();

      await expect(
        controller.getFloorPlanSnapshot('evt_sample', 'fpd_x', { type: 'approved' }, actorOfRole(OpsUserRole.Supplier, 'Sonia')),
      ).resolves.toEqual({ objects: [] });

      expect(floorPlanWorkflowService.getFloorPlanSnapshot).toHaveBeenCalledWith('evt_sample', 'fpd_x', 'approved');
      expect(eventAccessPolicyService.recordForbiddenAccess).not.toHaveBeenCalled();
    });
  });
});
