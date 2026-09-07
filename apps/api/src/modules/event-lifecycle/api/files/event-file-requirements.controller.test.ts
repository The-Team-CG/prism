import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { OpsEventFileRequirementsController } from './event-file-requirements.controller';
import { EventSessionGuard } from '@prism/kernel/event-session';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function createController() {
  const matrix = {
    eventId: 'evt_file',
    items: [
      { key: 'signed_conforme', visibleToRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.Client] },
      { key: 'supplier_reviews', visibleToRoles: [OpsUserRole.PmcmAdmin] },
      { key: 'official_floorplan', visibleToRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.Client, OpsUserRole.Coordinator] },
      { key: 'supplier_contract', visibleToRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.Supplier] },
    ],
  };
  const fileRequirementsMatrixService = {
    buildForEvent: vi.fn(async () => matrix),
    requireEvent: vi.fn(async () => ({
      id: 'evt_file', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked',
      inquiry: { email: 'ana@pmcm.test' },
      supplierQuoteRequests: [{ supplierId: 'supplier_1', supplier: { email: 'sonic.line@pmcm.test' } }],
      coordinatorAssignments: [{ coordinatorId: 'coord_marco', coordinator: { userId: 'usr-Marco', email: 'marco@pmcm.test' } }],
    })),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((_input = {}, verifiedActor?: { actorId?: string; actorRole?: string; actorName?: string; actorEmail?: string }) => ({
      role: verifiedActor?.actorRole ?? OpsUserRole.PmcmAdmin,
      id: verifiedActor?.actorId,
      name: verifiedActor?.actorName ?? 'PMCM Admin',
      email: verifiedActor?.actorEmail,
      clientName: verifiedActor?.actorRole === OpsUserRole.Client ? verifiedActor.actorName : undefined,
    })),
    requireCanReadEvent: vi.fn(async () => undefined),
  };
  const controller = new OpsEventFileRequirementsController(
    fileRequirementsMatrixService as any,
    eventAccessPolicyService as any,
  );
  return { controller, fileRequirementsMatrixService, eventAccessPolicyService };
}

const verified = (role: OpsUserRole, name: string, email = `${name.toLowerCase().replaceAll(' ', '.')}@pmcm.test`) => ({
  id: `usr-${name}`,
  role,
  email,
  name,
  actorId: `usr-${name}`,
  actorRole: role,
  actorEmail: email,
  actorName: name,
  expiresAt: '2030-01-01T00:00:00.000Z',
});

describe('OpsEventFileRequirementsController', () => {
  it('requires a verified event session for file requirement reads', () => {
    expect(Reflect.getMetadata('__guards__', OpsEventFileRequirementsController.prototype.fileRequirements)).toContain(EventSessionGuard);
  });
  it('keeps event file requirement routes under the events route base', () => {
    expect(controllerPath(OpsEventFileRequirementsController)).toBe('events');
  });

  it('does not inject PrismaService into the controller', () => {
    const { controller } = createController();
    expect((controller as unknown as Record<string, unknown>).prisma).toBeUndefined();
  });

  it('serves PMCM-visible file requirements through FileOps', async () => {
    const { controller, fileRequirementsMatrixService, eventAccessPolicyService } = createController();

    await expect(controller.fileRequirements('evt_file', verified(OpsUserRole.PmcmAdmin, 'Maxine'))).resolves.toEqual({
      eventId: 'evt_file',
      items: [
        { key: 'signed_conforme', visibleToRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.Client] },
        { key: 'supplier_reviews', visibleToRoles: [OpsUserRole.PmcmAdmin] },
        { key: 'official_floorplan', visibleToRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.Client, OpsUserRole.Coordinator] },
        { key: 'supplier_contract', visibleToRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.Supplier] },
      ],
    });

    expect(fileRequirementsMatrixService.requireEvent).toHaveBeenCalledWith('evt_file');
    expect(eventAccessPolicyService.requireCanReadEvent).toHaveBeenCalledWith(
      expect.objectContaining({ role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'maxine@pmcm.test', clientName: undefined }),
      expect.objectContaining({ id: 'evt_file', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked' }),
      'file requirements matrix',
      { supplierEventIds: [] },
    );
    expect(fileRequirementsMatrixService.buildForEvent).toHaveBeenCalledWith('evt_file');
  });

  it('filters file requirements by actor-visible roles', async () => {
    const { controller } = createController();

    await expect(controller.fileRequirements('evt_file', verified(OpsUserRole.Client, 'Ana Reyes', 'ana@pmcm.test'))).resolves.toEqual({
      eventId: 'evt_file',
      items: [
        { key: 'signed_conforme', visibleToRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.Client] },
        { key: 'official_floorplan', visibleToRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.Client, OpsUserRole.Coordinator] },
      ],
    });
  });

  it('binds coordinator reads to an active event assignment', async () => {
    const { controller, eventAccessPolicyService } = createController();
    const actor = verified(OpsUserRole.Coordinator, 'Marco');
    await controller.fileRequirements('evt_file', actor);
    expect(eventAccessPolicyService.requireCanReadEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt_file' }), expect.anything(), 'file requirements matrix', { supplierEventIds: [] },
    );
  });

  it('passes supplier ownership scope from the event quote relationship', async () => {
    const { controller, eventAccessPolicyService } = createController();
    await controller.fileRequirements('evt_file', verified(OpsUserRole.Supplier, 'Sonic', 'sonic.line@pmcm.test'));
    expect(eventAccessPolicyService.requireCanReadEvent).toHaveBeenCalledWith(
      expect.objectContaining({ role: OpsUserRole.Supplier }), expect.anything(), 'file requirements matrix', { supplierEventIds: ['evt_file'] },
    );
  });

  it('does not expose client-only file requirements to suppliers', async () => {
    const { controller } = createController();

    await expect(
      controller.fileRequirements('evt_file', verified(OpsUserRole.Supplier, 'Sonic Line Events')),
    ).resolves.toEqual({
      eventId: 'evt_file',
      items: [{ key: 'supplier_contract', visibleToRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.Supplier] }],
    });
  });

  it('does not build the matrix when the event is missing or access is denied', async () => {
    const { controller, fileRequirementsMatrixService, eventAccessPolicyService } = createController();
    fileRequirementsMatrixService.requireEvent.mockRejectedValueOnce(new NotFoundException('Event not found'));

    await expect(controller.fileRequirements('evt_missing', verified(OpsUserRole.PmcmAdmin, 'Maxine'))).rejects.toBeInstanceOf(NotFoundException);
    expect(fileRequirementsMatrixService.buildForEvent).not.toHaveBeenCalled();

    eventAccessPolicyService.requireCanReadEvent.mockRejectedValueOnce(
      new ForbiddenException('guest cannot access file requirements matrix'),
    );

    await expect(controller.fileRequirements('evt_file', verified(OpsUserRole.Guest, 'Guest'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(fileRequirementsMatrixService.buildForEvent).not.toHaveBeenCalled();
  });
});
