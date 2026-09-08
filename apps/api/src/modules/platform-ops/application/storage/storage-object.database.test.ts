import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';

const url = process.env.P0_TEST_DATABASE_URL;
const enabled = Boolean(url);
const prefix = `w10_${randomUUID()}`;
const ids = { inquiry: `${prefix}_inquiry`, event: `${prefix}_event`, object: `${prefix}_object` };

describe.skipIf(!enabled)('W10 stored-object PostgreSQL integrity', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.opsInquiry.create({ data: { id: ids.inquiry, clientName: 'W10 Test', email: `${prefix}@example.test`, normalizedEmail: `${prefix}@example.test`, eventName: 'W10', eventDate: new Date('2030-01-01'), clientType: 'Corporate', source: 'Other', message: 'storage test', privacyConsentAccepted: true, privacyNoticeVersion: 'test' } });
    await prisma.opsEvent.create({ data: { id: ids.event, inquiryId: ids.inquiry, clientName: 'W10 Test', eventName: 'W10', eventDate: new Date('2030-01-01') } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.opsStoredObject.deleteMany({ where: { eventId: ids.event } });
    await prisma.opsEvent.delete({ where: { id: ids.event } });
    await prisma.opsInquiry.delete({ where: { id: ids.inquiry } });
    await prisma.$disconnect();
  });

  it('enforces one logical target and compare-and-set lifecycle transitions', async () => {
    await prisma.opsStoredObject.create({ data: { id: ids.object, eventId: ids.event, ownerRecordType: 'test', ownerRecordId: ids.object, usage: 'signed_conforme', logicalTarget: 'one', originalFileName: 'signed.pdf', contentType: 'application/pdf', declaredByteSize: 1, checksumSha256: 'a'.repeat(64), uploaderActorId: 'test', uploaderActorRole: 'pmcm-admin', lifecycleState: 'requested' } });
    await expect(prisma.opsStoredObject.create({ data: { id: `${ids.object}_duplicate`, eventId: ids.event, ownerRecordType: 'test', ownerRecordId: ids.object, usage: 'signed_conforme', logicalTarget: 'one', originalFileName: 'signed.pdf', contentType: 'application/pdf', declaredByteSize: 1, checksumSha256: 'a'.repeat(64), uploaderActorId: 'test', uploaderActorRole: 'pmcm-admin', lifecycleState: 'requested' } })).rejects.toThrow();
    const first = await prisma.opsStoredObject.updateMany({ where: { id: ids.object, lifecycleState: 'requested' }, data: { lifecycleState: 'stored', storedAt: new Date() } });
    const second = await prisma.opsStoredObject.updateMany({ where: { id: ids.object, lifecycleState: 'requested' }, data: { lifecycleState: 'stored', storedAt: new Date() } });
    expect(first.count).toBe(1);
    expect(second.count).toBe(0);
  });
});
