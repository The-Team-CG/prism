import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AuditService } from './audit.service';

type TestAuditRow = {
  id: string;
  eventId: string | null;
  actor: string;
  actorRole: string;
  actorEmail: string | null;
  action: string;
  actionType: string;
  category: string;
  affectedType: string | null;
  affectedId: string | null;
  affectedLabel: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string;
  device: string;
  severity: string;
  immutableHash: string;
  previousHash: string | null;
  createdAt: Date;
};

function expectedHash(row: TestAuditRow) {
  return createHash('sha256').update(JSON.stringify({
    id: row.id,
    eventId: row.eventId,
    actor: row.actor,
    actorRole: row.actorRole,
    actorEmail: row.actorEmail,
    action: row.action,
    actionType: row.actionType,
    category: row.category,
    affectedType: row.affectedType,
    affectedId: row.affectedId,
    affectedLabel: row.affectedLabel,
    metadata: row.metadata,
    ipAddress: row.ipAddress,
    device: row.device,
    severity: row.severity,
    previousHash: row.previousHash,
    createdAt: row.createdAt.toISOString(),
  })).digest('hex');
}

function auditRow(overrides: Partial<TestAuditRow> = {}): TestAuditRow {
  const row: TestAuditRow = {
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
    immutableHash: '',
    previousHash: null,
    createdAt: new Date('2026-04-29T09:00:00.000Z'),
    ...overrides,
  };
  return { ...row, immutableHash: expectedHash(row) };
}

