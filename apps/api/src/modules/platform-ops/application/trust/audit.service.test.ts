import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AuditExportService } from './audit-export.service';
import { AuditReadService } from './audit-read.service';
import { AuditService } from './audit.service';
import { SecurityOperationsService } from './security-operations.service';

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
    device: 'Local fixture browser',
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

function securityOperationsService(prisma: unknown, outbox?: unknown) {
  return new SecurityOperationsService(prisma as never, new AuditService(prisma as never), outbox as never);
}

describe('AuditService', () => {
  it('uses explicit unknown metadata when login request context is unavailable', async () => {
    const create = async ({ data }: { data: unknown }) => data;
    const prisma = { opsLoginHistory: { create } };
    const service = securityOperationsService(prisma);
    await expect(service.recordLoginHistory(null, 'missing@example.test', 'failed', 'Unknown email')).resolves.toMatchObject({
      ipAddress: 'unknown',
      device: 'unknown',
    });
  });

  it('resolves a same-time history tail from links before appending', async () => {
    const created: any[] = [];
    const root = auditRow({ id: 'aud_root', createdAt: new Date('2026-04-29T09:00:00.000Z') });
    const tail = auditRow({ id: 'aud_tail', previousHash: root.immutableHash, createdAt: root.createdAt });
    const logs = [tail, root];
    const lock = { id: 'global', revision: 0, headId: null as string | null, headHash: null as string | null };
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback(prisma),
      opsAuditChainLock: {
        update: async ({ data }: { data: any }) => {
          if (data.revision?.increment) lock.revision += data.revision.increment;
          if (data.headId) lock.headId = data.headId;
          if (data.headHash) lock.headHash = data.headHash;
          return { ...lock };
        },
      },
      opsAuditLog: {
        findMany: async () => logs,
        findUnique: async ({ where }: { where: { id: string } }) => logs.find((log) => log.id === where.id) ?? null,
        create: async ({ data }: { data: any }) => { created.push(data); logs.push(data); return data; },
      },
    };
    const service = new AuditService(prisma as never);
    await service.audit(undefined, 'PMCM Admin', 'Appended after tied history');
    expect(created[0]).toMatchObject({ previousHash: tail.immutableHash });
  });

  it('bootstraps the verified head once and uses it for later appends', async () => {
    const logs: any[] = [auditRow({ id: 'aud_existing' })];
    const created: any[] = [];
    const lock = { id: 'global', revision: 0, headId: null as string | null, headHash: null as string | null };
    let fullHistoryReads = 0;
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback(prisma),
      opsAuditChainLock: {
        update: async ({ data }: { data: any }) => {
          if (data.revision?.increment) lock.revision += data.revision.increment;
          if (data.headId) lock.headId = data.headId;
          if (data.headHash) lock.headHash = data.headHash;
          return { ...lock };
        },
      },
      opsAuditLog: {
        findMany: async () => { fullHistoryReads += 1; return [...logs]; },
        findFirst: async ({ where }: { where: any }) => logs.find((log) => log.createdAt >= where.createdAt.gte && log.id !== where.id.not) ?? null,
        findUnique: async ({ where }: { where: { id: string } }) => logs.find((log) => log.id === where.id) ?? null,
        create: async ({ data }: { data: any }) => { created.push(data); logs.push(data); return data; },
      },
    };
    const service = new AuditService(prisma as never);

    await service.audit(undefined, 'PMCM Admin', 'First append after deployment');
    await service.audit(undefined, 'PMCM Admin', 'Second append after deployment');

    expect(fullHistoryReads).toBe(1);
    expect(created[1].previousHash).toBe(created[0].immutableHash);
    expect(lock).toMatchObject({ headId: created[1].id, headHash: created[1].immutableHash });
  });

  it('revalidates and reconciles an untracked tail left by an older writer', async () => {
    const root = auditRow({ id: 'aud_stored_head' });
    const untracked = auditRow({
      id: 'aud_old_writer',
      previousHash: root.immutableHash,
      createdAt: new Date(root.createdAt.getTime() + 1),
    });
    const logs: any[] = [untracked, root];
    const lock = { id: 'global', revision: 0, headId: root.id, headHash: root.immutableHash };
    let fullHistoryReads = 0;
    let created: any;
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback(prisma),
      opsAuditChainLock: {
        update: async ({ data }: { data: any }) => {
          if (data.revision?.increment) lock.revision += data.revision.increment;
          if (data.headId !== undefined) lock.headId = data.headId;
          if (data.headHash !== undefined) lock.headHash = data.headHash;
          return { ...lock };
        },
      },
      opsAuditLog: {
        findMany: async () => { fullHistoryReads += 1; return [...logs]; },
        findFirst: async ({ where }: { where: any }) => logs.find((log) => log.createdAt >= where.createdAt.gte && log.id !== where.id.not) ?? null,
        findUnique: async ({ where }: { where: { id: string } }) => logs.find((log) => log.id === where.id) ?? null,
        create: async ({ data }: { data: any }) => { created = data; logs.push(data); return data; },
      },
    };
    const service = new AuditService(prisma as never);

    await service.audit(undefined, 'PMCM Admin', 'Append after old writer');

    expect(fullHistoryReads).toBe(1);
    expect(created.previousHash).toBe(untracked.immutableHash);
    expect(lock).toMatchObject({ headId: created.id, headHash: created.immutableHash });
  });

  it('keeps concurrent appends on one linked chain under the row lock', async () => {
    const logs: any[] = [];
    const lock = { id: 'global', revision: 0, headId: null as string | null, headHash: null as string | null };
    let previousLockHolder: Promise<void> = Promise.resolve();
    const createTransaction = () => {
      let releaseLock: (() => void) | undefined;
      let holdsLock = false;
      const tx = {
        opsAuditChainLock: {
          update: async ({ data }: { data: any }) => {
            if (data.revision?.increment && !holdsLock) {
              const previousHolder = previousLockHolder;
              let releaseCurrent!: () => void;
              previousLockHolder = new Promise<void>((resolve) => { releaseCurrent = resolve; });
              await previousHolder;
              releaseLock = releaseCurrent;
              holdsLock = true;
            }
            if (data.revision?.increment) lock.revision += data.revision.increment;
            if (data.headId !== undefined) lock.headId = data.headId;
            if (data.headHash !== undefined) lock.headHash = data.headHash;
            return { ...lock };
          },
        },
        opsAuditLog: {
          findMany: async () => [...logs],
          findFirst: async ({ where }: { where: any }) => logs.find((log) => log.createdAt >= where.createdAt.gte && log.id !== where.id.not) ?? null,
          findUnique: async ({ where }: { where: { id: string } }) => logs.find((log) => log.id === where.id) ?? null,
          create: async ({ data }: { data: any }) => { logs.push(data); return data; },
        },
      };
      return { tx, release: () => releaseLock?.() };
    };
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => {
        const transaction = createTransaction();
        try {
          return await callback(transaction.tx);
        } finally {
          transaction.release();
        }
      },
      opsAuditLog: { findMany: async () => [...logs] },
    };
    const service = new AuditService(prisma as never);

    await Promise.all(Array.from({ length: 8 }, (_, index) => service.audit(undefined, `Operator ${index}`, `Concurrent action ${index}`)));

    await expect(service.verifyIntegrity()).resolves.toMatchObject({ valid: true, checkedCount: 8 });
  });

  it('refuses to append when the stored audit head no longer matches its verified row', async () => {
    const head = auditRow({ id: 'aud_head' });
    const lock = { id: 'global', revision: 0, headId: head.id, headHash: 'changed-hash' };
    let createCount = 0;
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback(prisma),
      opsAuditChainLock: {
        update: async ({ data }: { data: any }) => {
          if (data.revision?.increment) lock.revision += data.revision.increment;
          return { ...lock };
        },
      },
      opsAuditLog: {
        findUnique: async () => head,
        create: async ({ data }: { data: unknown }) => { createCount += 1; return data; },
      },
    };
    const service = new AuditService(prisma as never);

    await expect(service.audit(undefined, 'PMCM Admin', 'Must not append')).rejects.toMatchObject({ kind: 'broken_chain' });
    expect(createCount).toBe(0);
  });

  it('finds historical tampering during the separate full integrity scan', async () => {
    const root = auditRow({ id: 'aud_historical_root' });
    const head = auditRow({
      id: 'aud_current_head',
      previousHash: root.immutableHash,
      createdAt: new Date(root.createdAt.getTime() + 1),
    });
    const tamperedRoot = { ...root, actor: 'Changed after append' };
    const service = new AuditService({
      opsAuditLog: { findMany: async () => [tamperedRoot, head] },
    } as never);

    await expect(service.verifyIntegrity()).resolves.toMatchObject({
      valid: false,
      checkedCount: 2,
      firstBrokenLogId: root.id,
    });
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
    const service = securityOperationsService(prisma);

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
    const service = securityOperationsService(prisma);

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
    const service = securityOperationsService(prisma);
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

    await expect(service.handleFailedLogin(user as never, {
      failureReason: 'Invalid password',
      failedAttempt: 1,
      lockoutCount: 0,
      lockoutTriggered: false,
      permanentLockout: false,
    })).resolves.toBeUndefined();
    expect(updates).toHaveLength(0);
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
    const service = securityOperationsService(prisma);
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

    await expect(service.handleFailedLogin(user as never, {
      failureReason: 'Invalid two-factor code',
      failedAttempt: 5,
      lockoutCount: 1,
      lockoutTriggered: true,
      permanentLockout: false,
    })).resolves.toBeUndefined();
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
    const service = securityOperationsService(prisma);
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
    const service = securityOperationsService(prisma);

    await expect(service.recordAuthenticationAudit({
      actor: 'Ana Reyes',
      action: 'Signed in to client portal',
    })).rejects.toThrow('audit database unavailable');
  });

  it('keeps authentication fail-closed for a broken hash link', async () => {
    const alerts: Array<Record<string, unknown>> = [];
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
      opsSecurityAlert: { create: async ({ data }: { data: Record<string, unknown> }) => { alerts.push(data); return data; } },
    };
    const service = securityOperationsService(prisma);

    await expect(service.recordAuthenticationAudit({
      actor: 'Ana Reyes',
      action: 'Signed in to client portal',
    })).rejects.toThrow('Audit history is not a single hash-linked chain');
    // The severe classification must never also be the silent one.
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ type: 'audit_integrity_incident', severity: 'critical' });
  });

  it('does not classify tampered two-chain history as an ambiguous tail', async () => {
    const rows = independentAuditRows();
    rows[2] = { ...rows[2], immutableHash: 'tampered' };
    const alerts: Array<Record<string, unknown>> = [];
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback({
        opsAuditChainLock: { update: async () => ({ id: 'global', revision: 1 }) },
        opsAuditLog: { findMany: async () => rows },
      }),
      opsSecurityAlert: { create: async ({ data }: { data: Record<string, unknown> }) => { alerts.push(data); return data; } },
    };
    const service = securityOperationsService(prisma);

    await expect(service.recordAuthenticationAudit({
      actor: 'Ana Reyes',
      action: 'Signed in to client portal',
    })).rejects.toThrow('Audit history is not a single hash-linked chain');
    expect(alerts).toHaveLength(1);
  });

  it('keeps authentication fail-closed for a fork with multiple tails', async () => {
    const alerts: Array<Record<string, unknown>> = [];
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
      opsSecurityAlert: { create: async ({ data }: { data: Record<string, unknown> }) => { alerts.push(data); return data; } },
    };
    const service = securityOperationsService(prisma);

    await expect(service.recordAuthenticationAudit({
      actor: 'Ana Reyes',
      action: 'Signed in to client portal',
    })).rejects.toThrow('Audit history is not a single hash-linked chain');
    expect(alerts).toHaveLength(1);
  });

  it('records the incident and fails closed when an unhashed row forms a second chain root', async () => {
    // Reproduces the staging outage: a seeder wrote an audit row directly, so it
    // carried the column default of an empty immutable_hash and a null
    // previous_hash. Two roots, no duplicate hashes, no orphans - and every
    // login returned 409 with no incident recorded anywhere.
    const alerts: Array<Record<string, unknown>> = [];
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback({
        opsAuditChainLock: { update: async () => ({ id: 'global', revision: 1 }) },
        opsAuditLog: {
          findMany: async () => [
            { id: 'aud_seed', immutableHash: '', previousHash: null, createdAt: new Date('2026-08-14T00:51:37.807Z') },
            { id: 'aud_root', immutableHash: 'hash_root', previousHash: null, createdAt: new Date('2026-08-14T00:52:02.348Z') },
            { id: 'aud_tail', immutableHash: 'hash_tail', previousHash: 'hash_root', createdAt: new Date('2026-09-10T03:07:16.109Z') },
          ],
        },
      }),
      opsSecurityAlert: { create: async ({ data }: { data: Record<string, unknown> }) => { alerts.push(data); return data; } },
    };
    const service = securityOperationsService(prisma);

    await expect(service.recordAuthenticationAudit({
      actor: 'Ms. Mys',
      action: 'Signed in to pmcm-admin portal',
    })).rejects.toThrow('Audit history is not a single hash-linked chain');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].metadata).toMatchObject({ integrityKind: 'broken_chain', breakReason: 'multiple_roots' });
  });

  it('lets an operator opt into degraded authentication without editing audit rows', async () => {
    const alerts: Array<Record<string, unknown>> = [];
    const prisma = {
      $transaction: async (callback: (tx: unknown) => unknown): Promise<unknown> => callback({
        opsAuditChainLock: { update: async () => ({ id: 'global', revision: 1 }) },
        opsAuditLog: {
          findMany: async () => [
            { id: 'aud_seed', immutableHash: '', previousHash: null, createdAt: new Date('2026-08-14T00:51:37.807Z') },
            { id: 'aud_root', immutableHash: 'hash_root', previousHash: null, createdAt: new Date('2026-08-14T00:52:02.348Z') },
          ],
        },
      }),
      opsSecurityAlert: { create: async ({ data }: { data: Record<string, unknown> }) => { alerts.push(data); return data; } },
    };
    const service = securityOperationsService(prisma);
    const previousPosture = process.env.AUTH_AUDIT_INTEGRITY_POSTURE;
    process.env.AUTH_AUDIT_INTEGRITY_POSTURE = 'degraded';
    try {
      await expect(service.recordAuthenticationAudit({
        actor: 'Ms. Mys',
        action: 'Signed in to pmcm-admin portal',
      })).resolves.toBeNull();
    } finally {
      if (previousPosture === undefined) delete process.env.AUTH_AUDIT_INTEGRITY_POSTURE;
      else process.env.AUTH_AUDIT_INTEGRITY_POSTURE = previousPosture;
    }
    // Degraded mode still records the critical incident; it never hides it.
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ type: 'audit_integrity_incident', severity: 'critical' });
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
    const auditService = new AuditService(prisma as never);
    const exportService = new AuditExportService(
      new AuditReadService(prisma as never),
      auditService,
      new SecurityOperationsService(prisma as never, auditService, outbox as never),
    );
    const exported = await exportService.exportAuditLogs({}, { id: 'verified-pmcm-id', name: 'Verified PMCM', role: 'pmcm-admin', email: 'pmcm@example.test' });

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

describe('AuditReadService', () => {
  it('maps filtered audit results and clamps the requested page size', async () => {
    const row = auditRow({ id: 'aud_filtered', category: 'access', action: 'Signed in to portal' });
    let query: unknown;
    const prisma = {
      opsAuditLog: {
        findMany: async (input: unknown) => {
          query = input;
          return [row];
        },
      },
    };
    const service = new AuditReadService(prisma as never);

    const results = await service.listAuditLogs({ query: 'portal', category: 'access', limit: '900' });

    expect(query).toEqual(expect.objectContaining({
      where: {
        category: 'access',
        OR: [
          { actor: { contains: 'portal', mode: 'insensitive' } },
          { action: { contains: 'portal', mode: 'insensitive' } },
          { affectedLabel: { contains: 'portal', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }));
    expect(results[0]).toMatchObject({
      id: 'aud_filtered',
      actor: 'PMCM Admin',
      action: 'Signed in to portal',
      createdAt: row.createdAt.toISOString(),
    });
  });
});

