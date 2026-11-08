import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { WalkInPolicyController } from './walk-in-policy.controller';

function fixture(role: string, eventDate: Date, options: { ownsEvent?: boolean } = {}) {
  const access = {
    resolveActor: vi.fn(() => ({ role, name: 'Actor', explicit: true })),
    requireActorRole: vi.fn(async (actor: { role: string }, roles: string[]) => {
      if (!roles.includes(actor.role)) throw new ForbiddenException(`${actor.role} cannot access walk-in policy update`);
    }),
    requireCanReadEvent: vi.fn(async () => {
      if (options.ownsEvent === false) throw new ForbiddenException('not your event');
    }),
  };
  const policy = { update: vi.fn(async () => ({ eventId: 'evt_1', policy: 'open', threshold: 0 })) };
  const eventReferences = {
    findEventReadAccess: vi.fn(async () => ({ id: 'evt_1' })),
    findOperationsEvent: vi.fn(async () => ({ id: 'evt_1', archived: false, status: 'planning', eventDate })),
  };
  return { controller: new WalkInPolicyController(access as any, policy as any, eventReferences as any), policy };
}

const nextMonth = new Date(Date.now() + 30 * 86_400_000);

describe('WalkInPolicyController (New-CL1)', () => {
  it('lets the event\'s client set the walk-in policy during planning, and PMCM at any time', async () => {
    const client = fixture('client', nextMonth);
    await client.controller.update('evt_1', { policy: 'open' }, { actorRole: 'client' } as any);
    expect(client.policy.update).toHaveBeenCalledTimes(1);
    const pmcm = fixture('pmcm-admin', new Date(Date.now() - 86_400_000));
    await pmcm.controller.update('evt_1', { policy: 'closed' }, { actorRole: 'pmcm-admin' } as any);
    expect(pmcm.policy.update).toHaveBeenCalledTimes(1);
  });

  it('refuses suppliers, another client\'s event, and a client once event day has arrived', async () => {
    const supplier = fixture('supplier', nextMonth);
    await expect(supplier.controller.update('evt_1', { policy: 'open' }, { actorRole: 'supplier' } as any)).rejects.toThrow(ForbiddenException);
    const stranger = fixture('client', nextMonth, { ownsEvent: false });
    await expect(stranger.controller.update('evt_1', { policy: 'open' }, { actorRole: 'client' } as any)).rejects.toThrow('not your event');
    const late = fixture('client', new Date(Date.now() - 3_600_000));
    await expect(late.controller.update('evt_1', { policy: 'open' }, { actorRole: 'client' } as any)).rejects.toThrow('PMCM once event day begins');
    for (const item of [supplier, stranger, late]) expect(item.policy.update).not.toHaveBeenCalled();
  });
});
