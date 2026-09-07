import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService } from './event-access-policy.service';

function createPolicy() {
  const write = vi.fn();
  const policy = new EventAccessPolicyService({ write } as any);
  return { policy, write };
}

describe('EventAccessPolicyService', () => {
  it('fails closed when no actor role is supplied', async () => {
    const { policy } = createPolicy();
    const actor = policy.resolveActor({});

    expect(actor).toMatchObject({ role: OpsUserRole.Unknown, explicit: false });
    await expect(policy.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'PMCM command inbox')).rejects.toThrow(
      'unknown cannot access PMCM command inbox',
    );
  });

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

  it('uses verified client email rather than a duplicate display name for ownership', () => {
    const { policy } = createPolicy();
    const actor = policy.resolveVerifiedActor({ id: 'u1', actorId: 'u1', role: 'client', actorRole: 'client', email: 'one@test', actorEmail: 'one@test', name: 'Same Name', actorName: 'Same Name', expiresAt: '2099-01-01' });
    expect(policy.canReadEvent(actor, { id: 'evt_1', clientName: 'Same Name', clientPortalStatus: 'unlocked', inquiry: { email: 'one@test' } })).toBe(true);
    expect(policy.canReadEvent(actor, { id: 'evt_2', clientName: 'Same Name', clientPortalStatus: 'unlocked', inquiry: { email: 'two@test' } })).toBe(false);
  });

  it('fails closed for a verified client without an email identity', () => {
    const { policy } = createPolicy();
    const actor = policy.resolveVerifiedActor({ id: 'u1', actorId: 'u1', role: 'client', actorRole: 'client', email: '', actorEmail: '', name: 'Same Name', actorName: 'Same Name', expiresAt: '2099-01-01' });
    expect(policy.canReadEvent(actor, { id: 'evt_1', clientName: 'Same Name', clientPortalStatus: 'unlocked', inquiry: { email: 'one@test' } })).toBe(false);
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
    const { policy, write } = createPolicy();
    const actor = policy.resolveActor({
      actorRole: OpsUserRole.Client,
      clientName: 'Ana Reyes',
      actorEmail: 'ana@ayala.test',
    });

    await expect(
      policy.requireCanMutateOfficialFloorplan(actor, 'evt_visible', 'official floorplan'),
    ).rejects.toThrow('client cannot mutate official floorplans');

    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_visible',
        actor: 'Ana Reyes',
        action: '403 forbidden access: official floorplan',
        actorRole: OpsUserRole.Client,
        actorEmail: 'ana@ayala.test',
        affectedType: 'scoped_read',
        affectedLabel: 'official floorplan',
        severity: 'warning',
      }),
    );
  });

  it('denies suppliers from internal cost and privacy operation surfaces', async () => {
    const { policy, write } = createPolicy();
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

    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_visible',
        actor: 'Sonic Line Events',
        action: '403 forbidden access: billing source',
        actorRole: OpsUserRole.Supplier,
      }),
    );
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'Sonic Line Events',
        action: '403 forbidden access: privacy operations',
        actorRole: OpsUserRole.Supplier,
      }),
    );
  });

  it('keeps the kernel access policy behind a focused audit writer seam', () => {
    const serviceSource = readFileSync(join(__dirname, 'event-access-policy.service.ts'), 'utf8');
    const moduleSource = readFileSync(join(__dirname, '..', 'access-control.module.ts'), 'utf8');

    expect(serviceSource).toContain('@Inject(AUDIT_WRITER)');
    expect(serviceSource).not.toContain('PlatformOps');
    expect(moduleSource).not.toContain('PlatformOpsModule');
  });

  it('prefers a verified session actor over client-supplied actor fields', () => {
    const { policy } = createPolicy();
    const actor = policy.resolveActor(
      { actorRole: 'pmcm-admin', actorName: 'Spoofed Admin' },
      {
        id: 'user_coord',
        actorId: 'user_coord',
        role: 'coordinator',
        actorRole: 'coordinator',
        email: 'marco@pmcm.test',
        actorEmail: 'marco@pmcm.test',
        name: 'Marco',
        actorName: 'Marco',
        expiresAt: '2026-07-03T12:00:00.000Z',
      },
    );

    expect(actor).toMatchObject({
      id: 'user_coord',
      role: 'coordinator',
      email: 'marco@pmcm.test',
      name: 'Marco',
      explicit: true,
    });
  });
});
