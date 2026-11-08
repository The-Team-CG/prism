import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import type { NotificationOutboxWriter } from '@prism/contexts/platform-ops';
import { SupplierReadinessRequestService } from './supplier-readiness-request.service';

type Notification = { eventId?: string; recipient: string; message: string; idempotencyKey?: string };

// Events are stored as the Philippine day at UTC midnight; 20 Nov 2026 begins at 19 Nov 16:00 UTC.
const dueEvent = { id: 'evt_due', eventName: 'Ayala Tech Summit', eventDate: new Date('2026-11-20T00:00:00.000Z') };
const notYetEvent = { id: 'evt_later', eventName: 'Far Away Gala', eventDate: new Date('2026-12-01T00:00:00.000Z') };
const now = new Date('2026-11-13T02:00:00.000Z');

function createService(requests: Array<Record<string, unknown>>) {
  const outbox = new Map<string, Notification>();
  const writer = {
    write: vi.fn(async (input: Notification) => {
      // Mirrors the outbox: a repeated idempotency key keeps the first notification.
      if (input.idempotencyKey && !outbox.has(input.idempotencyKey)) outbox.set(input.idempotencyKey, input);
      return undefined;
    }),
  };
  const prisma = {
    opsEvent: { findMany: vi.fn(async () => [dueEvent, notYetEvent]) },
    opsSupplierQuoteRequest: {
      findMany: vi.fn(async ({ where }: { where: { eventId: string } }) => requests.filter((request) => request.eventId === where.eventId)),
    },
  };
  const service = new SupplierReadinessRequestService(prisma as unknown as PrismaService, writer as unknown as NotificationOutboxWriter);
  return { service, outbox, writer };
}

const confirmedBooking = (id: string, eventId = 'evt_due', email = `${id}@supplier.test`) => ({
  id,
  eventId,
  category: 'Technicals',
  supplier: { email },
});

describe('SupplierReadinessRequestService', () => {
  it('queues one readiness request per selected booking once its event is seven days out', async () => {
    const { service, outbox } = createService([
      confirmedBooking('qr_sonic'),
      confirmedBooking('qr_lights'),
      confirmedBooking('qr_no_email', 'evt_due', ''),
      confirmedBooking('qr_later', 'evt_later'),
    ]);

    const result = await service.queueDueReadinessRequests(now);

    expect(result).toEqual({ queued: 2 });
    expect([...outbox.keys()].sort()).toEqual(['supplier-readiness-request:qr_lights', 'supplier-readiness-request:qr_sonic']);
    expect(outbox.get('supplier-readiness-request:qr_sonic')).toMatchObject({
      eventId: 'evt_due',
      recipient: 'qr_sonic@supplier.test',
      message: expect.stringContaining('Ayala Tech Summit (Technicals) on 2026-11-20'),
    });
  });

  it('does not queue anything one minute before the Philippine seven-day boundary', async () => {
    const { service, writer } = createService([confirmedBooking('qr_sonic')]);

    await expect(service.queueDueReadinessRequests(new Date('2026-11-12T15:59:00.000Z'))).resolves.toEqual({ queued: 0 });
    expect(writer.write).not.toHaveBeenCalled();
  });

  it('keeps one notification per booking when the sweep runs again', async () => {
    const { service, outbox, writer } = createService([confirmedBooking('qr_sonic')]);

    await service.queueDueReadinessRequests(now);
    await service.queueDueReadinessRequests(new Date(now.getTime() + 60_000));

    expect(writer.write).toHaveBeenCalledTimes(2);
    expect([...outbox.keys()]).toEqual(['supplier-readiness-request:qr_sonic']);
  });
});
