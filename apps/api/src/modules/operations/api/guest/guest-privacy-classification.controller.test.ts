import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { GuestPrivacyClassificationController } from './guest-privacy-classification.controller';

describe('GuestPrivacyClassificationController', () => {
  it.each(['client', 'coordinator', 'supplier'])(
    'denies %s access to privacy classification reads and writes',
    async (role) => {
      const access = {
        resolveActor: vi.fn((_query: unknown, verified: { actorRole: string }) => ({
          role: verified.actorRole,
          name: role,
        })),
        requireActorRole: vi.fn(async (actor: { role: string }, allowed: string[]) => {
          if (!allowed.includes(actor.role)) {
            throw new ForbiddenException('guest privacy classification is PMCM-only');
          }
        }),
      };
      const privacy = {
        get: vi.fn(),
        update: vi.fn(),
      };
      const controller = new GuestPrivacyClassificationController(access as never, privacy as never);
      const actor = { actorRole: role } as never;

      await expect(controller.get('evt_1', actor)).rejects.toThrow('PMCM-only');
      await expect(controller.update('evt_1', { classification: 'private' }, actor)).rejects.toThrow('PMCM-only');
      expect(privacy.get).not.toHaveBeenCalled();
      expect(privacy.update).not.toHaveBeenCalled();
    },
  );
});
