import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsPmcmCommandInboxController } from './pmcm-command-inbox.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsPmcmCommandInboxController', () => {
  it('keeps the public PMCM route base stable under event-read-models ownership', () => {
    expect(controllerPath(OpsPmcmCommandInboxController)).toBe('pmcm');
  });

  it('serves command inbox reads through EventReadModelsService', async () => {
    const eventReadModelsService = {
      pmcmCommandInbox: vi.fn(async () => ({ items: [{ id: 'inquiry:inq_sample' }] })),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn((_input: any, verified: any) => ({ role: verified.actorRole, name: verified.actorName })),
    };
    const controller = new OpsPmcmCommandInboxController(
      eventReadModelsService as any,
      eventAccessPolicyService as any,
    );
    const verifiedActor = {
      id: 'user_pmcm',
      actorId: 'user_pmcm',
      role: 'pmcm-admin',
      actorRole: 'pmcm-admin',
      email: 'mys@pmcm.test',
      actorEmail: 'mys@pmcm.test',
      name: 'Maxine',
      actorName: 'Maxine',
      expiresAt: '2026-07-03T12:00:00.000Z',
    };

    await expect(controller.commandInbox(verifiedActor as any)).resolves.toEqual({
      items: [{ id: 'inquiry:inq_sample' }],
    });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(eventReadModelsService.pmcmCommandInbox).toHaveBeenCalledWith({ role: 'pmcm-admin', name: 'Maxine' });
  });
});
