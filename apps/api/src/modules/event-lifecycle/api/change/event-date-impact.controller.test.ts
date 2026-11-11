import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventDateImpactController } from './event-date-impact.controller';

const verified = (role: string, id: string | undefined = 'user_pmcm') =>
  ({ id, actorId: id, actorRole: role, actorName: 'PMCM Planner', actorEmail: 'planner@pmcm.test', expiresAt: '2099-01-01' }) as never;

function createController() {
  const service = { impact: vi.fn(async () => ({})), syncPlan: vi.fn(async () => ({})) };
  const policy = {
    // The role the verified session carries is the only identity the controller may use.
    resolveActor: vi.fn((_input: unknown, session: { id?: string; actorRole: string; actorName: string; actorEmail?: string }) => ({
      id: session.id, role: session.actorRole, name: session.actorName, email: session.actorEmail,
    })),
    requireActorRole: vi.fn(async (actor: { role: string }, roles: readonly string[]) => {
      if (!roles.includes(actor.role)) throw new ForbiddenException('Actor is not authorized');
    }),
  };
  return { controller: new EventDateImpactController(service as never, policy as never), service };
}

const dto = {} as never;
const calls: Array<[string, (controller: EventDateImpactController, actor: never) => Promise<unknown>, 'impact' | 'syncPlan']> = [
  ['impact', (c, a) => c.get('evt_1', { newDate: '2026-12-20' }, a), 'impact'],
  ['syncPlan', (c, a) => c.syncPlan('evt_1', dto, a), 'syncPlan'],
];

describe('EventDateImpactController', () => {
  it.each(calls)('%s is PMCM only: clients, suppliers, coordinators, guests and unknown roles reach nothing', async (_name, call, method) => {
    for (const role of [OpsUserRole.Client, OpsUserRole.Supplier, OpsUserRole.Coordinator, OpsUserRole.Guest, OpsUserRole.Unknown]) {
      const { controller, service } = createController();
      await expect(call(controller, verified(role))).rejects.toThrow(ForbiddenException);
      expect(service[method]).not.toHaveBeenCalled();
    }
  });

  it('needs a verified actor id to move the plan, even from an allowed role', async () => {
    const { controller, service } = createController();
    await expect(controller.syncPlan('evt_1', dto, verified(OpsUserRole.PmcmAdmin, ' '))).rejects.toThrow(ForbiddenException);
    expect(service.syncPlan).not.toHaveBeenCalled();
  });

  it('lets PMCM and the system read the impact for the date asked, and move the plan naming the verified account', async () => {
    for (const role of [OpsUserRole.PmcmAdmin, OpsUserRole.System]) {
      const { controller, service } = createController();
      await controller.get('evt_1', { newDate: '2026-12-20' }, verified(role, 'user_7'));
      await controller.syncPlan('evt_1', dto, verified(role, 'user_7'));
      expect(service.impact).toHaveBeenCalledWith('evt_1', { newDate: '2026-12-20' });
      expect(service.syncPlan).toHaveBeenCalledWith('evt_1', dto, { id: 'user_7', name: 'PMCM Planner', role, email: 'planner@pmcm.test' });
    }
  });
});
