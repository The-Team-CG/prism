import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { WalkInPolicyController } from './walk-in-policy.controller';

describe('WalkInPolicyController', () => {
  it('keeps policy writes PMCM-only', async () => {
    const access = {
      resolveActor: vi.fn(() => ({ role: 'client', name: 'Client', explicit: true })),
      requireActorRole: vi.fn(async () => { throw new ForbiddenException('client cannot access walk-in policy update'); }),
    };
    const policy = { update: vi.fn() };
    const eventReferences = { findEventReadAccess: vi.fn() };
    const controller = new WalkInPolicyController(access as any, policy as any, eventReferences as any);
    await expect(controller.update('evt_1', { policy: 'open' }, { actorRole: 'client' } as any)).rejects.toThrow('client cannot access walk-in policy update');
    expect(policy.update).not.toHaveBeenCalled();
  });
});