function independentAuditRows() {
  const rootA = auditRow({ id: 'aud_root_a', createdAt: new Date('2026-04-29T09:00:00.000Z') });
  const rootB = auditRow({ id: 'aud_root_b', createdAt: new Date('2026-04-29T09:01:00.000Z') });
  const tailA = auditRow({ id: 'aud_tail_a', previousHash: rootA.immutableHash, createdAt: new Date('2026-04-29T09:02:00.000Z') });
  const tailB = auditRow({ id: 'aud_tail_b', previousHash: rootB.immutableHash, createdAt: new Date('2026-04-29T09:03:00.000Z') });
  return [rootA, tailA, rootB, tailB];
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

  it('keeps authentication available while recording an audit-chain integrity incident', async () => {
    const alerts: unknown[] = [];
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback(prisma),
      opsAuditChainLock: { update: async () => ({ id: 'global', revision: 1 }) },
      opsAuditLog: {
        findMany: async () => independentAuditRows(),
        create: async ({ data }: { data: unknown }) => data,
      },
      opsSecurityAlert: {
        create: async ({ data }: { data: unknown }) => { alerts.push(data); return data; },
      },
    };
    const service = new AuditService(prisma as never);

    await expect(service.recordAuthenticationAudit({
      actor: 'Ana Reyes',
      action: 'Signed in to client portal',
      actorRole: 'client',
      actorEmail: 'ana@example.test',
      actionType: 'login',
      category: 'access',
      affectedType: 'account',
      affectedId: 'usr_client',
    })).resolves.toBeNull();

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: 'audit_integrity_incident',
      severity: 'critical',
      triggeredBy: 'Ana Reyes',
      metadata: expect.objectContaining({ source: 'identity-access.authentication' }),
    });
  });

  it('fails closed when the audit-chain integrity incident cannot be persisted', async () => {
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback(prisma),
      opsAuditChainLock: { update: async () => ({ id: 'global', revision: 1 }) },
      opsAuditLog: {
        findMany: async () => independentAuditRows(),
        create: async ({ data }: { data: unknown }) => data,
      },
      opsSecurityAlert: {
        create: async () => { throw new Error('incident database unavailable'); },
      },
    };
    const service = new AuditService(prisma as never);

    await expect(service.recordAuthenticationAudit({
      actor: 'Ana Reyes',
      action: 'Signed in to client portal',
    })).rejects.toThrow('incident database unavailable');
  });

  it('keeps failed-login lockout handling on its normal path when the audit chain needs review', async () => {
    const updates: unknown[] = [];
    const histories: unknown[] = [];
    const alerts: unknown[] = [];
    const prisma = {
      opsUser: {
        update: async ({ data }: { data: unknown }) => { updates.push(data); return data; },
      },
      opsLoginHistory: {
        create: async ({ data }: { data: unknown }) => { histories.push(data); return data; },
      },
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback(prisma),
      opsAuditChainLock: { update: async () => ({ id: 'global', revision: 1 }) },
      opsAuditLog: {
        findMany: async () => independentAuditRows(),
        create: async ({ data }: { data: unknown }) => data,
      },
      opsSecurityAlert: {
        create: async ({ data }: { data: unknown }) => { alerts.push(data); return data; },
      },
    };
    const service = new AuditService(prisma as never);
    const user = {
      id: 'usr_client',
      name: 'Ana Reyes',
      email: 'ana@example.test',
      role: 'client',
      failedLoginCount: 0,
      lockoutCount: 0,
      permanentLockout: false,
      lockedUntil: null,
    };

    await expect(service.handleFailedLogin(user as never)).resolves.toBeUndefined();
    expect(updates).toHaveLength(1);
    expect(histories).toHaveLength(1);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ type: 'audit_integrity_incident' });
  });

  it('keeps lockout alerts on the normal response path when the audit chain needs review', async () => {
    const histories: unknown[] = [];
    const alerts: unknown[] = [];
    const prisma = {
      opsUser: {
        update: async ({ data }: { data: unknown }) => data,
        findFirst: async () => null,
      },
      opsLoginHistory: {
        create: async ({ data }: { data: unknown }) => { histories.push(data); return data; },
      },
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback(prisma),
      opsAuditChainLock: { update: async () => ({ id: 'global', revision: 1 }) },
      opsAuditLog: {
        findMany: async () => independentAuditRows(),
        create: async ({ data }: { data: unknown }) => data,
      },
      opsSecurityAlert: {
        create: async ({ data }: { data: unknown }) => { alerts.push(data); return data; },
      },
    };
    const service = new AuditService(prisma as never);
    const user = {
      id: 'usr_client',
      name: 'Ana Reyes',
      email: 'ana@example.test',
      role: 'client',
      failedLoginCount: 4,
      lockoutCount: 0,
      permanentLockout: false,
      lockedUntil: null,
    };

    await expect(service.handleFailedLogin(user as never)).resolves.toBeUndefined();
    expect(histories).toHaveLength(1);
    expect(alerts).toHaveLength(3);
    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'account_lockout' }),
      expect.objectContaining({ type: 'audit_integrity_incident' }),
    ]));
  });

  it('keeps repeated-forbidden alerts on the normal response path when the audit chain needs review', async () => {
    const histories: unknown[] = [];
    const alerts: unknown[] = [];
    const prisma = {
      opsUser: { findFirst: async () => null },
      opsLoginHistory: {
        create: async ({ data }: { data: unknown }) => { histories.push(data); return data; },
        count: async () => 3,
      },
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback(prisma),
      opsAuditChainLock: { update: async () => ({ id: 'global', revision: 1 }) },
      opsAuditLog: {
        findMany: async () => independentAuditRows(),
        create: async ({ data }: { data: unknown }) => data,
      },
      opsSecurityAlert: {
        create: async ({ data }: { data: unknown }) => { alerts.push(data); return data; },
      },
    };
    const service = new AuditService(prisma as never);
    const user = { id: 'usr_client', name: 'Ana Reyes', email: 'ana@example.test', role: 'client' };

    await expect(service.handleForbiddenAccess(user as never, user.email, 'Account waiting for approval')).resolves.toBeUndefined();
    expect(histories).toHaveLength(1);
    expect(alerts).toHaveLength(3);
    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'repeated_403' }),
      expect.objectContaining({ type: 'audit_integrity_incident' }),
    ]));
  });

  it('does not hide an unavailable audit database from authentication', async () => {
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback({
        opsAuditChainLock: { update: async () => ({ id: 'global', revision: 1 }) },
        opsAuditLog: { findMany: async () => { throw new Error('audit database unavailable'); } },
      }),
    };
    const service = new AuditService(prisma as never);

    await expect(service.recordAuthenticationAudit({
      actor: 'Ana Reyes',
      action: 'Signed in to client portal',
    })).rejects.toThrow('audit database unavailable');
  });

  it('keeps authentication fail-closed for a broken hash link', async () => {
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback({
        opsAuditChainLock: { update: async () => ({ id: 'global', revision: 1 }) },
        opsAuditLog: {
          findMany: async () => [
            { id: 'aud_root', immutableHash: 'hash_root', previousHash: null, createdAt: new Date('2026-04-29T09:00:00.000Z') },
            { id: 'aud_tail', immutableHash: 'hash_tail', previousHash: 'hash_root', createdAt: new Date('2026-04-29T09:01:00.000Z') },
            { id: 'aud_cycle_a', immutableHash: 'hash_cycle_a', previousHash: 'hash_cycle_b', createdAt: new Date('2026-04-29T09:02:00.000Z') },
            { id: 'aud_cycle_b', immutableHash: 'hash_cycle_b', previousHash: 'hash_cycle_a', createdAt: new Date('2026-04-29T09:03:00.000Z') },
          ],
        },
      }),
    };
    const service = new AuditService(prisma as never);

    await expect(service.recordAuthenticationAudit({
      actor: 'Ana Reyes',
      action: 'Signed in to client portal',
    })).rejects.toThrow('Audit history is not a single hash-linked chain');
  });

  it('does not classify tampered two-chain history as an ambiguous tail', async () => {
    const rows = independentAuditRows();
    rows[2] = { ...rows[2], immutableHash: 'tampered' };
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback({
        opsAuditChainLock: { update: async () => ({ id: 'global', revision: 1 }) },
        opsAuditLog: { findMany: async () => rows },
      }),
    };
    const service = new AuditService(prisma as never);

    await expect(service.recordAuthenticationAudit({
      actor: 'Ana Reyes',
      action: 'Signed in to client portal',
    })).rejects.toThrow('Audit history is not a single hash-linked chain');
  });

  it('keeps authentication fail-closed for a fork with multiple tails', async () => {
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback({
        opsAuditChainLock: { update: async () => ({ id: 'global', revision: 1 }) },
        opsAuditLog: {
          findMany: async () => [
            { id: 'aud_root', immutableHash: 'hash_root', previousHash: null, createdAt: new Date('2026-04-29T09:00:00.000Z') },
            { id: 'aud_tail_a', immutableHash: 'hash_tail_a', previousHash: 'hash_root', createdAt: new Date('2026-04-29T09:01:00.000Z') },
            { id: 'aud_tail_b', immutableHash: 'hash_tail_b', previousHash: 'hash_root', createdAt: new Date('2026-04-29T09:02:00.000Z') },
          ],
        },
      }),
    };
    const service = new AuditService(prisma as never);

    await expect(service.recordAuthenticationAudit({
      actor: 'Ana Reyes',
      action: 'Signed in to client portal',
    })).rejects.toThrow('Audit history is not a single hash-linked chain');
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

