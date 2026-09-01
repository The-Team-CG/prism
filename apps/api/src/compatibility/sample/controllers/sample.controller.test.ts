import { describe, expect, it, vi } from 'vitest';
import { SampleController } from './sample.controller';

describe('SampleController', () => {
  it('requires a privileged verified actor before resetting sample data', async () => {
    const sampleCompatibilityService = { resetSample: vi.fn(async () => ({ users: [] })) };
    const eventAccessPolicyService = {
      resolveActor: vi.fn(() => ({ role: 'pmcm-admin', name: 'Ms. Mys', explicit: true })),
      requireActorRole: vi.fn(async () => undefined),
    };
    const controller = new SampleController(sampleCompatibilityService as any, eventAccessPolicyService as any);
    const verifiedActor = { actorRole: 'pmcm-admin', actorName: 'Ms. Mys' };

    await expect(controller.reset(verifiedActor as any)).resolves.toEqual({ users: [] });
    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'pmcm-admin' }),
      ['pmcm-admin', 'system'],
      'sample reset',
    );
    expect(sampleCompatibilityService.resetSample).toHaveBeenCalledOnce();
  });
});
