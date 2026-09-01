import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
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
      { key: 'supplier_contract', visibleToRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.Supplier] },
    ],
  };
  const fileRequirementsMatrixService = {
    buildForEvent: vi.fn(async () => matrix),
    requireEvent: vi.fn(async () => ({ id: 'evt_file', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked' })),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((input = {}) => ({
      role: input.actorRole ?? OpsUserRole.PmcmAdmin,
      name: input.actorName ?? input.clientName ?? 'PMCM Admin',
      clientName: input.clientName,
    })),
    requireCanReadEvent: vi.fn(async () => undefined),
  };
  const controller = new OpsEventFileRequirementsController(
    fileRequirementsMatrixService as any,
    eventAccessPolicyService as any,
  );
  return { controller, fileRequirementsMatrixService, eventAccessPolicyService };
}

describe('OpsEventFileRequirementsController', () => {
  it('keeps event file requirement routes under the events route base', () => {
    expect(controllerPath(OpsEventFileRequirementsController)).toBe('events');
  });

  it('does not inject PrismaService into the controller', () => {
    const { controller } = createController();
    expect((controller as unknown as Record<string, unknown>).prisma).toBeUndefined();
  });

  it('serves PMCM-visible file requirements through FileOps', async () => {
    const { controller, fileRequirementsMatrixService, eventAccessPolicyService } = createController();

    await expect(controller.fileRequirements('evt_file', { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Maxine' })).resolves.toEqual({
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

  it('does not expose client-only file requirements to suppliers', async () => {
    const { controller } = createController();

    await expect(
      controller.fileRequirements('evt_file', { actorRole: OpsUserRole.Supplier, actorName: 'Sonic Line Events' }),
    ).resolves.toEqual({
      eventId: 'evt_file',
      items: [{ key: 'supplier_contract', visibleToRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.Supplier] }],
    });
  });

  it('does not build the matrix when the event is missing or access is denied', async () => {
    const { controller, fileRequirementsMatrixService, eventAccessPolicyService } = createController();
    fileRequirementsMatrixService.requireEvent.mockRejectedValueOnce(new NotFoundException('Event not found'));

    await expect(controller.fileRequirements('evt_missing', { actorRole: OpsUserRole.PmcmAdmin })).rejects.toBeInstanceOf(NotFoundException);
    expect(fileRequirementsMatrixService.buildForEvent).not.toHaveBeenCalled();

    eventAccessPolicyService.requireCanReadEvent.mockRejectedValueOnce(
      new ForbiddenException('guest cannot access file requirements matrix'),
    );

    await expect(controller.fileRequirements('evt_file', { actorRole: OpsUserRole.Guest })).rejects.toBeInstanceOf(ForbiddenException);
    expect(fileRequirementsMatrixService.buildForEvent).not.toHaveBeenCalled();
  });
});
