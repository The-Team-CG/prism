import { describe, expect, it, vi } from 'vitest';
import { GuestPassDeliveryEligibilityService } from './guest-pass-delivery-eligibility.service';

function createService(options: {
  pass?: { id: string; eventId: string; status: string } | null;
  event?: { id: string; status: string; archived: boolean; actualEndedAt: Date | null } | null;
} = {}) {
  const pass = 'pass' in options ? options.pass : { id: 'pass_1', eventId: 'evt_synthetic', status: 'active' };
  const event = 'event' in options ? options.event : {
    id: 'evt_synthetic',
    status: 'planning',
    archived: false,
    actualEndedAt: null,
  };
  const prisma = {
    opsGuestQrPass: {
      findUnique: vi.fn(async () => pass),
    },
  };
  const eventReferences = {
    findOperationsEvent: vi.fn(async () => event),
  };
  return {
    eventReferences,
    prisma,
    service: new GuestPassDeliveryEligibilityService(prisma as never, eventReferences as never),
  };
}

describe('GuestPassDeliveryEligibilityService', () => {
  it('allows delivery only when the active pass is bound to the open event', async () => {
    const { eventReferences, prisma, service } = createService();

    await expect(service.canDeliverGuestPass('pass_1', 'evt_synthetic')).resolves.toBe(true);

    expect(prisma.opsGuestQrPass.findUnique).toHaveBeenCalledWith({
      where: { id: 'pass_1' },
      select: { eventId: true, status: true },
    });
    expect(eventReferences.findOperationsEvent).toHaveBeenCalledWith('evt_synthetic');
  });

  it.each([
    ['missing pass', { pass: null }],
    ['pass bound to another event', { pass: { id: 'pass_1', eventId: 'evt_other', status: 'active' } }],
    ['revoked pass', { pass: { id: 'pass_1', eventId: 'evt_synthetic', status: 'revoked' } }],
    ['missing event', { event: null }],
    ['actual-ended event', { event: { id: 'evt_synthetic', status: 'ended', archived: false, actualEndedAt: new Date('2026-10-16T10:00:00.000Z') } }],
    ['archived event', { event: { id: 'evt_synthetic', status: 'archived', archived: true, actualEndedAt: null } }],
    ['archived status with a stale archive flag', { event: { id: 'evt_synthetic', status: 'archived', archived: false, actualEndedAt: null } }],
  ])('blocks delivery for a %s', async (_label, overrides) => {
    const { service } = createService(overrides);

    await expect(service.canDeliverGuestPass('pass_1', 'evt_synthetic')).resolves.toBe(false);
  });

  it('composes sanitized delivery states for event-scoped guest passes', async () => {
    const passes = [
      { id: 'pass_capture', eventId: 'evt_synthetic', status: 'active', deliveryStatus: 'queued', notificationId: 'not_capture' },
      { id: 'pass_retry', eventId: 'evt_synthetic', status: 'active', deliveryStatus: 'queued', notificationId: 'not_retry' },
      { id: 'pass_failed', eventId: 'evt_synthetic', status: 'active', deliveryStatus: 'failed', notificationId: 'not_failed' },
      { id: 'pass_revoked', eventId: 'evt_synthetic', status: 'revoked', deliveryStatus: 'revoked', notificationId: 'not_cancelled' },
      { id: 'pass_sent', eventId: 'evt_synthetic', status: 'active', deliveryStatus: 'queued', notificationId: 'not_sent' },
    ];
    const notifications = [
      { id: 'not_capture', status: 'captured' },
      { id: 'not_retry', status: 'queued' },
      { id: 'not_failed', status: 'failed' },
      { id: 'not_cancelled', status: 'cancelled' },
      { id: 'not_sent', status: 'sent' },
    ];
    const prisma = {
      opsGuestQrPass: {
        findMany: vi.fn(async () => passes),
      },
      opsNotificationLog: {
        findMany: vi.fn(async () => notifications),
      },
    };
    const service = new GuestPassDeliveryEligibilityService(prisma as never, {} as never);

    await expect(service.getGuestPassDeliveryStatuses('evt_synthetic', passes.map((pass) => pass.id))).resolves.toEqual(new Map([
      ['pass_capture', 'captured'],
      ['pass_retry', 'queued'],
      ['pass_failed', 'failed'],
      ['pass_revoked', 'revoked'],
      ['pass_sent', 'failed'],
    ]));
    expect(prisma.opsGuestQrPass.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventId: 'evt_synthetic', id: { in: passes.map((pass) => pass.id) } },
      select: { id: true, status: true, deliveryStatus: true, notificationId: true },
    }));
    expect(prisma.opsNotificationLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: expect.arrayContaining(['not_capture', 'not_sent']) } },
      select: { id: true, status: true },
    }));
  });
});
