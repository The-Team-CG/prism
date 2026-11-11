import { describe, expect, it, vi } from 'vitest';
import { NotificationInboxService } from './notification-inbox.service';

function setup() {
  const rows = ['a', 'b'].map((name) => ({ id: name, recipient: `${name}@test.example`, notificationId: 'notice', createdAt: new Date(), readAt: null as Date | null, acknowledgedAt: null as Date | null,
    notification: { id: 'notice', eventId: 'event', channel: 'email', recipient: 'Coordinator', message: 'Review schedule revision 2' } }));
  const delegate = {
    findMany: vi.fn(async ({ where }: { where: { recipient: string } }) => rows.filter((r) => r.recipient === where.recipient)),
    findFirst: vi.fn(async ({ where }: { where: { id: string; recipient: string } }) => rows.find((r) => r.id === where.id && r.recipient === where.recipient) ?? null),
    updateMany: vi.fn(async ({ where, data }: { where: { id: string }; data: { readAt: Date; acknowledgedAt: Date } }) => {
      const row = rows.find((r) => r.id === where.id && !r.acknowledgedAt); if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 };
    }),
  };
  const tx = { opsNotificationDelivery: delegate };
  const prisma = { ...tx, $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) };
  const contacts = { findActiveCoordinatorEmailsForEvent: vi.fn(async () => rows.map((r) => r.recipient)) };
  const audit = { write: vi.fn(async () => undefined) };
  const service = new NotificationInboxService(prisma as never, contacts as never, audit as never);
  const actor = { id: 'user-a', role: 'coordinator', email: 'a@test.example', name: 'A' } as never;
  return { service, actor, rows, delegate, contacts, audit };
}

describe('recipient notification inbox', () => {
  it('acknowledges only the exact recipient and version, independently and idempotently', async () => {
    const { service, actor, rows, audit } = setup();
    const [notice] = await service.mine(actor);
    expect(notice.message).toContain('revision 2');
    await expect(service.acknowledge('b', notice.version, actor)).rejects.toThrow('not found');
    await expect(service.acknowledge('a', '0'.repeat(64), actor)).rejects.toThrow('changed');
    await service.acknowledge('a', notice.version, actor);
    await service.acknowledge('a', notice.version, actor);
    expect(rows[0].acknowledgedAt).toBeInstanceOf(Date);
    expect(rows[1].acknowledgedAt).toBeNull();
    expect(audit.write).toHaveBeenCalledTimes(1);
  });

  it('withholds old notices after event access is removed', async () => {
    const { service, actor, contacts, rows } = setup();
    const [notice] = await service.mine(actor);
    contacts.findActiveCoordinatorEmailsForEvent.mockResolvedValue([]);
    await expect(service.mine(actor)).resolves.toEqual([]);
    await expect(service.acknowledge('a', notice.version, actor)).rejects.toThrow('current event access');
    expect(rows[0].acknowledgedAt).toBeNull();
  });
});
