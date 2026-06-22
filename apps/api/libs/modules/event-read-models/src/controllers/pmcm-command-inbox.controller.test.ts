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
      resolveActor: vi.fn((input) => ({ role: input.actorRole, name: input.actorName ?? input.actorRole })),
    };
    const controller = new OpsPmcmCommandInboxController(
      eventReadModelsService as any,
      eventAccessPolicyService as any,
    );

    await expect(controller.commandInbox({ actorRole: 'pmcm-admin', actorName: 'Maxine' })).resolves.toEqual({
      items: [{ id: 'inquiry:inq_sample' }],
    });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({
      actorRole: 'pmcm-admin',
      actorName: 'Maxine',
    });
    expect(eventReadModelsService.pmcmCommandInbox).toHaveBeenCalledWith({ role: 'pmcm-admin', name: 'Maxine' });
  });
});
