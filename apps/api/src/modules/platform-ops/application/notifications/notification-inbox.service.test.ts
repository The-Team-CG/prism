import { describe, expect, it, vi } from 'vitest';
import { NotificationInboxService } from './notification-inbox.service';

function setup() {
  const rows = ['a', 'b'].map((name) => ({ id: name, recipient: `${name}@test.example`, notificationId: 'notice', createdAt: new Date(), readAt: null as Date | null, acknowledgedAt: null as Date | null,
    notification: { id: 'notice', eventId: 'event', channel: 'email', recipient: 'Coordinator', message: 'Review schedule revision 2' } }));
  const delegate = {
    findMany: vi.fn(async ({ where, take }: { where: { recipient: string; readAt?: null }; take?: number }) =>
      rows.filter((r) => r.recipient === where.recipient && (where.readAt === undefined || r.readAt === null)).slice(0, take)),
    findFirst: vi.fn(async ({ where }: { where: { id: string; recipient: string } }) => rows.find((r) => r.id === where.id && r.recipient === where.recipient) ?? null),
    updateMany: vi.fn(async ({ where, data }: { where: { id?: string; recipient?: string }; data: { readAt: Date; acknowledgedAt: Date } }) => {
      if (!where.id) {
        const mine = rows.filter((r) => r.recipient === where.recipient && !r.readAt);
        mine.forEach((r) => { r.readAt = data.readAt; });
        return { count: mine.length };
      }
      const row = rows.find((r) => r.id === where.id && !r.acknowledgedAt); if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 };
    }),
  };
  const tx = { opsNotificationDelivery: delegate };
  const prisma = { ...tx, $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) };
  const contacts = {
    findActiveCoordinatorEmailsForEvent: vi.fn(async () => rows.map((r) => r.recipient)),
    findEventNames: vi.fn(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 'Ayala wedding']))),
  };
  const audit = { write: vi.fn(async () => undefined) };
  const service = new NotificationInboxService(prisma as never, contacts as never, audit as never);
  const actor = { id: 'user-a', role: 'coordinator', email: 'a@test.example', name: 'A' } as never;
  return { service, actor, rows, delegate, contacts, audit };
}

describe('recipient notification inbox', () => {
  it('names each notice event and counts unread across the whole inbox, checking each event access once', async () => {
    const { service, actor, rows, contacts } = setup();
    rows.push(...['c', 'd', 'e'].map((name) => ({ ...rows[0], id: name, notification: { ...rows[0].notification, id: name } })));
    const inbox = await service.mine(actor, 2);
    expect(inbox.items).toHaveLength(2);
    expect(inbox.items[0]).toMatchObject({ eventId: 'event', eventName: 'Ayala wedding' });
    expect(inbox).toMatchObject({ unread: 4, hasMore: true });
    expect(contacts.findActiveCoordinatorEmailsForEvent).toHaveBeenCalledTimes(2);
    expect((await service.mine(actor, 30)).hasMore).toBe(false);
  });

  it('marks only the signed-in account notices read', async () => {
    const { service, actor, rows } = setup();
    await expect(service.markAllRead(actor)).resolves.toEqual({ marked: 1 });
    expect(rows[0].readAt).toBeInstanceOf(Date);
    expect(rows[1].readAt).toBeNull();
    await expect(service.unread(actor)).resolves.toBe(0);
  });

  it('acknowledges only the exact recipient and version, independently and idempotently', async () => {
    const { service, actor, rows, audit } = setup();
    const [notice] = (await service.mine(actor, 30)).items;
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
    const [notice] = (await service.mine(actor, 30)).items;
    contacts.findActiveCoordinatorEmailsForEvent.mockResolvedValue([]);
    await expect(service.mine(actor, 30)).resolves.toMatchObject({ items: [], unread: 0, hasMore: false });
    await expect(service.acknowledge('a', notice.version, actor)).rejects.toThrow('current event access');
    expect(rows[0].acknowledgedAt).toBeNull();
  });
});
