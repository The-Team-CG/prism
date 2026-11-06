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
    const service = new CommunicationService(prisma as never, { requireActorRole: vi.fn() } as never, { resolveForEvent, listPmcmAdmins } as never, { write: vi.fn() } as never, { write: vi.fn() } as never);
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
