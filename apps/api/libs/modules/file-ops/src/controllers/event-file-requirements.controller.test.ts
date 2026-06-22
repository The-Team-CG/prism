import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/modules/event-core';
import { OpsEventFileRequirementsController } from './event-file-requirements.controller';

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
    ],
  };
  const fileRequirementsMatrixService = {
    buildForEvent: vi.fn(async () => matrix),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((input = {}) => ({
      role: input.actorRole ?? OpsUserRole.PmcmAdmin,
      name: input.actorName ?? input.clientName ?? 'PMCM Admin',
      clientName: input.clientName,
    })),
    requireCanReadEvent: vi.fn(async () => undefined),
  };
  const prisma = {
    opsEvent: {
      findUnique: vi.fn(async () => ({ id: 'evt_file', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked' })),
    },
  };
  const controller = new OpsEventFileRequirementsController(
    fileRequirementsMatrixService as any,
    eventAccessPolicyService as any,
    prisma as any,
  );
  return { controller, fileRequirementsMatrixService, eventAccessPolicyService, prisma };
}

describe('OpsEventFileRequirementsController', () => {
  it('keeps event file requirement routes under the events route base', () => {
    expect(controllerPath(OpsEventFileRequirementsController)).toBe('events');
  });

  it('serves PMCM-visible file requirements through FileOps', async () => {
    const { controller, fileRequirementsMatrixService, eventAccessPolicyService, prisma } = createController();

    await expect(controller.fileRequirements('evt_file', { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Maxine' })).resolves.toEqual({
      eventId: 'evt_file',
      items: [
        { key: 'signed_conforme', visibleToRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.Client] },
        { key: 'supplier_reviews', visibleToRoles: [OpsUserRole.PmcmAdmin] },
        { key: 'official_floorplan', visibleToRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.Client, OpsUserRole.Coordinator] },
      ],
    });

    expect(prisma.opsEvent.findUnique).toHaveBeenCalledWith({ where: { id: 'evt_file' } });
    expect(eventAccessPolicyService.requireCanReadEvent).toHaveBeenCalledWith(
      { role: OpsUserRole.PmcmAdmin, name: 'Maxine', clientName: undefined },
      { id: 'evt_file', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked' },
      'file requirements matrix',
    );
    expect(fileRequirementsMatrixService.buildForEvent).toHaveBeenCalledWith('evt_file');
  });

  it('filters file requirements by actor-visible roles', async () => {
    const { controller } = createController();

    await expect(controller.fileRequirements('evt_file', { actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' })).resolves.toEqual({
      eventId: 'evt_file',
      items: [
        { key: 'signed_conforme', visibleToRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.Client] },
        { key: 'official_floorplan', visibleToRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.Client, OpsUserRole.Coordinator] },
      ],
    });
  });

  it('does not build the matrix when the event is missing or access is denied', async () => {
    const { controller, fileRequirementsMatrixService, eventAccessPolicyService, prisma } = createController();
    prisma.opsEvent.findUnique.mockResolvedValueOnce(null);

    await expect(controller.fileRequirements('evt_missing', { actorRole: OpsUserRole.PmcmAdmin })).rejects.toBeInstanceOf(NotFoundException);
    expect(fileRequirementsMatrixService.buildForEvent).not.toHaveBeenCalled();

    prisma.opsEvent.findUnique.mockResolvedValueOnce({ id: 'evt_file', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked' });
    eventAccessPolicyService.requireCanReadEvent.mockRejectedValueOnce(
      new ForbiddenException('guest cannot access file requirements matrix'),
    );

    await expect(controller.fileRequirements('evt_file', { actorRole: OpsUserRole.Guest })).rejects.toBeInstanceOf(ForbiddenException);
    expect(fileRequirementsMatrixService.buildForEvent).not.toHaveBeenCalled();
  });
});
