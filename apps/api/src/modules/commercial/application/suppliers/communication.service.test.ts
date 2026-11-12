import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommunicationService } from './communication.service';

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

describe('CommunicationService inbox', () => {
  const at = new Date('2026-11-12T08:00:00.000Z');
  const reply = { id: 'msg_2', threadId: 'thread_a', senderId: 'u_client', senderRole: 'client', body: 'Can we move load-in?', createdAt: at };
  function thread(id: string, eventId: string, messages = [reply]) {
    return {
      id, eventId, subject: `Topic ${id}`, status: 'open', createdBy: 'u_pmcm', createdAt: at, updatedAt: at,
      participants: [{ id: `${id}_me`, actorId: 'u_supplier', actorRole: 'supplier', active: true, lastReadAt: null }, { id: `${id}_client`, actorId: 'u_client', actorRole: 'client', active: true, lastReadAt: at }],
      messages,
    };
  }
  function inboxHarness(readable: string[]) {
    const supplier = { id: 'u_supplier', name: 'Bloom Florals', email: 'bloom@example.test', role: 'supplier', explicit: true, verified: true } as const;
    const prisma = {
      opsCommunicationThread: { findMany: vi.fn(async () => [thread('thread_a', 'event_a'), thread('thread_b', 'event_b', [])]) },
      opsCommunicationMessage: { findMany: vi.fn(async () => [{ threadId: 'thread_a', createdAt: at }]) },
      opsEvent: { findMany: vi.fn(async () => [{ id: 'event_a', eventName: 'Founders gala' }, { id: 'event_b', eventName: 'Product expo' }]) },
    };
    const participants = { readableEventIds: vi.fn(async () => new Set(readable)), displayNames: vi.fn(async () => new Map([['u_client', 'Ana Reyes'], ['u_supplier', 'Bloom Florals']])) };
    const service = new CommunicationService(prisma as never, { requireActorRole: vi.fn() } as never, participants as never, { write: vi.fn() } as never, { write: vi.fn() } as never);
    return { service, supplier, prisma, participants };
  }

  it('lists each conversation with its event, latest message, unread count and member names, never their read times', async () => {
    const { service, supplier, prisma } = inboxHarness(['event_a', 'event_b']);
    const inbox = await service.listInbox(supplier);
    expect(inbox).toEqual([
      expect.objectContaining({ id: 'thread_a', eventName: 'Founders gala', unreadCount: 1, lastMessage: expect.objectContaining({ body: 'Can we move load-in?', senderName: 'Ana Reyes' }) }),
      expect.objectContaining({ id: 'thread_b', eventName: 'Product expo', unreadCount: 0, lastMessage: null }),
    ]);
    expect(inbox[0].participants).toEqual([
      { id: 'thread_a_me', actorId: 'u_supplier', actorRole: 'supplier', name: 'Bloom Florals', active: true, lastReadAt: null },
      { id: 'thread_a_client', actorId: 'u_client', actorRole: 'client', name: 'Ana Reyes', active: true },
    ]);
    expect(inbox[0]).not.toHaveProperty('messages');
    // Only conversations the account is an active member of are read at all.
    expect(prisma.opsCommunicationThread.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { participants: { some: { actorId: 'u_supplier', active: true } } } }));
  });

  it('hides conversations for an event the account can no longer read', async () => {
    const { service, supplier, participants } = inboxHarness(['event_b']);
    expect((await service.listInbox(supplier)).map((row) => row.id)).toEqual(['thread_b']);
    expect(participants.readableEventIds).toHaveBeenCalledWith('u_supplier', ['event_a', 'event_b']);
  });

  it('requires a verified account', async () => {
    const { service, supplier, prisma } = inboxHarness([]);
    await expect(service.listInbox({ ...supplier, id: undefined })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsCommunicationThread.findMany).not.toHaveBeenCalled();
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
