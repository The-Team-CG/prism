import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommunicationService, newMessageNotice } from './communication.service';

function harness(options: { removed?: boolean; replay?: { body: string } } = {}) {
  const actor = { id: 'u_supplier', name: 'Supplier', email: 'supplier@example.test', role: 'supplier', explicit: true, verified: true } as const;
  const message = { id: 'msg_1', threadId: 'thread_1', senderId: actor.id, senderRole: actor.role, senderEmail: actor.email, body: options.replay?.body ?? 'hello', payloadHash: 'hash', idempotencyKey: 'key_1', createdAt: new Date() };
  const tx = {
    $queryRaw: vi.fn(),
    opsCommunicationParticipant: { findFirst: vi.fn(async () => options.removed ? null : { id: 'member' }), findMany: vi.fn(async () => []) },
    opsCommunicationMessage: { findUnique: vi.fn(async () => options.replay ? message : null), upsert: vi.fn(async () => message) },
    opsCommunicationThread: { update: vi.fn() },
  };
  const prisma = { opsCommunicationThread: { findUnique: vi.fn(async () => ({ id: 'thread_1', eventId: 'event_1' })) }, $transaction: vi.fn(async (fn: (db: typeof tx) => unknown) => fn(tx)) };
  const service = new CommunicationService(prisma as never, { requireActorRole: vi.fn() } as never, { resolveForEvent: vi.fn(async () => actor) } as never, { write: vi.fn() } as never, { write: vi.fn() } as never);
  return { service, actor, tx };
}

