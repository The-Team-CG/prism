import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';

const url = process.env.P0_TEST_DATABASE_URL;
const enabled = Boolean(url && new URL(url).hostname === '127.0.0.1' && new URL(url).port === '55437' && new URL(url).pathname === '/prism_p0');
const prefix = `p0_w17_${randomUUID()}`;
const ids = { inquiry: `${prefix}_inquiry`, event: `${prefix}_event`, thread: `${prefix}_thread` };

describe.skipIf(!enabled)('communication PostgreSQL idempotency', () => {
  let prisma: PrismaService;
  beforeAll(async () => {
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) process.env[variable] = url;
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.opsInquiry.create({ data: { id: ids.inquiry, clientName: prefix, email: `${prefix}@example.test`, normalizedEmail: `${prefix}@example.test`, eventName: prefix, eventDate: new Date('2030-01-01'), clientType: 'Corporate', source: 'Other', message: 'test', privacyConsentAccepted: true, privacyNoticeVersion: 'test' } });
    await prisma.opsEvent.create({ data: { id: ids.event, inquiryId: ids.inquiry, clientName: prefix, eventName: prefix, eventDate: new Date('2030-01-01') } });
    await prisma.opsCommunicationThread.create({ data: { id: ids.thread, eventId: ids.event, subject: 'Test', createdBy: prefix } });
  });
  afterAll(async () => { if (!prisma) return; await prisma.opsCommunicationMessage.deleteMany({ where: { threadId: ids.thread } }); await prisma.opsCommunicationThread.delete({ where: { id: ids.thread } }); await prisma.opsEvent.delete({ where: { id: ids.event } }); await prisma.opsInquiry.delete({ where: { id: ids.inquiry } }); await prisma.$disconnect(); });

  it('persists one message for concurrent same-key retries', async () => {
    const body = 'same body';
    const hash = createHash('sha256').update(JSON.stringify({ threadId: ids.thread, senderId: prefix, body })).digest('hex');
    await Promise.all(Array.from({ length: 4 }, (_, index) => prisma.$transaction((tx) => tx.opsCommunicationMessage.upsert({ where: { idempotencyKey: `${prefix}_key` }, create: { id: `${prefix}_message_${index}`, threadId: ids.thread, senderId: prefix, senderRole: 'pmcm-admin', body, payloadHash: hash, idempotencyKey: `${prefix}_key` }, update: { idempotencyKey: `${prefix}_key` } }))));
    await expect(prisma.opsCommunicationMessage.count({ where: { threadId: ids.thread, idempotencyKey: `${prefix}_key` } })).resolves.toBe(1);
  });
});
