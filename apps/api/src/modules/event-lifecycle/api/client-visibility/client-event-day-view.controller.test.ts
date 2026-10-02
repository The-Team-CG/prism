import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { describe, expect, it, vi } from 'vitest';
import { ClientEventDayViewController } from './client-event-day-view.controller';

const eventId = 'evt_event_day_view';

const actor = {
  id: 'pmcm_1',
  role: OpsUserRole.PmcmAdmin,
  name: 'Maxine',
  explicit: true,
  verified: true,
};

const verifiedActor = {
  id: 'pmcm_1',
  actorId: 'pmcm_1',
  role: OpsUserRole.PmcmAdmin,
  actorRole: OpsUserRole.PmcmAdmin,
  email: 'maxine@pmcm.test',
  actorEmail: 'maxine@pmcm.test',
  name: 'Maxine',
  actorName: 'Maxine',
  expiresAt: '2026-10-01T00:00:00.000Z',
} satisfies PrismVerifiedEventActor;

describe('ClientEventDayViewController', () => {
  it('exposes an event-scoped guarded PATCH route', () => {
    const prototype = ClientEventDayViewController.prototype;
    const routeHandler = prototype.setClientEventDayView;

    expect(Reflect.getMetadata(PATH_METADATA, ClientEventDayViewController)).toBe('events');
    expect(Reflect.getMetadata(PATH_METADATA, routeHandler)).toBe(':eventId/client-event-day-view');
    expect(Reflect.getMetadata(METHOD_METADATA, routeHandler)).toBe(RequestMethod.PATCH);
    expect(Reflect.getMetadata(GUARDS_METADATA, routeHandler)).toContain(EventSessionGuard);
  });

  it('authorizes a verified PMCM Admin and delegates the event-scoped setting', async () => {
    const service = { setClientEventDayView: vi.fn(async () => ({ eventId, enabled: true })) };
    const policy = {
      resolveActor: vi.fn(() => actor),
      requireActorRole: vi.fn(async () => undefined),
    };
    const controller = new ClientEventDayViewController(service as never, policy as never);

    await expect(controller.setClientEventDayView(eventId, { enabled: true }, verifiedActor)).resolves.toEqual({
      eventId,
      enabled: true,
    });

    expect(policy.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(policy.requireActorRole).toHaveBeenCalledWith(
      actor,
      [OpsUserRole.PmcmAdmin],
      'client event-day visibility',
      eventId,
    );
    expect(service.setClientEventDayView).toHaveBeenCalledWith(eventId, { enabled: true }, actor);
  });

  it('rejects a forbidden actor before invoking the setting command', async () => {
    const service = { setClientEventDayView: vi.fn() };
    const policy = {
      resolveActor: vi.fn(() => ({ ...actor, role: OpsUserRole.Client })),
      requireActorRole: vi.fn(async () => {
        throw new Error('forbidden');
      }),
    };
    const controller = new ClientEventDayViewController(service as never, policy as never);

    await expect(controller.setClientEventDayView(eventId, { enabled: true }, verifiedActor)).rejects.toThrow('forbidden');
    expect(service.setClientEventDayView).not.toHaveBeenCalled();
  });
});
