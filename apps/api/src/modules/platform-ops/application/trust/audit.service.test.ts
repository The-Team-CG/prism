import { describe, expect, it } from 'vitest';
import { AuditService } from './audit.service';

function auditRow(overrides: Record<string, unknown> = {}) {
  return {
    id: `aud_${Math.random()}`,
    eventId: null,
    actor: 'PMCM Admin',
    actorRole: 'pmcm-admin',
    actorEmail: null,
    action: 'Viewed event',
    actionType: 'general',
    category: 'events',
    affectedType: null,
    affectedId: null,
    affectedLabel: null,
    metadata: {},
    ipAddress: '192.168.1.5',
    device: 'Local sample browser',
    severity: 'info',
    immutableHash: 'hash',
    previousHash: null,
    createdAt: new Date('2026-04-29T09:00:00.000Z'),
    ...overrides,
  };
}

describe('AuditService', () => {
  it('uses explicit unknown metadata when login request context is unavailable', async () => {
    const create = async ({ data }: { data: unknown }) => data;
    const prisma = { opsLoginHistory: { create } };
    const service = new AuditService(prisma as never);
    await expect(service.recordLoginHistory(null, 'missing@example.test', 'failed', 'Unknown email')).resolves.toMatchObject({
      ipAddress: 'unknown',
      device: 'unknown',
    });
  });

  it('resolves a same-time history tail from links before appending', async () => {
    const created: any[] = [];
    const root = { id: 'aud_root', immutableHash: 'hash_root', previousHash: null, createdAt: new Date('2026-04-29T09:00:00.000Z') };
    const tail = { id: 'aud_tail', immutableHash: 'hash_tail', previousHash: 'hash_root', createdAt: root.createdAt };
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback(prisma),
      opsAuditChainLock: { update: async () => ({ id: 'global', revision: 1 }) },
      opsAuditLog: {
        findMany: async () => [tail, root],
        create: async ({ data }: { data: any }) => { created.push(data); return data; },
      },
    };
    const service = new AuditService(prisma as never);
    await service.audit(undefined, 'PMCM Admin', 'Appended after tied history');
    expect(created[0]).toMatchObject({ previousHash: 'hash_tail' });
  });

  it('exports logs and creates a security alert when the bulk threshold is reached', async () => {
    const rows = Array.from({ length: 25 }, (_, index) => auditRow({ id: `aud_${index}` }));
    const createdAuditRows: unknown[] = [];
    const alerts: unknown[] = [];
    const notifications: unknown[] = [];
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback(prisma),
      opsAuditChainLock: { update: async () => ({ id: 'global', revision: 1 }) },
      opsAuditLog: {
        findMany: async ({ orderBy }: { orderBy?: unknown } = {}) => Array.isArray(orderBy) ? [] : rows,
        findFirst: async () => null,
        create: async ({ data }: { data: unknown }) => {
          createdAuditRows.push(data);
          return data;
        },
      },
      opsSecurityAlert: {
        findMany: async () => alerts,
        create: async ({ data }: { data: unknown }) => {
          alerts.push(data);
          return data;
        },
      },
      opsUser: {
        findFirst: async () => ({ email: 'trust@example.test' }),
      },
      opsNotificationLog: {
        create: async ({ data }: { data: unknown }) => { notifications.push(data); return data; },
        upsert: async ({ create }: { create: unknown }) => { notifications.push(create); return create; },
      },
    };

    const outbox = { queue: async (...args: unknown[]) => { notifications.push(args); return args; } };
    const service = new AuditService(prisma as never, outbox as never);
    const exported = await service.exportAuditLogs({}, { id: 'verified-pmcm-id', name: 'Verified PMCM', role: 'pmcm-admin', email: 'pmcm@example.test' });

    expect(exported.recordCount).toBe(25);
    expect(alerts).toHaveLength(1);
    expect(createdAuditRows).toHaveLength(2);
    expect(notifications).toHaveLength(2);
    expect(notifications).toEqual(expect.arrayContaining([
      expect.arrayContaining(['trust@example.test', 'Bulk audit export threshold exceeded', expect.anything(), expect.objectContaining({ idempotencyKey: expect.stringContaining('security-alert:') })]),
    ]));
    expect(createdAuditRows[0]).toMatchObject({ actor: 'Verified PMCM', actorEmail: 'pmcm@example.test', ipAddress: 'unknown', device: 'unknown', metadata: expect.objectContaining({ actorId: 'verified-pmcm-id' }) });
  });
});

