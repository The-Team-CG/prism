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
