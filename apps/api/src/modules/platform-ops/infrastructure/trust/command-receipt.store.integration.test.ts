import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { PlatformCommandReceiptStore } from './command-receipt.store';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();

function validateDatabaseUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '55437' || parsed.pathname !== '/prism_p0') {
    throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
  }
}

if (databaseUrl) validateDatabaseUrl(databaseUrl);

const databaseSuite = describe.skipIf(!databaseUrl);

databaseSuite('Platform command receipt PostgreSQL invariants', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    if (!databaseUrl) return;
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) {
      process.env[variable] = databaseUrl;
    }
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  async function deleteReceipt(commandName: string, idempotencyKey: string, actorId: string) {
    await prisma.opsCommandReceipt.deleteMany({
      where: { commandName, idempotencyKey, actorId, eventScope: '__global__' },
    });
  }

  it('rolls back the receipt reservation when the command write fails', async () => {
    const commandName = 'pr16_rollback_' + randomUUID();
    const idempotencyKey = randomUUID();
    const actorId = 'pr16_test_actor';
    const store = new PlatformCommandReceiptStore(prisma);
    const service = new WorkflowCommandService(new PrismTransactionRunner(prisma), store);

    try {
      await expect(service.execute({
        name: commandName,
        context: { actorId, actorRole: 'system', correlationId: commandName, idempotencyKey },
        sideEffectMode: 'same_tx',
        idempotencyPayloadHash: 'rollback-payload',
        write: async () => { throw new Error('injected command failure'); },
      })).rejects.toThrow('injected command failure');

      await expect(store.find({ commandName, idempotencyKey, actorId, eventScope: '__global__' })).resolves.toBeNull();
    } finally {
      await deleteReceipt(commandName, idempotencyKey, actorId);
    }
  });

  it('commits one receipt and replays its result after concurrent retries', async () => {
    const commandName = 'pr16_concurrent_' + randomUUID();
    const idempotencyKey = randomUUID();
    const actorId = 'pr16_test_actor';
    const store = new PlatformCommandReceiptStore(prisma);
    const service = new WorkflowCommandService(new PrismTransactionRunner(prisma), store);
    const write = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return { accepted: true, requestId: 'request_1' };
    });
    const command = () => service.execute({
      name: commandName,
      context: { actorId, actorRole: 'system', correlationId: commandName, idempotencyKey },
      sideEffectMode: 'same_tx' as const,
      idempotencyPayloadHash: 'concurrent-payload',
      write,
    });

    try {
      const results = await Promise.all([command(), command()]);
      const lostResponseRetry = await command();

      expect([...results, lostResponseRetry]).toEqual([
        { accepted: true, requestId: 'request_1' },
        { accepted: true, requestId: 'request_1' },
        { accepted: true, requestId: 'request_1' },
      ]);
      expect(write).toHaveBeenCalledTimes(1);
      const receipt = await store.find({ commandName, idempotencyKey, actorId, eventScope: '__global__' });
      expect(receipt).toMatchObject({
        actorRole: 'system',
        payloadHash: 'concurrent-payload',
        result: { accepted: true, requestId: 'request_1' },
      });
    } finally {
      await deleteReceipt(commandName, idempotencyKey, actorId);
    }
  });
});