describe('CommunicationService thread creation', () => {
  function threadHarness(resolveForEvent = vi.fn(async (id: string) => ({ id, role: 'supplier' }))) {
    const supplier = { id: 'u_supplier', name: 'Supplier', email: 'supplier@example.test', role: 'supplier', explicit: true, verified: true } as const;
    const pmcm = { id: 'u_pmcm', name: 'PMCM', email: 'pmcm@example.test', role: 'pmcm-admin', explicit: true, verified: true };
    const createMany = vi.fn();
    const row = { id: 'thread_1', eventId: 'event_1', subject: 'Parking', status: 'open', createdBy: supplier.id, createdAt: new Date(), updatedAt: new Date(), participants: [], messages: [] };
    const tx = { opsCommunicationThread: { create: vi.fn(async () => ({ id: 'thread_1', subject: 'Parking' })), findUnique: vi.fn(async () => row) }, opsCommunicationParticipant: { createMany } };
    const prisma = { $transaction: vi.fn(async (fn: (db: typeof tx) => unknown) => fn(tx)) };
    const listPmcmAdmins = vi.fn(async () => [pmcm]);
    const service = new CommunicationService(prisma as never, { requireActorRole: vi.fn() } as never, { resolveForEvent, listPmcmAdmins, displayNames: vi.fn(async () => new Map()) } as never, { write: vi.fn() } as never, { write: vi.fn() } as never);
    return { service, supplier, createMany };
  }

  it('sends a booked supplier thread to the PMCM admins', async () => {
    const { service, supplier, createMany } = threadHarness();
    await service.createThread({ eventId: 'event_1', subject: 'Parking' }, supplier);
    expect(createMany.mock.calls[0][0].data.map((member: { actorId: string }) => member.actorId)).toEqual(['u_supplier', 'u_pmcm']);
  });

  it('never lets a supplier choose who joins a thread', async () => {
    const { service, supplier, createMany } = threadHarness();
    await expect(service.createThread({ eventId: 'event_1', subject: 'Parking', participantActorIds: ['u_client'] }, supplier)).rejects.toBeInstanceOf(ForbiddenException);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('rejects a supplier without a booking on the event', async () => {
    const { service, supplier, createMany } = threadHarness(vi.fn(async () => { throw new ForbiddenException('Not on this event'); }));
    await expect(service.createThread({ eventId: 'event_1', subject: 'Parking' }, supplier)).rejects.toBeInstanceOf(ForbiddenException);
    expect(createMany).not.toHaveBeenCalled();
  });
});

type InboxMessage = { id: string; threadId: string; senderId: string; senderRole: string; body: string; createdAt: Date };
type StoredThread = { id: string; eventId: string; subject: string; status: 'open' | 'closed'; updatedAt: Date; lastReadAt: Date | null; messages: InboxMessage[] };
type OrClause = { subject?: { contains: string }; eventId?: { in: string[] }; messages?: { some: { body: { contains: string } } } };
/** A keyset clause: either "older than this activity" or "same activity, id before this one". */
type CursorClause = { updatedAt: { lt: Date } | Date; id?: { lt: string } };
type ThreadWhere = { eventId?: string | { in: string[] }; status?: string; OR?: OrClause[]; AND?: Array<{ OR: CursorClause[] }> };

const inboxActor = { id: 'u_supplier', name: 'Bloom Florals', email: 'bloom@example.test', role: 'supplier', explicit: true, verified: true } as const;
const eventNames: Record<string, string> = { event_a: 'Founders gala', event_b: 'Product expo' };

/** Mirrors the unread rule the service asks for in one grouped count: someone else's message after this account's read time. */
function groupUnread(messages: InboxMessage[], where: { senderId: { not: string }; OR: Array<{ threadId: string; createdAt?: { gt: Date } }> }) {
  const counts = new Map<string, number>();
  for (const message of messages) {
    if (message.senderId === where.senderId.not) continue;
    const counted = where.OR.some((clause) => clause.threadId === message.threadId && (!clause.createdAt || message.createdAt > clause.createdAt.gt));
    if (counted) counts.set(message.threadId, (counts.get(message.threadId) ?? 0) + 1);
  }
  return [...counts].map(([threadId, count]) => ({ threadId, _count: { _all: count } }));
}

function matchesClause(thread: StoredThread, clause: OrClause) {
  if (clause.subject) return thread.subject.toLowerCase().includes(clause.subject.contains.toLowerCase());
  if (clause.eventId) return clause.eventId.in.includes(thread.eventId);
  return thread.messages.some((message) => message.body.toLowerCase().includes(clause.messages!.some.body.contains.toLowerCase()));
}

function matchesWhere(thread: StoredThread, where: ThreadWhere) {
  if (typeof where.eventId === 'string' && where.eventId !== thread.eventId) return false;
  if (where.eventId && typeof where.eventId !== 'string' && !where.eventId.in.includes(thread.eventId)) return false;
  if (where.status && where.status !== thread.status) return false;
  return !where.OR || where.OR.some((clause) => matchesClause(thread, clause));
}

function passesCursor(thread: StoredThread, where: ThreadWhere) {
  const clauses: CursorClause[] = where.AND?.[0]?.OR ?? [];
  return !clauses.length || clauses.some((clause) => (clause.updatedAt instanceof Date
    ? thread.updatedAt.getTime() === clause.updatedAt.getTime() && thread.id < (clause.id?.lt ?? '')
    : thread.updatedAt < clause.updatedAt.lt));
}

/** A small in-memory store for the thread and message queries the service makes, honouring membership, scope, status, search, keyset order and take. */
function inboxStore(threads: StoredThread[], readable: string[] = Object.keys(eventNames), access = { requireActorRole: vi.fn() }) {
  const newestFirst = (a: StoredThread, b: StoredThread) => b.updatedAt.getTime() - a.updatedAt.getTime() || (a.id < b.id ? 1 : -1);
  const messagesFor = (thread: StoredThread, take: number) => [...thread.messages].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1)).slice(0, take);
  const toRow = (thread: StoredThread, messageTake: number) => ({
    id: thread.id, eventId: thread.eventId, subject: thread.subject, status: thread.status, createdBy: 'u_pmcm', createdAt: thread.updatedAt, updatedAt: thread.updatedAt,
    participants: [
      { id: `${thread.id}_me`, actorId: inboxActor.id, actorRole: 'supplier', active: true, lastReadAt: thread.lastReadAt },
      { id: `${thread.id}_client`, actorId: 'u_client', actorRole: 'client', active: true, lastReadAt: null },
    ],
    messages: messagesFor(thread, messageTake),
  });
  const db = {
    opsCommunicationThread: {
      findMany: vi.fn(async (args: { where?: ThreadWhere; distinct?: string[]; take?: number; select: { messages: { take: number } } | { participants: unknown } }) => {
        if (args.distinct) return [...new Set(threads.map((thread) => thread.eventId))].map((eventId) => ({ eventId }));
        const where = args.where ?? {};
        const rows = threads.filter((thread) => matchesWhere(thread, where) && passesCursor(thread, where)).sort(newestFirst);
        const messageTake = 'messages' in args.select ? args.select.messages.take : 0;
        return rows.slice(0, args.take ?? rows.length).map((thread) => toRow(thread, messageTake));
      }),
    },
    opsCommunicationMessage: {
      groupBy: vi.fn(async ({ where }: { where: Parameters<typeof groupUnread>[1] }) => groupUnread(threads.flatMap((thread) => thread.messages), where)),
    },
    opsEvent: {
      findMany: vi.fn(async ({ where }: { where?: { id?: { in: string[] }; eventName?: { contains: string } } } = {}) => Object.entries(eventNames)
        .filter(([id, name]) => (!where?.id?.in || where.id.in.includes(id)) && (!where?.eventName?.contains || name.toLowerCase().includes(where.eventName.contains.toLowerCase())))
        .map(([id, eventName]) => ({ id, eventName }))),
    },
  };
  const participants = {
    // Like the real reader: an event the account cannot read is refused by resolveForEvent, and dropped from the inbox.
    readableEventIds: vi.fn(async (_actorId: string, ids: string[]) => new Set(ids.filter((id) => readable.includes(id)))),
    resolveForEvent: vi.fn(async (_actorId: string, eventId: string) => { if (!readable.includes(eventId)) throw new ForbiddenException('Not on this event'); return inboxActor; }),
    displayNames: vi.fn(async () => new Map([['u_client', 'Ana Reyes'], ['u_supplier', 'Bloom Florals']])),
  };
  const service = new CommunicationService(db as never, access as never, participants as never, { write: vi.fn() } as never, { write: vi.fn() } as never);
  return { service, db, participants };
}

