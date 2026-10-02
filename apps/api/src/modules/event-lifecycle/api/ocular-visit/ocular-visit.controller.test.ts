import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { describe, expect, it, vi } from 'vitest';
import { OcularVisitController } from './ocular-visit.controller';

const eventId = 'evt_ocular_visit';
const clientActor = {
  id: 'client_1',
  role: OpsUserRole.Client,
  name: 'Client One',
  email: 'client@example.test',
  explicit: true,
  verified: true,
};
const clientVerifiedActor = {
  id: clientActor.id,
  actorId: clientActor.id,
  role: OpsUserRole.Client,
  actorRole: OpsUserRole.Client,
  email: clientActor.email,
  actorEmail: clientActor.email,
  name: clientActor.name,
  actorName: clientActor.name,
  expiresAt: '2026-10-01T00:00:00.000Z',
} satisfies PrismVerifiedEventActor;
const adminVerifiedActor = {
  ...clientVerifiedActor,
  id: 'pmcm_1',
  actorId: 'pmcm_1',
  role: OpsUserRole.PmcmAdmin,
  actorRole: OpsUserRole.PmcmAdmin,
  email: 'maxine@pmcm.test',
  actorEmail: 'maxine@pmcm.test',
  name: 'Maxine',
  actorName: 'Maxine',
} satisfies PrismVerifiedEventActor;

describe('OcularVisitController', () => {
  it('binds all event-scoped ocular visit routes behind the session guard', () => {
    const prototype = OcularVisitController.prototype;
    const routes = [
      ['submitClientRequest', ':eventId/ocular-visit', RequestMethod.POST],
      ['scheduleOcularVisit', ':eventId/ocular-visit/schedule', RequestMethod.PATCH],
      ['completeOcularVisit', ':eventId/ocular-visit/complete', RequestMethod.POST],
      ['waiveOcularVisit', ':eventId/ocular-visit/waive', RequestMethod.POST],
    ] as const;

    expect(Reflect.getMetadata(PATH_METADATA, OcularVisitController)).toBe('events');
    for (const [name, path, method] of routes) {
      const handler = prototype[name];
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(EventSessionGuard);
    }
  });

  it('allows the assigned client role through the request command route', async () => {
    const service = { submitClientRequest: vi.fn(async () => ({ id: 'ovr_1' })) };
    const policy = {
      resolveActor: vi.fn(() => clientActor),
      requireActorRole: vi.fn(async () => undefined),
    };
    const controller = new OcularVisitController(service as never, policy as never);
    const input = { clientNote: 'Please visit before the event' };

    await expect(controller.submitClientRequest(eventId, input, clientVerifiedActor)).resolves.toEqual({ id: 'ovr_1' });
    expect(policy.requireActorRole).toHaveBeenCalledWith(
      clientActor,
      [OpsUserRole.Client],
      'client ocular visit request',
      eventId,
    );
    expect(service.submitClientRequest).toHaveBeenCalledWith(eventId, input, clientActor);
  });

  it('blocks non-admin actors from scheduling, completion, and waiver commands', async () => {
    const service = {
      scheduleOcularVisit: vi.fn(),
      completeOcularVisit: vi.fn(),
      waiveOcularVisit: vi.fn(),
    };
    const policy = {
      resolveActor: vi.fn(() => clientActor),
      requireActorRole: vi.fn(async () => {
        throw new Error('forbidden');
      }),
    };
    const controller = new OcularVisitController(service as never, policy as never);

    await expect(controller.scheduleOcularVisit(eventId, { scheduledAt: '2026-10-05T09:00:00+08:00' }, clientVerifiedActor)).rejects.toThrow('forbidden');
    await expect(controller.completeOcularVisit(eventId, clientVerifiedActor)).rejects.toThrow('forbidden');
    await expect(controller.waiveOcularVisit(eventId, { reason: 'No visit required' }, clientVerifiedActor)).rejects.toThrow('forbidden');

    expect(service.scheduleOcularVisit).not.toHaveBeenCalled();
    expect(service.completeOcularVisit).not.toHaveBeenCalled();
    expect(service.waiveOcularVisit).not.toHaveBeenCalled();
    expect(policy.requireActorRole).toHaveBeenCalledTimes(3);
    expect(policy.requireActorRole).toHaveBeenCalledWith(
      clientActor,
      [OpsUserRole.PmcmAdmin],
      'PMCM ocular visit task',
      eventId,
    );
  });
});
