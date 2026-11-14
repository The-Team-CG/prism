import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CommunicationService } from './communication.service';

function setup(role = 'coordinator', member = true, eventAccess = true) {
  const actor = { id: 'user', name: 'Marco', role, email: 'marco@example.test', verified: true, explicit: true };
  const thread = { id: 'thread', eventId: 'event', subject: 'Load-in' };
  const participantRows = [{ actorId: 'client', lastReadAt: new Date('2026-11-13T00:00:00Z') }];
  const prisma = {
    opsCommunicationThread: { findUnique: vi.fn(async () => thread), update: vi.fn() },
    opsCommunicationParticipant: { findFirst: vi.fn(async () => member ? { id: 'membership' } : null), findMany: vi.fn(async () => participantRows), updateMany: vi.fn(async () => ({ count: 1 })) },
    opsCommunicationMessage: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null), create: vi.fn(async () => ({ id: 'message', threadId: thread.id, senderId: actor.id, senderRole: role, body: 'Ready', createdAt: new Date() })) },
    opsEvent: { findUnique: vi.fn(async () => ({ eventName: 'Gala' })) },
    $queryRaw: vi.fn(),
  };
  const db = { ...prisma, $transaction: async (run: (tx: typeof prisma) => unknown) => run(prisma) };
  const access = { requireActorRole: vi.fn(async (_actor: unknown, roles: string[]) => { if (!roles.includes(role) || !eventAccess) throw new ForbiddenException('Outside role or event access'); }) };
  const participants = { resolveForEvent: vi.fn(async () => actor), displayNames: vi.fn(async () => new Map([['client', 'Ana']])) };
  const service = new CommunicationService(db as never, access as never, participants as never, { write: vi.fn() } as never, { write: vi.fn() } as never);
  return { service, actor: actor as never, prisma, participants };
}

describe('coordinator conversation access and PMCM read receipts', () => {
  it('lets an assigned active member read, mark read and reply, without creating a conversation', async () => {
    const { service, actor } = setup();
    await expect(service.listMessages('thread', {}, actor)).resolves.toMatchObject({ items: [] });
    await expect(service.markThreadRead('thread', actor)).resolves.toHaveProperty('lastReadAt');
    await expect(service.sendMessage('thread', { body: 'Ready', idempotencyKey: 'reply' }, actor)).resolves.toMatchObject({ senderRole: 'coordinator', body: 'Ready' });
    await expect(service.createThread({ eventId: 'event', subject: 'Private' }, actor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([[false, true], [true, false]])('denies read/reply after membership=%s or event access=%s is removed', async (member, eventAccess) => {
    const { service, actor, prisma } = setup('coordinator', member, eventAccess);
    await expect(service.listMessages('thread', {}, actor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.markThreadRead('thread', actor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.sendMessage('thread', { body: 'Ready', idempotencyKey: 'reply' }, actor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.opsCommunicationMessage.create).not.toHaveBeenCalled();
  });

  it.each(['client', 'supplier', 'coordinator', 'system'])('withholds other members read times from %s even inside their conversation', async (role) => {
    const { service, actor, prisma } = setup(role);
    await expect(service.readReceipts('thread', actor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.opsCommunicationParticipant.findMany).not.toHaveBeenCalled();
  });

  it('returns only named read timestamps to a PMCM member, and rechecks membership and current role', async () => {
    const { service, actor, prisma, participants } = setup('pmcm-admin');
    await expect(service.readReceipts('thread', actor)).resolves.toEqual([{ actorId: 'client', name: 'Ana', lastReadAt: '2026-11-13T00:00:00.000Z' }]);
    expect(prisma.opsCommunicationParticipant.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { threadId: 'thread', active: true }, take: 200 }));
    prisma.opsCommunicationParticipant.findFirst.mockResolvedValueOnce(null);
    await expect(service.readReceipts('thread', actor)).rejects.toBeInstanceOf(ForbiddenException);
    participants.resolveForEvent.mockResolvedValueOnce({ id: 'user', name: 'Marco', role: 'coordinator', email: 'marco@example.test', verified: true, explicit: true });
    await expect(service.readReceipts('thread', actor)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