const firstPage = { limit: 30, status: 'open' as const };
const at = new Date('2026-11-12T08:00:00.000Z');
function threadAt(id: string, eventId: string, minutes: number, extra: Partial<StoredThread> & { body?: string } = {}): StoredThread {
  const { body = `Message in ${id}`, ...rest } = extra;
  const updatedAt = new Date(at.getTime() + minutes * 60_000);
  return { id, eventId, subject: `Topic ${id}`, status: 'open', updatedAt, lastReadAt: null, messages: [{ id: `${id}_m`, threadId: id, senderId: 'u_client', senderRole: 'client', body, createdAt: updatedAt }], ...rest };
}

describe('CommunicationService inbox', () => {
  it('lists each conversation with its event, latest message, unread count and member names, never their read times', async () => {
    const { service } = inboxStore([
      threadAt('thread_a', 'event_a', 2, { body: 'Can we move load-in?' }),
      { ...threadAt('thread_b', 'event_b', 1), messages: [] },
    ]);
    const page = await service.listInbox(firstPage, inboxActor);
    expect(page.items).toEqual([
      expect.objectContaining({ id: 'thread_a', eventName: 'Founders gala', unreadCount: 1, lastMessage: expect.objectContaining({ body: 'Can we move load-in?', senderName: 'Ana Reyes' }) }),
      expect.objectContaining({ id: 'thread_b', eventName: 'Product expo', unreadCount: 0, lastMessage: null }),
    ]);
    expect(page.items[0]).not.toHaveProperty('messages');
    expect(page.items[0].participants.find((member) => member.actorId === 'u_client')).not.toHaveProperty('lastReadAt');
  });

  it('only reads conversations where the account is an active member, and asks for readability before paging', async () => {
    const { service, db, participants } = inboxStore([threadAt('thread_a', 'event_a', 2), threadAt('thread_b', 'event_b', 1)]);
    await service.listInbox(firstPage, inboxActor);
    expect(db.opsCommunicationThread.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ distinct: ['eventId'], where: { participants: { some: { actorId: 'u_supplier', active: true } } } }));
    expect(participants.readableEventIds).toHaveBeenCalledWith('u_supplier', ['event_a', 'event_b']);
    expect(db.opsCommunicationThread.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: expect.objectContaining({ eventId: { in: ['event_a', 'event_b'] }, status: 'open' }), take: 31 }));
  });

  it('hides conversations for an event the account can no longer read, and does not let them shorten a page', async () => {
    const { service } = inboxStore([threadAt('thread_other', 'event_b', 3), threadAt('thread_a', 'event_a', 2), threadAt('thread_c', 'event_a', 1)], ['event_a']);
    const page = await service.listInbox({ limit: 2, status: 'open' }, inboxActor);
    expect(page.items.map((row) => row.id)).toEqual(['thread_a', 'thread_c']);
    expect(page.hasMore).toBe(false);
  });

  it('pages most recent first with a keyset cursor, and the next page continues without overlap', async () => {
    const threads = [threadAt('thread_1', 'event_a', 5), threadAt('thread_2', 'event_a', 4), threadAt('thread_3', 'event_a', 3), threadAt('thread_4', 'event_a', 3)];
    const { service } = inboxStore(threads);
    const first = await service.listInbox({ limit: 2, status: 'open' }, inboxActor);
    expect(first).toMatchObject({ limit: 2, hasMore: true });
    expect(first.items.map((row) => row.id)).toEqual(['thread_1', 'thread_2']);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await service.listInbox({ limit: 2, status: 'open', cursor: first.nextCursor! }, inboxActor);
    expect(second.items.map((row) => row.id)).toEqual(['thread_4', 'thread_3']);
    expect(second).toMatchObject({ hasMore: false, nextCursor: null });
  });

  it('rejects a malformed cursor', async () => {
    const { service } = inboxStore([threadAt('thread_1', 'event_a', 1)]);
    await expect(service.listInbox({ limit: 2, status: 'open', cursor: 'not-a-cursor' }, inboxActor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('searches subject, event name and message text, case-insensitively, after membership and readability', async () => {
    const { service } = inboxStore([
      threadAt('thread_subject', 'event_b', 4, { body: 'nothing relevant' }),
      threadAt('thread_event', 'event_a', 3, { body: 'nothing relevant' }),
      threadAt('thread_body', 'event_b', 2, { body: 'Please bring the TENT poles' }),
      threadAt('thread_other', 'event_a', 1, { body: 'tent again' }),
    ]);
    const bySubject = await service.listInbox({ limit: 30, status: 'open', q: 'TOPIC thread_subject' }, inboxActor);
    expect(bySubject.items.map((row) => row.id)).toEqual(['thread_subject']);
    const byEvent = await service.listInbox({ limit: 30, status: 'open', q: 'gala' }, inboxActor);
    expect(byEvent.items.map((row) => row.id)).toEqual(['thread_event', 'thread_other']);
    const byBody = await service.listInbox({ limit: 30, status: 'open', q: 'tent poles' }, inboxActor);
    expect(byBody.items.map((row) => row.id)).toEqual(['thread_body']);
  });

  it('lists only closed conversations when asked for the closed status, and blank search means no search', async () => {
    const { service } = inboxStore([threadAt('thread_open', 'event_a', 2), { ...threadAt('thread_closed', 'event_a', 1), status: 'closed' }]);
    expect((await service.listInbox({ limit: 30, status: 'closed' }, inboxActor)).items.map((row) => row.id)).toEqual(['thread_closed']);
    expect((await service.listInbox({ limit: 30, status: 'open', q: '' }, inboxActor)).items.map((row) => row.id)).toEqual(['thread_open']);
  });

  it("pages one event's conversations by its own cursor, and refuses an event the account cannot read", async () => {
    const { service } = inboxStore([threadAt('thread_1', 'event_a', 3), threadAt('thread_2', 'event_b', 2), threadAt('thread_3', 'event_a', 1)], ['event_a']);
    const first = await service.listThreads({ eventId: 'event_a', limit: 1, status: 'open' }, inboxActor);
    expect(first).toMatchObject({ limit: 1, hasMore: true, items: [expect.objectContaining({ id: 'thread_1' })] });
    const second = await service.listThreads({ eventId: 'event_a', limit: 1, status: 'open', cursor: first.nextCursor! }, inboxActor);
    expect(second).toMatchObject({ hasMore: false, nextCursor: null, items: [expect.objectContaining({ id: 'thread_3' })] });
    await expect(service.listThreads({ eventId: 'event_b', limit: 1, status: 'open' }, inboxActor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires a verified account', async () => {
    const { service, db } = inboxStore([]);
    await expect(service.listInbox(firstPage, { ...inboxActor, id: undefined })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.opsCommunicationThread.findMany).not.toHaveBeenCalled();
  });

  it('counts unread messages only in conversations on events the account can read', async () => {
    const threads = [threadAt('thread_a', 'event_a', 2), threadAt('thread_b', 'event_b', 1)];
    await expect(inboxStore(threads).service.unreadCount({}, inboxActor)).resolves.toEqual({ unread: 2 });
    await expect(inboxStore(threads, ['event_b']).service.unreadCount({}, inboxActor)).resolves.toEqual({ unread: 1 });
  });

  it("counts only the named event's unread messages, and refuses an event the account cannot read", async () => {
    const threads = [threadAt('thread_a', 'event_a', 2), { ...threadAt('thread_b', 'event_b', 1), messages: [] }];
    const { service, db } = inboxStore(threads);
    await expect(service.unreadCount({ eventId: 'event_b' }, inboxActor)).resolves.toEqual({ unread: 0 });
    await expect(service.unreadCount({ eventId: 'event_a' }, inboxActor)).resolves.toEqual({ unread: 1 });
    expect(db.opsCommunicationThread.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ eventId: 'event_a', status: 'open' }) }));
    const locked = inboxStore(threads, ['event_b']);
    await expect(locked.service.unreadCount({ eventId: 'event_a' }, inboxActor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(locked.db.opsCommunicationMessage.groupBy).not.toHaveBeenCalled();
  });

  it('counts unread across more than the first hundred open conversations', async () => {
    const threads = Array.from({ length: 120 }, (_, index) => threadAt(`thread_${String(index).padStart(3, '0')}`, 'event_a', index));
    const { service, db } = inboxStore(threads);
    await expect(service.unreadCount({}, inboxActor)).resolves.toEqual({ unread: 120 });
    expect(db.opsCommunicationThread.findMany).toHaveBeenCalledWith(expect.not.objectContaining({ take: expect.anything() }));
    expect(db.opsCommunicationMessage.groupBy).toHaveBeenCalledTimes(1);
  });

  it('rejects an unverified account and a role outside the inbox, without reading conversations', async () => {
    const { service, db } = inboxStore([threadAt('thread_a', 'event_a', 1)]);
    await expect(service.unreadCount({}, { ...inboxActor, id: undefined })).rejects.toBeInstanceOf(BadRequestException);
    const forbidden = inboxStore([threadAt('thread_a', 'event_a', 1)], undefined, { requireActorRole: vi.fn(() => { throw new ForbiddenException('Not allowed'); }) });
    await expect(forbidden.service.unreadCount({}, inboxActor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.opsCommunicationThread.findMany).not.toHaveBeenCalled();
    expect(forbidden.db.opsCommunicationThread.findMany).not.toHaveBeenCalled();
  });
});

const people = {
  u_pmcm: { id: 'u_pmcm', name: 'PMCM Admin', email: 'pmcm@example.test', role: 'pmcm-admin', explicit: true, verified: true },
  u_client: { id: 'u_client', name: 'Ana Reyes', email: 'ana@example.test', role: 'client', explicit: true, verified: true },
  u_supplier: { id: 'u_supplier', name: 'Bloom Florals', email: 'bloom@example.test', role: 'supplier', explicit: true, verified: true },
  u_coord: { id: 'u_coord', name: 'Cora', email: 'cora@example.test', role: 'coordinator', explicit: true, verified: true },
} as const;
type PersonId = keyof typeof people;
const pmcm = people.u_pmcm;

/** A stateful stand-in for the thread's members and status, so each mutation is checked against what changed. */
/** The argument of the last call to a mocked writer, so tests can read the audit or notice row that was written. */
function lastWrite(mock: { mock: { calls: unknown[][] } }) {
  return mock.mock.calls[mock.mock.calls.length - 1]?.[0];
}

type StoredMessage = { id: string; threadId: string; senderId: string; senderRole: string; body: string; createdAt: Date };

function managementHarness(options: { status?: string; members?: Array<{ actorId: PersonId; active?: boolean }>; messages?: StoredMessage[] } = {}) {
  const state: { status: string; members: Array<{ actorId: string; actorRole: string; active: boolean; lastReadAt: Date | null }>; messages: StoredMessage[] } = {
    status: options.status ?? 'open',
    messages: options.messages ?? [],
    members: (options.members ?? [{ actorId: 'u_pmcm' }, { actorId: 'u_client' }, { actorId: 'u_supplier' }] as Array<{ actorId: PersonId; active?: boolean }>)
      .map(({ actorId, active = true }) => ({ actorId, actorRole: people[actorId].role, active, lastReadAt: null })),
  };
  const find = (actorId: string) => state.members.find((member) => member.actorId === actorId);
  const activeMembers = () => state.members.filter((member) => member.active);
  const thread = () => ({
    id: 'thread_1', eventId: 'event_1', subject: 'Parking', status: state.status, createdBy: 'u_pmcm', createdAt: new Date('2026-11-12T08:00:00.000Z'), updatedAt: new Date('2026-11-12T08:00:00.000Z'),
    participants: activeMembers().map((member) => ({ id: `participant_${member.actorId}`, actorId: member.actorId, actorRole: member.actorRole, active: true, lastReadAt: member.lastReadAt })),
    messages: [],
  });
  const db = {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
    opsCommunicationThread: {
      findUnique: vi.fn(async () => thread()),
      update: vi.fn(async ({ data }: { data: { status?: string } }) => { if (data.status) state.status = data.status; return thread(); }),
      findMany: vi.fn(async ({ where }: { where: { participants: { some: { actorId: string } } } }) => (find(where.participants.some.actorId)?.active ? [thread()] : [])),
    },
    opsCommunicationParticipant: {
      findFirst: vi.fn(async ({ where }: { where: { actorId: string } }) => (find(where.actorId)?.active ? { id: 'member' } : null)),
      findMany: vi.fn(async ({ where }: { where?: { actorId?: { in: string[] } } } = {}) => activeMembers().filter((member) => !where?.actorId?.in || where.actorId.in.includes(member.actorId)).map((member) => ({ actorId: member.actorId, actorRole: member.actorRole, actorEmail: people[member.actorId as PersonId].email }))),
      upsert: vi.fn(async ({ where, create, update }: { where: { threadId_actorId: { actorId: string } }; create: { actorId: string; actorRole: string; lastReadAt: Date }; update: { actorRole: string; lastReadAt: Date } }) => {
        const existing = find(where.threadId_actorId.actorId);
        if (existing) Object.assign(existing, { active: true, actorRole: update.actorRole, lastReadAt: update.lastReadAt });
        else state.members.push({ actorId: create.actorId, actorRole: create.actorRole, active: true, lastReadAt: create.lastReadAt });
      }),
      update: vi.fn(async ({ where, data }: { where: { threadId_actorId: { actorId: string } }; data: { active: boolean } }) => { Object.assign(find(where.threadId_actorId.actorId)!, data); }),
    },
    opsCommunicationMessage: {
      findUnique: vi.fn(async () => null),
      groupBy: vi.fn(async ({ where }: { where: Parameters<typeof groupUnread>[1] }) => groupUnread(state.messages, where)),
      create: vi.fn(async ({ data }: { data: { threadId: string; senderId: string; senderRole: string; body: string; payloadHash: string } }) => {
        const message = { id: `msg_${state.messages.length + 1}`, threadId: data.threadId, senderId: data.senderId, senderRole: data.senderRole, body: data.body, createdAt: new Date() };
        state.messages.push(message);
        return { ...message, payloadHash: data.payloadHash };
      }),
    },
    opsEvent: { findUnique: vi.fn(async () => ({ eventName: 'Founders gala' })), findMany: vi.fn(async () => [{ id: 'event_1', eventName: 'Founders gala' }]) },
  };
  const participants = {
    resolveForEvent: vi.fn(async (id: PersonId) => people[id]),
    listEligibleForEvent: vi.fn(async () => [people.u_coord, people.u_client, people.u_pmcm].map(({ id, name, email, role }) => ({ id, name, email, role }))),
    readableEventIds: vi.fn(async () => new Set(['event_1'])),
    displayNames: vi.fn(async (ids: string[]) => new Map(ids.filter((id): id is PersonId => id in people).map((id) => [id, people[id].name]))),
  };
  const audit = { write: vi.fn() };
  const outbox = { write: vi.fn() };
  const service = new CommunicationService(db as never, { requireActorRole: vi.fn() } as never, participants as never, audit as never, outbox as never);
  return { service, db, audit, outbox, activeIds: () => activeMembers().map((member) => member.actorId) };
}

describe('CommunicationService membership and status', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets PMCM add eligible people, reactivates a removed member, audits it, and notifies each added person', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-14T09:00:00.000Z'));
    // Sixty messages were sent before anyone joined; joining must not turn them into unread messages.
    const history = Array.from({ length: 60 }, (_, index) => ({ id: `old_${index}`, threadId: 'thread_1', senderId: 'u_supplier', senderRole: 'supplier', body: `Earlier ${index}`, createdAt: new Date('2026-11-12T08:00:00.000Z') }));
    const h = managementHarness({ members: [{ actorId: 'u_pmcm' }, { actorId: 'u_client', active: false }], messages: history });
    await h.service.addParticipants('thread_1', { actorIds: ['u_coord', 'u_client'] }, pmcm);
    expect(h.activeIds()).toEqual(['u_pmcm', 'u_client', 'u_coord']);
    expect(lastWrite(h.audit.write)).toMatchObject({ eventId: 'event_1', action: expect.stringContaining('Added communication participants'), actionType: 'create', metadata: { addedActorIds: ['u_coord', 'u_client'] } });
    // Each added person gets the email, and the Viber row only where it can be delivered.
    expect(h.outbox.write.mock.calls[0][0]).toMatchObject({ recipient: 'cora@example.test', channel: 'email', message: expect.stringContaining('added you to "Parking" for Founders gala'), action: { kind: 'conversation', eventId: 'event_1', threadId: 'thread_1', portal: 'coordinator' } });
    expect(h.outbox.write.mock.calls.map(([input]) => input.recipient)).toEqual(['cora@example.test', 'cora@example.test', 'ana@example.test', 'ana@example.test']);
    // Right after joining, the history is read: nothing is unread, for a new member or a reactivated one.
    await expect(h.service.unreadCount({}, people.u_coord)).resolves.toEqual({ unread: 0 });
    await expect(h.service.unreadCount({}, people.u_client)).resolves.toEqual({ unread: 0 });
    // The next message from PMCM is the first unread one for each of them.
    vi.setSystemTime(new Date('2026-11-14T09:05:00.000Z'));
    await h.service.sendMessage('thread_1', { body: 'Load-in moved to 2pm', idempotencyKey: 'key_join' }, pmcm);
    await expect(h.service.unreadCount({}, people.u_coord)).resolves.toEqual({ unread: 1 });
    await expect(h.service.unreadCount({}, people.u_client)).resolves.toEqual({ unread: 1 });
  });

  it('refuses a PMCM admin who is not an active member, without returning the conversation', async () => {
    // PMCM can read a conversation only as a member, so a non-member gets nothing from the management routes either.
    const h = managementHarness({ members: [{ actorId: 'u_pmcm', active: false }, { actorId: 'u_client' }, { actorId: 'u_supplier' }] });
    await expect(h.service.addParticipants('thread_1', { actorIds: ['u_coord'] }, pmcm)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(h.service.removeParticipant('thread_1', 'u_client', pmcm)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(h.service.setStatus('thread_1', { status: 'closed' }, pmcm)).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.audit.write).not.toHaveBeenCalled();
    expect(h.db.opsCommunicationParticipant.upsert).not.toHaveBeenCalled();
    expect(h.db.opsCommunicationParticipant.update).not.toHaveBeenCalled();
    expect(h.db.opsCommunicationThread.update).not.toHaveBeenCalled();
  });

  it.each([['client', 'u_client'], ['supplier', 'u_supplier'], ['coordinator', 'u_coord']] as const)('refuses a %s account on add, remove and status changes, writing nothing', async (_role, id) => {
    const h = managementHarness({ members: [{ actorId: 'u_pmcm' }, { actorId: id }] });
    const caller = people[id];
    await expect(h.service.addParticipants('thread_1', { actorIds: ['u_coord'] }, caller)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(h.service.removeParticipant('thread_1', 'u_pmcm', caller)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(h.service.setStatus('thread_1', { status: 'closed' }, caller)).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.audit.write).not.toHaveBeenCalled();
    expect(h.db.opsCommunicationParticipant.upsert).not.toHaveBeenCalled();
    expect(h.db.opsCommunicationParticipant.update).not.toHaveBeenCalled();
    expect(h.db.opsCommunicationThread.update).not.toHaveBeenCalled();
  });

  it('refuses to add someone ineligible for the event, or someone already in the conversation', async () => {
    const h = managementHarness();
    await expect(h.service.addParticipants('thread_1', { actorIds: ['u_stranger'] }, pmcm)).rejects.toBeInstanceOf(BadRequestException);
    await expect(h.service.addParticipants('thread_1', { actorIds: ['u_client'] }, pmcm)).rejects.toBeInstanceOf(BadRequestException);
    expect(h.db.opsCommunicationParticipant.upsert).not.toHaveBeenCalled();
    expect(h.outbox.write).not.toHaveBeenCalled();
  });

  it('removes a member, who then loses the conversation from their inbox and its messages', async () => {
    const h = managementHarness();
    const client = people.u_client;
    await h.service.removeParticipant('thread_1', 'u_client', pmcm);
    expect(h.activeIds()).toEqual(['u_pmcm', 'u_supplier']);
    expect(lastWrite(h.audit.write)).toMatchObject({ action: 'Removed communication participant: thread_1', actionType: 'delete', metadata: { removedActorId: 'u_client' } });
    await expect(h.service.listMessages('thread_1', {}, client)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(h.service.listInbox(firstPage, client)).resolves.toMatchObject({ items: [] });
    await expect(h.service.unreadCount({}, client)).resolves.toEqual({ unread: 0 });
    // The conversation is still in the inbox of a member who stayed.
    expect((await h.service.listInbox(firstPage, people.u_supplier)).items.map((row) => row.id)).toEqual(['thread_1']);
    // A conversation is opened by id only for a member; the removed member is refused, as its messages are.
    await expect(h.service.getThread('thread_1', people.u_supplier)).resolves.toMatchObject({ id: 'thread_1', status: 'open' });
    await expect(h.service.getThread('thread_1', client)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a removal that leaves no PMCM member, or fewer than two members, and a person who is not in the conversation', async () => {
    const noPmcm = managementHarness();
    await expect(noPmcm.service.removeParticipant('thread_1', 'u_pmcm', pmcm)).rejects.toThrow(/PMCM member/);
    const tooFew = managementHarness({ members: [{ actorId: 'u_pmcm' }, { actorId: 'u_client' }] });
    await expect(tooFew.service.removeParticipant('thread_1', 'u_client', pmcm)).rejects.toThrow(/at least two members/);
    const absent = managementHarness();
    await expect(absent.service.removeParticipant('thread_1', 'u_coord', pmcm)).rejects.toBeInstanceOf(NotFoundException);
    for (const h of [noPmcm, tooFew, absent]) {
      expect(h.audit.write).not.toHaveBeenCalled();
      expect(h.db.opsCommunicationParticipant.update).not.toHaveBeenCalled();
    }
  });

  it('closes a conversation, refusing new messages with 409, and accepts messages again once reopened', async () => {
    const h = managementHarness();
    await h.service.setStatus('thread_1', { status: 'closed' }, pmcm);
    expect(lastWrite(h.audit.write)).toMatchObject({ action: 'Closed communication thread: thread_1', actionType: 'update', metadata: { status: 'closed' } });
    await expect(h.service.sendMessage('thread_1', { body: 'Hello', idempotencyKey: 'key_1' }, people.u_client)).rejects.toBeInstanceOf(ConflictException);
    expect(h.db.opsCommunicationMessage.create).not.toHaveBeenCalled();
    await h.service.setStatus('thread_1', { status: 'open' }, pmcm);
    await expect(h.service.sendMessage('thread_1', { body: 'Hello', idempotencyKey: 'key_2' }, people.u_client)).resolves.toMatchObject({ body: 'Hello' });
    expect(h.db.opsCommunicationMessage.create).toHaveBeenCalledTimes(1);
  });

  it('does not count messages in closed conversations toward the unread count', async () => {
    const { service, db } = inboxStore([threadAt('thread_open', 'event_a', 2), { ...threadAt('thread_closed', 'event_a', 1), status: 'closed' }]);
    await expect(service.unreadCount({}, inboxActor)).resolves.toEqual({ unread: 1 });
    expect(db.opsCommunicationThread.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'open' }) }));
  });
});

