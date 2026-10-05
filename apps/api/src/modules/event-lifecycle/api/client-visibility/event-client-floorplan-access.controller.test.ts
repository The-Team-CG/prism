import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventClientFloorplanAccessController } from './event-client-floorplan-access.controller';

type Controller = {
  listAccess(eventId: string, verifiedActor: unknown): Promise<unknown>;
  searchCandidates(eventId: string, query: string, verifiedActor: unknown): Promise<unknown>;
  grant(eventId: string, input: { userId: string }, verifiedActor: unknown): Promise<unknown>;
  revoke(eventId: string, userId: string, verifiedActor: unknown): Promise<unknown>;
};
type ControllerConstructor = new (service: unknown, policy: unknown) => Controller;

const ControllerClass = EventClientFloorplanAccessController as unknown as ControllerConstructor;
const actor = { id: 'admin_1', name: 'PMCM Admin', role: OpsUserRole.PmcmAdmin, explicit: true, verified: true };
const verifiedActor = { id: 'admin_1', actorId: 'admin_1', role: OpsUserRole.PmcmAdmin, actorRole: OpsUserRole.PmcmAdmin, email: 'admin@example.test', actorEmail: 'admin@example.test', name: 'PMCM Admin', actorName: 'PMCM Admin' };

function createController() {
  const service = {
    listAccess: vi.fn(async () => ({ eventId: 'evt_1', secondaryContacts: [] })),
    searchCandidates: vi.fn(async () => []),
    grant: vi.fn(async () => ({ eventId: 'evt_1', secondaryContacts: [] })),
    revoke: vi.fn(async () => ({ eventId: 'evt_1', secondaryContacts: [] })),
  };
  const policy = {
    resolveActor: vi.fn(() => actor),
    requireActorRole: vi.fn(async () => undefined),
  };
  return { controller: ControllerClass ? new ControllerClass(service, policy) : undefined, service, policy };
}

describe('EventClientFloorplanAccessController', () => {
  it('registers guarded PMCM routes for listing, candidates, grant, and revoke', () => {
    expect(ControllerClass).toBeDefined();
    if (!ControllerClass) return;
    const prototype = ControllerClass.prototype;
    expect(Reflect.getMetadata('path', ControllerClass)).toBe('events');
    expect(Reflect.getMetadata('path', prototype.listAccess)).toBe(':eventId/client-floorplan-access');
    expect(Reflect.getMetadata('method', prototype.listAccess)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata('path', prototype.searchCandidates)).toBe(':eventId/client-floorplan-access/candidates');
    expect(Reflect.getMetadata('path', prototype.grant)).toBe(':eventId/client-floorplan-access');
    expect(Reflect.getMetadata('method', prototype.grant)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata('path', prototype.revoke)).toBe(':eventId/client-floorplan-access/:userId');
    for (const handler of [prototype.listAccess, prototype.searchCandidates, prototype.grant, prototype.revoke]) {
      expect(Reflect.getMetadata('__guards__', handler)).toContain(EventSessionGuard);
    }
  });

  it('resolves the verified actor and permits PMCM Admin to manage grants', async () => {
    expect(ControllerClass).toBeDefined();
    if (!ControllerClass) return;
    const h = createController();
    if (!h.controller) return;

    await h.controller.grant('evt_1', { userId: 'client_2' }, verifiedActor);
    expect(h.policy.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(h.policy.requireActorRole).toHaveBeenCalledWith(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'client floorplan access', 'evt_1');
    expect(h.service.grant).toHaveBeenCalledWith('evt_1', 'client_2', actor);
  });

  it('does not call grant commands when event authorization rejects the actor', async () => {
    expect(ControllerClass).toBeDefined();
    if (!ControllerClass) return;
    const h = createController();
    if (!h.controller) return;
    h.policy.requireActorRole.mockRejectedValueOnce(new Error('forbidden'));

    await expect(h.controller.grant('evt_1', { userId: 'client_2' }, verifiedActor)).rejects.toThrow('forbidden');
    expect(h.service.grant).not.toHaveBeenCalled();
  });

  it('delegates candidate search and revoke only after authorization', async () => {
    expect(ControllerClass).toBeDefined();
    if (!ControllerClass) return;
    const h = createController();
    if (!h.controller) return;

    await h.controller.searchCandidates('evt_1', 'client', verifiedActor);
    await h.controller.revoke('evt_1', 'client_2', verifiedActor);
    expect(h.service.searchCandidates).toHaveBeenCalledWith('evt_1', 'client', actor);
    expect(h.service.revoke).toHaveBeenCalledWith('evt_1', 'client_2', actor);
  });
});
