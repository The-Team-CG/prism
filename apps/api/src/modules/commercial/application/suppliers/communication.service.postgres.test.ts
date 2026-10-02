import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { AuditService, AuditWriterAdapter, NotificationOutboxService, NotificationOutboxWriterAdapter, SecurityOperationsService } from '@prism/contexts/platform-ops';
import { ParticipantReaderService } from '@prism/contexts/identity-access';
import { CommunicationService } from './communication.service';

const url = process.env.P0_TEST_DATABASE_URL;
const enabled = Boolean(url && new URL(url).hostname === '127.0.0.1' && new URL(url).port === '55437' && new URL(url).pathname === '/prism_p0');
const prefix = `p0_w17_service_${randomUUID()}`;
const ids = { inquiry: `${prefix}_inquiry`, event: `${prefix}_event`, thread: `${prefix}_thread`, user: `${prefix}_user`, user2: `${prefix}_user2`, participant: `${prefix}_participant`, participant2: `${prefix}_participant2` };

describe.skipIf(!enabled)('communication service PostgreSQL transaction', () => {
  let prisma: PrismaService;
  let service: CommunicationService;
  const actor = { id: ids.user, name: 'P0 PMCM', email: `${prefix}@example.test`, role: OpsUserRole.PmcmAdmin, explicit: true, verified: true };
  beforeAll(async () => {
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) process.env[variable] = url;
    process.env.DB_SSL = 'false';
    prisma = new PrismaService(); await prisma.$connect();
    await prisma.opsInquiry.create({ data: { id: ids.inquiry, clientName: prefix, email: `${prefix}@example.test`, normalizedEmail: `${prefix}@example.test`, eventName: prefix, eventDate: new Date('2030-01-01'), clientType: 'Corporate', source: 'Other', message: 'test', privacyConsentAccepted: true, privacyNoticeVersion: 'test' } });
    await prisma.opsEvent.create({ data: { id: ids.event, inquiryId: ids.inquiry, clientName: prefix, eventName: prefix, eventDate: new Date('2030-01-01') } });
    await prisma.opsUser.create({ data: { id: ids.user, name: actor.name, email: actor.email, password: 'fixture', role: actor.role, organization: prefix, approvalStatus: 'approved' } });
    await prisma.opsUser.create({ data: { id: ids.user2, name: 'P0 PMCM Recipient', email: `${prefix}_recipient@example.test`, password: 'fixture', role: actor.role, organization: prefix, approvalStatus: 'approved' } });
    await prisma.opsCommunicationThread.create({ data: { id: ids.thread, eventId: ids.event, subject: 'Service test', createdBy: ids.user } });
    await prisma.opsCommunicationParticipant.create({ data: { id: ids.participant, threadId: ids.thread, actorId: ids.user, actorRole: actor.role, actorEmail: actor.email } });
    await prisma.opsCommunicationParticipant.create({ data: { id: ids.participant2, threadId: ids.thread, actorId: ids.user2, actorRole: actor.role, actorEmail: `${prefix}_recipient@example.test` } });
    const auditService = new AuditService(prisma);
    const audit = new AuditWriterAdapter(auditService, new SecurityOperationsService(prisma, auditService));
    const notifications = new NotificationOutboxWriterAdapter(new NotificationOutboxService(prisma));
    const access = new EventAccessPolicyService(audit);
    const reader = new ParticipantReaderService(prisma, access);
    service = new CommunicationService(prisma, access, reader, audit, notifications);
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('serializes same-key service sends to one message, audit, and outbox intent', async () => {
    const input = { body: 'same service body', idempotencyKey: `${prefix}_key` };
    await Promise.all(Array.from({ length: 4 }, () => service.sendMessage(ids.thread, input, actor)));
    await expect(prisma.opsCommunicationMessage.count({ where: { threadId: ids.thread, idempotencyKey: input.idempotencyKey } })).resolves.toBe(1);
    await expect(prisma.opsAuditLog.count({ where: { eventId: ids.event, affectedType: 'communication_message' } })).resolves.toBe(1);
    await expect(prisma.opsNotificationLog.count({ where: { eventId: ids.event, correlationId: { startsWith: `communication-message:` } } })).resolves.toBe(1);
  });
});