describe('new-message notices', () => {
  it('says who wrote, where, and the start of the message', () => {
    expect(newMessageNotice({ senderName: 'Ana Reyes', senderRole: 'client', subject: 'Stage setup', eventName: 'Founders gala', body: 'Can we move\n\nload-in to 2pm?' }))
      .toBe('New message from Ana Reyes (Client) in "Stage setup" for Founders gala: Can we move load-in to 2pm?');
    // A sender whose name is only their role is not named twice.
    expect(newMessageNotice({ senderName: 'PMCM', senderRole: 'pmcm-admin', subject: 'Parking', body: 'Passes are ready' })).toBe('New message from PMCM in "Parking": Passes are ready');
    const long = newMessageNotice({ senderName: 'Bloom Florals', senderRole: 'supplier', subject: 'Flowers', body: 'x'.repeat(500) });
    expect(long.endsWith(`${'x'.repeat(139)}…`)).toBe(true);
  });

  it.each([['pmcm-admin', 'event'], ['client', 'client'], ['supplier', 'supplier'], ['coordinator', 'coordinator']])('queues both channels with the %s recipient portal', async (role, portal) => {
    const sender = { id: 'u_client', name: 'Ana Reyes', email: 'ana@example.test', role: 'client', explicit: true, verified: true } as const;
    const created = { id: 'msg_1', threadId: 'thread_1', senderId: sender.id, senderRole: 'client', body: 'Can we move load-in?', payloadHash: 'hash', createdAt: new Date() };
    const tx = {
      $queryRaw: vi.fn(),
      opsCommunicationParticipant: { findFirst: vi.fn(async () => ({ id: 'member' })), findMany: vi.fn(async () => [{ actorEmail: 'mys@pmcm.test', actorRole: role }, { actorEmail: null, actorRole: role }]) },
      opsCommunicationMessage: { findUnique: vi.fn(async () => null), create: vi.fn(async () => created) },
      opsCommunicationThread: { update: vi.fn(), findUnique: vi.fn(async () => ({ subject: 'Stage setup' })) },
      opsEvent: { findUnique: vi.fn(async () => ({ eventName: 'Founders gala' })) },
    };
    const prisma = { opsCommunicationThread: { findUnique: vi.fn(async () => ({ id: 'thread_1', eventId: 'event_1' })) }, $transaction: vi.fn(async (fn: (db: typeof tx) => unknown) => fn(tx)) };
    const outbox = { write: vi.fn() };
    const service = new CommunicationService(prisma as never, { requireActorRole: vi.fn() } as never, { resolveForEvent: vi.fn(async () => sender) } as never, { write: vi.fn() } as never, outbox as never);

    await expect(service.sendMessage('thread_1', { body: 'Can we move load-in?', idempotencyKey: 'key_1' }, sender)).resolves.toMatchObject({ id: 'msg_1', senderName: 'Ana Reyes' });

    // A member without an email address gets nothing; the other gets one row per channel.
    expect(outbox.write.mock.calls.map(([input]) => [input.recipient, input.channel, input.idempotencyKey])).toEqual([
      ['mys@pmcm.test', 'email', 'communication-message:msg_1:email:mys@pmcm.test'],
      ['mys@pmcm.test', 'viber', 'communication-message:msg_1:viber:mys@pmcm.test'],
    ]);
    expect(outbox.write.mock.calls[0][0]).toMatchObject({
      eventId: 'event_1',
      message: 'New message from Ana Reyes (Client) in "Stage setup" for Founders gala: Can we move load-in?',
      action: { kind: 'conversation', eventId: 'event_1', threadId: 'thread_1', portal },
    });
  });
});

describe('CommunicationService message guards', () => {
  it('rejects a removed member inside the transaction', async () => {
    const { service, actor } = harness({ removed: true });
    await expect(service.sendMessage('thread_1', { body: 'hello', idempotencyKey: 'key_1' }, actor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a changed replay payload without creating or auditing', async () => {
    const { service, actor, tx } = harness({ replay: { body: 'different' } });
    await expect(service.sendMessage('thread_1', { body: 'hello', idempotencyKey: 'key_1' }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.opsCommunicationMessage.upsert).not.toHaveBeenCalled();
    expect(tx.opsCommunicationMessage.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { threadId_idempotencyKey: { threadId: 'thread_1', idempotencyKey: 'key_1' } } }));
  });
});
