import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { AuditService } from '../../src/modules/platform-ops/application/trust/audit.service';

const url = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(url && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(url));
if (url && !live) throw new Error('Audit tests require isolated 127.0.0.1:55437/prism_p0');

describe.skipIf(!live)('serialized audit append', () => {
  it('orders concurrent appends, rolls back nested audit and rejects a stale serializable snapshot', async () => {
    const prisma = new PrismaService();
    const actor = `p1_audit_${randomUUID()}`;
    const service = new AuditService(prisma);
    try {
      const previous = await prisma.opsAuditLog.findFirst({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      await Promise.all(Array.from({ length: 8 }, (_, index) => service.audit(undefined, actor, `Concurrent action ${index}`, { actorRole: 'system' })));
      const rows = await prisma.opsAuditLog.findMany({ where: { actor }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      expect(rows).toHaveLength(8);
      let precedingHash = previous?.immutableHash || null;
      let precedingTime = previous?.createdAt.getTime() ?? 0;
      for (const row of rows) {
        expect(row.previousHash).toBe(precedingHash);
        expect(row.createdAt.getTime()).toBeGreaterThan(precedingTime);
        precedingHash = row.immutableHash;
        precedingTime = row.createdAt.getTime();
      }
      await expect(prisma.$transaction(async (tx) => {
        await service.audit(undefined, actor, 'Rolled back action', {}, { prisma: tx, correlationId: 'rollback-test' });
        throw new Error('rollback intentionally');
      })).rejects.toThrow('rollback intentionally');
      expect(await prisma.opsAuditLog.count({ where: { actor, action: 'Rolled back action' } })).toBe(0);

      let snapshotReady!: () => void;
      let allowAppend!: () => void;
      const ready = new Promise<void>((resolve) => { snapshotReady = resolve; });
      const proceed = new Promise<void>((resolve) => { allowAppend = resolve; });
      const stale = prisma.$transaction(async (tx) => {
        await tx.opsAuditChainLock.findUniqueOrThrow({ where: { id: 'global' } });
        snapshotReady();
        await proceed;
        return service.audit(undefined, actor, 'Stale snapshot action', {}, { prisma: tx, correlationId: 'snapshot-test' });
      }, { isolationLevel: 'Serializable', timeout: 10_000 });
      const staleResult = stale.then(() => null, (error: unknown) => error);
      await ready;
      await service.audit(undefined, actor, 'New committed action');
      allowAppend();
      expect(await staleResult).toMatchObject({ code: 'P2034' });
      expect(await prisma.opsAuditLog.count({ where: { actor, action: 'Stale snapshot action' } })).toBe(0);
    } finally {
      // Remove this fixture's tail only; never erase historical evidence to pass verification.
      await prisma.opsAuditLog.deleteMany({ where: { actor } });
      await prisma.$disconnect();
    }
  });
});
