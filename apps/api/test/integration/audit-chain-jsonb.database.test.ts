import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { AuditService } from '../../src/modules/platform-ops/application/trust/audit.service';
import { verifyAuditIntegrity } from '../../src/modules/platform-ops/application/trust/audit-chain';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const isolatedPortalDatabase = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));
if (databaseUrl && !isolatedPortalDatabase) {
  throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
}

describe.skipIf(!isolatedPortalDatabase)('audit JSONB canonicalization', () => {
  it('verifies an appended audit in Prisma after JSONB key ordering, then rolls it back', async () => {
    const prisma = new PrismaService();
    const audit = new AuditService(prisma);
    const actor = `jsonb_audit_${randomUUID()}`;
    const beforeCount = await prisma.opsAuditLog.count({ where: { actor } });

    try {
      await expect(prisma.$transaction(async (tx) => {
        await tx.opsAuditChainLock.upsert({
          where: { id: 'global' },
          create: { id: 'global', revision: 0 },
          update: {},
        });

        await audit.audit(undefined, actor, 'JSONB metadata ordering regression', {
          actorRole: 'system',
          metadata: {
            requestId: 'request-1',
            ingressAt: '2026-10-16T10:00:00.000Z',
            egressAt: '2026-10-16T12:00:00.000Z',
            lateFlagReset: false,
            '123': 'numeric-index key',
            'é': 'UTF-8 key',
            nested: { alphabet: 'last', beta: 'middle', a: 'first', '9': 'nested numeric-index key', 'é': 'nested UTF-8 key' },
            list: [{ z: 'last key', a: 'first key' }, ['second array entry', 'first array entry']],
          },
        }, { prisma: tx, correlationId: `jsonb-order:${actor}` });

        const integrity = await verifyAuditIntegrity(tx);
        expect(integrity).toMatchObject({ valid: true, checkedCount: expect.any(Number) });
        throw new Error('rollback JSONB audit regression row');
      })).rejects.toThrow('rollback JSONB audit regression row');

      expect(await prisma.opsAuditLog.count({ where: { actor } })).toBe(beforeCount);
      await expect(audit.verifyIntegrity()).resolves.toMatchObject({ valid: true });
    } finally {
      await prisma.$disconnect();
    }
  });
});
