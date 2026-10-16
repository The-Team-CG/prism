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
  ])('blocks delivery for a %s', async (_label, overrides) => {
    const { service } = createService(overrides);

    await expect(service.canDeliverGuestPass('pass_1', 'evt_synthetic')).resolves.toBe(false);
  });
});
