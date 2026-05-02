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
    device: 'Local demo browser',
    severity: 'info',
    immutableHash: 'hash',
    previousHash: null,
    createdAt: new Date('2026-04-29T09:00:00.000Z'),
    ...overrides,
  };
}

describe('AuditService', () => {
  it('exports logs and creates a security alert when the bulk threshold is reached', async () => {
    const rows = Array.from({ length: 25 }, (_, index) => auditRow({ id: `aud_${index}` }));
    const createdAuditRows: unknown[] = [];
    const alerts: unknown[] = [];
    const notifications: unknown[] = [];
    const prisma = {
      opsAuditLog: {
        findMany: async () => rows,
        findFirst: async () => ({ immutableHash: 'previous_hash' }),
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
      opsNotificationLog: {
        create: async ({ data }: { data: unknown }) => {
          notifications.push(data);
          return data;
        },
      },
    };

    const service = new AuditService(prisma as any);
    const exported = await service.exportAuditLogs({});

    expect(exported.recordCount).toBe(25);
    expect(alerts).toHaveLength(1);
    expect(createdAuditRows).toHaveLength(2);
    expect(notifications).toHaveLength(2);
  });
});

