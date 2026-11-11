import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationEscalationService } from './notification-escalation.service';

const escalatedAt = new Date('2026-11-10T00:00:00.000Z');
const hours = (count: number) => count * 60 * 60_000;

function createService(options: { eventId: string | null; claimed?: number }) {
  const tx = { opsNotificationDelivery: { updateMany: vi.fn(async () => ({ count: options.claimed ?? 1 })) } };
  const secondLevelRow = {
    id: 'ndel_1', recipient: 'supplier@example.test', escalatedAt, acknowledgmentDueAt: new Date('2026-11-09T00:00:00.000Z'),
    notification: { eventId: options.eventId },
  };
  const prisma = {
    opsNotificationDelivery: {
      // First level selects rows never escalated (escalatedAt: null); none here. Second level selects escalated ones.
      findMany: vi.fn(async ({ where }: { where: { escalatedAt: unknown } }) => (where.escalatedAt === null ? [] : [secondLevelRow])),
    },
    opsNotificationProviderOutcome: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    $transaction: vi.fn(async (work: (client: typeof tx) => unknown) => work(tx)),
  };
  const outbox = { queue: vi.fn(async () => ({})) };
  const audit = { write: vi.fn(async () => undefined) };
  return { service: new NotificationEscalationService(prisma as never, outbox as never, audit as never), prisma, tx, outbox, audit };
}

describe('second-level notification escalation', () => {
  afterEach(() => { delete process.env.PRISM_NOTIFICATION_SECOND_ESCALATION_HOURS; });

  it('chases a recipient still silent after the window: PMCM again and the event coordinators, in the transaction that marks it', async () => {
    const { service, prisma, tx, outbox, audit } = createService({ eventId: 'evt_1' });
    const now = new Date(escalatedAt.getTime() + hours(25));

    expect(await service.escalateDue(now)).toEqual({ escalated: 0, secondEscalated: 1 });

    const where = (prisma.opsNotificationDelivery.findMany.mock.calls[1] as unknown as [{ where: Record<string, unknown> }])[0].where;
    expect(where).toEqual({ acknowledgedAt: null, secondEscalatedAt: null, escalatedAt: { lte: new Date(now.getTime() - hours(24)) } });
    expect(tx.opsNotificationDelivery.updateMany).toHaveBeenCalledWith({
      where: { id: 'ndel_1', acknowledgedAt: null, secondEscalatedAt: null, escalatedAt },
      data: { secondEscalatedAt: now },
    });
    const queued = outbox.queue.mock.calls as unknown as Array<[string, string, string, string, { idempotencyKey: string; action: unknown }, { prisma: unknown }]>;
    expect(queued.map(([eventId, recipient]) => [eventId, recipient])).toEqual([['evt_1', 'PMCM Admin'], ['evt_1', 'Coordinator']]);
    expect(queued.map(([, , , , options]) => options.idempotencyKey)).toEqual([
      'notification-escalation-2:ndel_1:2026-11-10T00:00:00.000Z:pmcm',
      'notification-escalation-2:ndel_1:2026-11-10T00:00:00.000Z:coordinator',
    ]);
    expect(queued[1][2]).toContain('supplier@example.test');
    expect(queued[1][4].action).toMatchObject({ kind: 'event_section', eventId: 'evt_1', section: 'overview' });
    expect(queued.every(([, , , , , context]) => context.prisma === tx)).toBe(true);
    expect(audit.write).toHaveBeenCalledTimes(1);
  });

  it('addresses only PMCM when the notice belongs to no event, since there are no coordinators to reach', async () => {
    const { service, outbox } = createService({ eventId: null });

    expect((await service.escalateDue(new Date(escalatedAt.getTime() + hours(25)))).secondEscalated).toBe(1);

    expect(outbox.queue.mock.calls.map((call) => (call as unknown as string[])[1])).toEqual(['PMCM Admin']);
  });

  it('queues nothing when another sweep or instance already claimed the recipient', async () => {
    const { service, outbox, audit } = createService({ eventId: 'evt_1', claimed: 0 });

    expect(await service.escalateDue(new Date(escalatedAt.getTime() + hours(25)))).toEqual({ escalated: 0, secondEscalated: 0 });

    expect(outbox.queue).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it('waits the configured number of hours, not a fixed day', async () => {
    process.env.PRISM_NOTIFICATION_SECOND_ESCALATION_HOURS = '6';
    const { service, prisma } = createService({ eventId: 'evt_1' });
    const now = new Date(escalatedAt.getTime() + hours(7));

    await service.escalateDue(now);

    const where = (prisma.opsNotificationDelivery.findMany.mock.calls[1] as unknown as [{ where: { escalatedAt: { lte: Date } } }])[0].where;
    expect(where.escalatedAt.lte).toEqual(new Date(now.getTime() - hours(6)));
  });
});
