import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventFinancialsController } from './event-financials.controller';

const verified = (role: string) => ({ id: 'user_1', actorId: 'user_1', actorRole: role, actorName: 'Finance', expiresAt: '2099-01-01' }) as never;

function createController() {
  const financials = { getSummary: vi.fn(async (eventId: string) => ({ eventId })) };
  const policy = {
    resolveActor: vi.fn((_input: unknown, session: { actorRole: string }) => ({ role: session.actorRole })),
    requireActorRole: vi.fn(async (actor: { role: string }, roles: readonly string[]) => {
      if (!roles.includes(actor.role)) throw new ForbiddenException('Actor is not authorized');
    }),
  };
  return { controller: new EventFinancialsController(financials as never, policy as never), financials, policy };
}

describe('EventFinancialsController', () => {
  it('serves under the events route base', () => {
    expect(Reflect.getMetadata('path', EventFinancialsController)).toBe('events');
  });

  it('shows margin and supplier cost to PMCM and the system only, and reaches nothing for any other role', async () => {
    for (const role of [OpsUserRole.Client, OpsUserRole.Supplier, OpsUserRole.Coordinator, OpsUserRole.Guest, OpsUserRole.Unknown]) {
      const { controller, financials } = createController();
      await expect(controller.summary('evt_1', verified(role))).rejects.toThrow(ForbiddenException);
      expect(financials.getSummary).not.toHaveBeenCalled();
    }
    for (const role of [OpsUserRole.PmcmAdmin, OpsUserRole.System]) {
      const { controller, financials, policy } = createController();
      await expect(controller.summary('evt_1', verified(role))).resolves.toEqual({ eventId: 'evt_1' });
      expect(policy.requireActorRole).toHaveBeenCalledWith({ role }, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'event financial summary', 'evt_1');
      expect(financials.getSummary).toHaveBeenCalledWith('evt_1');
    }
  });
});
