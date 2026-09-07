import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { AuditService } from '@prism/contexts/platform-ops';
import { AuditWriterAdapter } from '@prism/contexts/platform-ops';
import { ProposalClientReviewService } from './proposal-client-review.service';
import { OpsUserRole } from '@prism/kernel/event-core';

const url = process.env.P0_TEST_DATABASE_URL;
const enabled = Boolean(url && new URL(url).hostname === '127.0.0.1' && new URL(url).port === '55437');
const ids = { inquiry: 'p0_w02_inquiry', event: 'p0_w02_event', document: 'p0_w02_proposal' };
const actor = { id: 'p0_w02_client', role: OpsUserRole.Client, name: 'P0 Client', email: 'p0-w02@example.test', explicit: true };

describe.skipIf(!enabled)('proposal client review PostgreSQL integrity', () => {
  let prisma: PrismaService;
  let service: ProposalClientReviewService;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.opsAuditLog.deleteMany({ where: { eventId: ids.event } });
    await prisma.opsDocument.deleteMany({ where: { id: ids.document } });
    await prisma.opsEvent.deleteMany({ where: { id: ids.event } });
    await prisma.opsInquiry.deleteMany({ where: { id: ids.inquiry } });
    await prisma.opsInquiry.create({ data: { id: ids.inquiry, clientName: 'P0 Client', email: actor.email, normalizedEmail: actor.email, eventName: 'P0 W02', eventDate: new Date('2030-01-01'), clientType: 'Corporate', source: 'Other', message: 'test', privacyConsentAccepted: true, privacyNoticeVersion: 'test' } });
    await prisma.opsEvent.create({ data: { id: ids.event, inquiryId: ids.inquiry, clientName: 'P0 Client', eventName: 'P0 W02', eventDate: new Date('2030-01-01'), clientPortalStatus: 'unlocked', readiness: 'ready' } });
    await prisma.opsDocument.create({ data: { id: ids.document, eventId: ids.event, type: 'proposal', fileName: 'p0.pdf', status: 'issued' } });
    const access = { requireActorRole: async () => undefined };
    service = new ProposalClientReviewService(prisma, access as never, new AuditWriterAdapter(new AuditService(prisma)));
  });

  afterAll(async () => {
    await prisma.opsAuditLog.deleteMany({ where: { eventId: ids.event } });
    await prisma.opsDocument.deleteMany({ where: { id: ids.document } });
    await prisma.opsEvent.deleteMany({ where: { id: ids.event } });
    await prisma.opsInquiry.deleteMany({ where: { id: ids.inquiry } });
    await prisma.$disconnect();
  });

  it('persists one revision and one audit across a retry', async () => {
    await service.review(ids.event, { action: 'request_revision', revisionNote: 'Clarify venue', idempotencyKey: 'p0-retry' }, actor);
    await service.review(ids.event, { action: 'request_revision', revisionNote: 'Clarify venue', idempotencyKey: 'p0-retry' }, actor);
    await expect(prisma.opsEvent.findUniqueOrThrow({ where: { id: ids.event } })).resolves.toMatchObject({ proposalRevisionCount: 1 });
    await expect(prisma.opsAuditLog.count({ where: { eventId: ids.event, affectedId: 'p0-retry' } })).resolves.toBe(1);
  });
});
