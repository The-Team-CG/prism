import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/modules/event-core';
import { EventAccessPolicyService } from './event-access-policy.service';

function createPolicy() {
  const audit = vi.fn();
  const policy = new EventAccessPolicyService({ audit } as any);
  return { policy, audit };
}

describe('EventAccessPolicyService', () => {
  it('allows suppliers to read only events explicitly scoped to their supplier assignments', () => {
    const { policy } = createPolicy();
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

  it('allows clients to read only their own unlocked events', () => {
    const { policy } = createPolicy();
    const actor = policy.resolveActor({
      actorRole: OpsUserRole.Client,
      clientName: 'Ana Reyes',
    });

    expect(
      policy.canReadEvent(actor, {
        id: 'evt_visible',
        clientName: 'Ana Reyes',
        clientPortalStatus: 'unlocked',
      }),
    ).toBe(true);

    expect(
      policy.canReadEvent(actor, {
        id: 'evt_locked',
        clientName: 'Ana Reyes',
        clientPortalStatus: 'locked',
      }),
    ).toBe(false);

    expect(
      policy.canReadEvent(actor, {
        id: 'evt_other_client',
        clientName: 'Ramon Cruz',
        clientPortalStatus: 'unlocked',
      }),
    ).toBe(false);
  });

  it('allows coordinators to read only their assigned event scope', () => {
    const { policy } = createPolicy();
    const actor = policy.resolveActor({
      actorRole: OpsUserRole.Coordinator,
      actorName: 'Marco Santos',
      eventId: 'evt_assigned',
    });

    expect(
      policy.canReadEvent(actor, {
        id: 'evt_assigned',
        clientName: 'Ana Reyes',
        clientPortalStatus: 'unlocked',
      }),
    ).toBe(true);

    expect(
      policy.canReadEvent(actor, {
        id: 'evt_other',
        clientName: 'Ana Reyes',
        clientPortalStatus: 'unlocked',
      }),
    ).toBe(false);
  });

  it('denies client official floorplan mutation and writes a forbidden-access audit event', async () => {
    const { policy, audit } = createPolicy();
    const actor = policy.resolveActor({
      actorRole: OpsUserRole.Client,
      clientName: 'Ana Reyes',
      actorEmail: 'ana@ayala.test',
    });

    await expect(
      policy.requireCanMutateOfficialFloorplan(actor, 'evt_visible', 'official floorplan'),
    ).rejects.toThrow('client cannot mutate official floorplans');

    expect(audit).toHaveBeenCalledWith(
      'evt_visible',
      'Ana Reyes',
      '403 forbidden access: official floorplan',
      expect.objectContaining({
        actorRole: OpsUserRole.Client,
        actorEmail: 'ana@ayala.test',
        affectedType: 'scoped_read',
        affectedLabel: 'official floorplan',
        severity: 'warning',
      }),
    );
  });

  it('denies suppliers from internal cost and privacy operation surfaces', async () => {
    const { policy, audit } = createPolicy();
    const actor = policy.resolveActor({
      actorRole: OpsUserRole.Supplier,
      supplierId: 'sup_sonicline',
      actorName: 'Sonic Line Events',
      actorEmail: 'supplier@example.com',
    });

    await expect(policy.requireCanViewInternalCosts(actor, 'evt_visible', 'billing source')).rejects.toThrow(
      'supplier cannot view internal costs',
    );

    await expect(policy.requireCanViewPrivacyOperations(actor, 'privacy operations')).rejects.toThrow(
      'supplier cannot access privacy operations',
    );

    expect(audit).toHaveBeenCalledTimes(2);
    expect(audit).toHaveBeenCalledWith(
      'evt_visible',
      'Sonic Line Events',
      '403 forbidden access: billing source',
      expect.objectContaining({ actorRole: OpsUserRole.Supplier }),
    );
    expect(audit).toHaveBeenCalledWith(
      undefined,
      'Sonic Line Events',
      '403 forbidden access: privacy operations',
      expect.objectContaining({ actorRole: OpsUserRole.Supplier }),
    );
  });
});
