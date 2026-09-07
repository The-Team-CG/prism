import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { OpsUserRole } from '@prism/kernel/event-core';
import { createRegistrationPlatformSchema, importHeadcountSchema } from '@prism/types';
import { OpsRegistrationPlatformController } from './registration-platform.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

const verifiedPmcmActor = {
  id: 'user_pmcm',
  actorId: 'user_pmcm',
  role: OpsUserRole.PmcmAdmin,
  actorRole: OpsUserRole.PmcmAdmin,
  email: 'mys@pmcm.test',
  actorEmail: 'mys@pmcm.test',
  name: 'Maxine',
  actorName: 'Maxine',
  expiresAt: '2026-07-03T12:00:00.000Z',
};

const mappedPlatform = { id: 'reg_1', eventId: 'evt_sample', platformType: 'xperto', status: 'not_started' };

function createController() {
  const registrationPlatformService = {
    getByEventId: vi.fn(async () => ({ id: 'reg_1' })),
    upsert: vi.fn(async () => ({ id: 'reg_1' })),
    update: vi.fn(async () => ({ id: 'reg_1' })),
    importHeadcount: vi.fn(async () => ({ id: 'reg_1' })),
    mapRegistrationPlatform: vi.fn(() => mappedPlatform),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((_input: unknown, verified?: { actorRole: string; actorName: string }) => ({
      role: verified?.actorRole ?? OpsUserRole.PmcmAdmin,
      name: verified?.actorName ?? 'Maxine',
    })),
    requireActorRole: vi.fn(async () => undefined),
  };
  const controller = new OpsRegistrationPlatformController(
    eventAccessPolicyService as any,
    registrationPlatformService as any,
  );
  return { controller, registrationPlatformService, eventAccessPolicyService };
}

describe('OpsRegistrationPlatformController', () => {
  it('keeps registration platform routes under the events route base', () => {
    expect(controllerPath(OpsRegistrationPlatformController)).toBe('events/:eventId/registration-platform');
  });

  it.each([
    ['get', OpsRegistrationPlatformController.prototype.get],
    ['upsert', OpsRegistrationPlatformController.prototype.upsert],
    ['update', OpsRegistrationPlatformController.prototype.update],
    ['importHeadcount', OpsRegistrationPlatformController.prototype.importHeadcount],
  ])('requires a verified session actor for %s', (_name, handler) => {
    const guards = Reflect.getMetadata('__guards__', handler);
    expect(guards).toContain(EventSessionGuard);
  });

  it('serves registration commands through RegistrationPlatformService with PMCM policy', async () => {
    const { controller, registrationPlatformService, eventAccessPolicyService } = createController();
    const createInput = createRegistrationPlatformSchema.parse({ platformType: 'xperto', expectedPaxMin: 200 });
    const importInput = importHeadcountSchema.parse({ headcountSource: 'XPERTO', importedHeadcount: 180 });

    await expect(controller.get('evt_sample', verifiedPmcmActor as any)).resolves.toEqual(mappedPlatform);
    await expect(controller.upsert('evt_sample', createInput, verifiedPmcmActor as any)).resolves.toEqual(mappedPlatform);
    await expect(
      controller.update('evt_sample', { status: 'live' }, verifiedPmcmActor as any),
    ).resolves.toEqual(mappedPlatform);
    await expect(controller.importHeadcount('evt_sample', importInput, verifiedPmcmActor as any)).resolves.toEqual(
      mappedPlatform,
    );

    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledTimes(4);
    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledWith(
      { role: OpsUserRole.PmcmAdmin, name: 'Maxine' },
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'registration platform',
      'evt_sample',
    );
    expect(registrationPlatformService.upsert).toHaveBeenCalledWith(
      'evt_sample',
      createInput,
      { role: OpsUserRole.PmcmAdmin, name: 'Maxine' },
    );
  });

  it('blocks non-PMCM actors before invoking registration commands', async () => {
    const { controller, registrationPlatformService, eventAccessPolicyService } = createController();
    eventAccessPolicyService.requireActorRole.mockRejectedValueOnce(
      new ForbiddenException('client cannot access registration platform'),
    );
    const createInput = createRegistrationPlatformSchema.parse({ platformType: 'xperto' });

    await expect(
      controller.upsert('evt_sample', createInput, {
        ...verifiedPmcmActor,
        actorRole: OpsUserRole.Client,
        actorName: 'Ana Reyes',
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(registrationPlatformService.upsert).not.toHaveBeenCalled();
  });
});
