import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '../ops.constants';
import { EventAccessPolicyService } from './event-access-policy.service';

function createPolicy() {
  return new EventAccessPolicyService({ audit: vi.fn() } as any);
}

describe('EventAccessPolicyService', () => {
  it('allows suppliers to read only events explicitly scoped to their supplier assignments', () => {
    const policy = createPolicy();
    const actor = policy.resolveActor({
      actorRole: OpsUserRole.Supplier,
      supplierId: 'sup_sonicline',
      actorName: 'Sonic Line Events',
    });

    expect(
      policy.canReadEvent(
        actor,
        { id: 'evt_visible', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked' },
        { supplierEventIds: ['evt_visible'] },
      ),
    ).toBe(true);
    expect(
      policy.canReadEvent(
        actor,
        { id: 'evt_hidden', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked' },
        { supplierEventIds: ['evt_visible'] },
      ),
    ).toBe(false);
  });
});
