import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventLifecycleService, WorkflowCommandService } from '@prism/kernel/event-core';
import { AuditService, AuditWriterAdapter, NotificationOutboxService, NotificationOutboxWriterAdapter, SecurityOperationsService } from '@prism/contexts/platform-ops';
import { FileRequirementsMatrixService } from '../files/file-requirements-matrix.service';
import { EventClosureService } from './event-closure.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL;
const operator = { actorRole: 'pmcm-admin', actorName: 'P0 verified operator' };
const override = { ...operator, overrideReason: 'Assets and outstanding requirements verified by PMCM outside the system' };

describe.skipIf(!databaseUrl)('closeout against PostgreSQL', () => {
  let prisma: PrismaClient;
  let pool: Pool;
  let auditWriter: AuditWriterAdapter;
  let outboxWriter: NotificationOutboxWriterAdapter;
  let service: EventClosureService;
  const id = () => `p0_close_${randomUUID()}`;

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (url.hostname !== '127.0.0.1' || url.port !== '55437' || url.pathname !== '/prism_p0') {
      throw new Error('P0_TEST_DATABASE_URL must target the isolated 127.0.0.1:55437/prism_p0 database');
    }
    pool = new Pool({ connectionString: databaseUrl, ssl: false, max: 5 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await prisma.$connect();
    const database = prisma as PrismaService;
    const auditService = new AuditService(database);
    auditWriter = new AuditWriterAdapter(auditService, new SecurityOperationsService(database, auditService));
    outboxWriter = new NotificationOutboxWriterAdapter(new NotificationOutboxService(database));
    service = new EventClosureService(database, new FileRequirementsMatrixService(database),
      new EventLifecycleService(), auditWriter, new EventAccessPolicyService(auditWriter),
      outboxWriter, new WorkflowCommandService());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Keep event and inquiry parents because the current cross-schema event cascade also deletes audit evidence.
  });

  afterAll(async () => { await prisma?.$disconnect(); await pool?.end(); });

  async function event() {
    const inquiryId = id();
    return prisma.opsEvent.create({ data: {
      id: id(), clientName: 'P0 closeout client', eventName: 'P0 closeout fixture',
      eventDate: new Date('2026-09-01T00:00:00Z'), status: 'event_day', clientPortalStatus: 'unlocked',
      inquiry: { create: {
        id: inquiryId, clientName: 'P0 closeout client', email: `${inquiryId}@closeout.test`,
        eventName: 'P0 closeout fixture', clientType: 'Private', eventDate: new Date('2026-09-01T00:00:00Z'),
      } },
    } });
  }

  it('blocks missing source evidence instead of treating empty lists as complete', async () => {
    const fixture = await event();
    const gates = await service.closeGates(fixture.id);
    expect(gates.missingKeys).toEqual(['documents', 'billing', 'logistics', 'feedback']);
    await expect(service.archiveEvent(fixture.id, operator)).rejects.toThrow();
    expect((await prisma.opsEvent.findUniqueOrThrow({ where: { id: fixture.id } })).archived).toBe(false);
  });

  it('reads unresolved issues and preserves the exact failed gates in an audited override', async () => {
    const fixture = await event();
    await prisma.opsUrgentIssue.create({ data: {
      id: id(), eventId: fixture.id, title: 'Blocking unresolved issue', severity: 'critical',
      openedBy: 'System test',
    } });
    const saved = await service.archiveEvent(fixture.id, override);
    expect(saved).toMatchObject({ archived: true, status: 'archived', archiveOverrideBy: operator.actorName });
    expect(saved.archiveChecklist).toMatchObject({ missingKeys: ['documents', 'billing', 'logistics', 'issues', 'feedback'] });
    expect(await prisma.opsAuditLog.count({ where: { eventId: fixture.id, actionType: 'archive' } })).toBe(1);
    expect(await prisma.opsNotificationLog.count({ where: { eventId: fixture.id } })).toBe(1);
  });

  it.each(['audit', 'outbox'])('rolls back archive and all preceding writes if %s persistence fails', async (failure) => {
    const fixture = await event();
    if (failure === 'audit') vi.spyOn(auditWriter, 'write').mockRejectedValueOnce(new Error('injected audit failure'));
    else vi.spyOn(outboxWriter, 'write').mockRejectedValueOnce(new Error('injected outbox failure'));
    await expect(service.archiveEvent(fixture.id, override)).rejects.toThrow(`injected ${failure} failure`);
    expect((await prisma.opsEvent.findUniqueOrThrow({ where: { id: fixture.id } })).archived).toBe(false);
    expect(await prisma.opsAuditLog.count({ where: { eventId: fixture.id } })).toBe(0);
    expect(await prisma.opsNotificationLog.count({ where: { eventId: fixture.id } })).toBe(0);
  });

  it('allows only one concurrent archive and emits one audit/outbox pair', async () => {
    const fixture = await event();
    const results = await Promise.allSettled([service.archiveEvent(fixture.id, override), service.archiveEvent(fixture.id, override)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.opsAuditLog.count({ where: { eventId: fixture.id } })).toBe(1);
    expect(await prisma.opsNotificationLog.count({ where: { eventId: fixture.id } })).toBe(1);
  });

  it('does not submit a deliverable if its completion audit fails', async () => {
    const fixture = await event();
    const document = await prisma.opsPostEventDocument.create({ data: { id: id(), eventId: fixture.id, title: 'Completion report' } });
    vi.spyOn(auditWriter, 'write').mockRejectedValueOnce(new Error('injected audit failure'));
    await expect(service.completePostEventDocument(fixture.id, document.id, {
      name: operator.actorName, role: 'pmcm-admin', explicit: true,
    })).rejects.toThrow('injected audit failure');
    expect((await prisma.opsPostEventDocument.findUniqueOrThrow({ where: { id: document.id } })).status).toBe('pending');
  });
});
