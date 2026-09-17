import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService, AuditWriterAdapter } from '@prism/contexts/platform-ops';
import { DocumentVaultService } from '@prism/contexts/event-lifecycle';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import { GuestWorkflowService } from './guest-workflow.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)('guest feedback PostgreSQL transaction acceptance', () => {
  let prisma: PrismaClient;
  let pool: Pool;
  let service: GuestWorkflowService;
  const inquiryIds: string[] = [];
  const id = () => `w23_feedback_${randomUUID()}`;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
  });

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (url.hostname !== '127.0.0.1' || url.port !== '55437' || url.pathname !== '/prism_p0') {
      throw new Error('P0_TEST_DATABASE_URL must target the isolated 127.0.0.1:55437/prism_p0 database');
    }
    pool = new Pool({ connectionString: databaseUrl, ssl: false, max: 3 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await prisma.$connect();
    const auditWriter = new AuditWriterAdapter(new AuditService(prisma as never));
    service = new GuestWorkflowService(prisma as never, auditWriter, new WorkflowCommandService(), new DocumentVaultService());
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (prisma) await prisma.opsInquiry.deleteMany({ where: { id: { in: inquiryIds } } });
    inquiryIds.length = 0;
  });

  afterAll(async () => { await prisma?.$disconnect(); await pool?.end(); });

  it('commits feedback, moderation decision, and audit atomically', async () => {
    const inquiryId = id();
    inquiryIds.push(inquiryId);
    const event = await prisma.opsEvent.create({ data: {
      id: id(), clientName: 'W23 transaction client', eventName: 'W23 transaction event',
      eventDate: new Date('2026-09-07T00:00:00Z'), actualEndedAt: new Date('2026-09-07T12:00:00Z'),
      status: 'archived', archived: true, clientPortalStatus: 'unlocked',
      inquiry: { create: { id: inquiryId, clientName: 'W23 transaction client', email: `${inquiryId}@w23.test`, eventName: 'W23 transaction event', clientType: 'Private', eventDate: new Date('2026-09-07T00:00:00Z') } },
    } });
    const feedback = await service.submitFeedbackByAccessCode(service.guestAccessCode(event), { guestName: 'Guest', rating: 5, privacyConsentAccepted: true });
    const moderated = await service.moderateFeedback(event.id, feedback.id, { action: 'approve' }, { id: 'w23-pmcm', name: 'PMCM', role: 'pmcm-admin' });
    expect(moderated).toMatchObject({ moderationStatus: 'approved', moderatedById: 'w23-pmcm' });
    expect(await prisma.opsAuditLog.count({ where: { eventId: event.id, affectedId: feedback.id } })).toBe(2);
  });
});
