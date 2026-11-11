import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import type { AuditWriter } from '@prism/kernel/access-control';
import { PaymentReceiptService } from '../../src/modules/commercial/application/billing/payment-receipt.service';
import { StorageObjectService } from '../../src/modules/platform-ops/application/storage/storage-object.service';
import { StorageValidationService } from '../../src/modules/platform-ops/application/storage/storage-validation.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));

if (databaseUrl && !live) {
  throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
}

describe.skipIf(!live)('payment receipt evidence against PostgreSQL', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
  const actor = { id: `evidence-actor-${suffix}`, name: `Evidence Test ${suffix}`, role: 'pmcm-admin', email: 'evidence-test@example.test' };
  const ids = {
    inquiryA: `evidence_inquiry_a_${suffix}`, inquiryB: `evidence_inquiry_b_${suffix}`,
    eventA: `evidence_event_a_${suffix}`, eventB: `evidence_event_b_${suffix}`,
  };
  const auditWriter: AuditWriter = { write: async () => undefined };
  let prisma: PrismaService;
  let receipts: PaymentReceiptService;
  let sequence = 0;
  const ref = () => `EV-${suffix}-${(sequence += 1)}`;

  const record = (extra: Record<string, unknown> = {}) =>
    receipts.recordReceipt({ amount: 25000, receivedDate: '2026-11-10', method: 'Bank Transfer', referenceNumber: ref(), ...extra } as never, actor);

  // A proof of payment as storage would leave it once an upload is confirmed; `overrides` makes the near-misses.
  const storedProof = async (receiptId: string, eventId: string, overrides: Record<string, unknown> = {}) => {
    const id = `evidence_obj_${suffix}_${(sequence += 1)}`;
    await prisma.opsStoredObject.create({ data: {
      id, eventId, ownerRecordType: 'payment_receipt', ownerRecordId: receiptId, usage: 'payment_receipt_evidence',
      logicalTarget: `payment-receipt-evidence:${receiptId}:${randomUUID()}`, originalFileName: 'transfer-slip.pdf', contentType: 'application/pdf',
      declaredByteSize: 48213, checksumSha256: 'a'.repeat(64), uploaderActorId: actor.id, uploaderActorRole: actor.role,
      lifecycleState: 'stored', storedAt: new Date(), ...overrides,
    } });
    return id;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl!;
    process.env.PRISMA_DATABASE_URL = databaseUrl!;
    process.env.DIRECT_URL = databaseUrl!;
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    // The real storage service is the evidence reader, so the lookups below run the same queries production does.
    const storage = new StorageObjectService(prisma, {} as never, new StorageValidationService());
    receipts = new PaymentReceiptService(prisma, auditWriter, storage);

    for (const [inquiryId, eventId, name] of [[ids.inquiryA, ids.eventA, 'A'], [ids.inquiryB, ids.eventB, 'B']] as const) {
      await prisma.opsInquiry.create({ data: {
        id: inquiryId, clientName: `Evidence Client ${name}`, email: `${inquiryId}@example.test`, normalizedEmail: `${inquiryId}@example.test`,
        eventName: `Evidence Event ${name}`, eventDate: new Date('2031-04-18T09:00:00.000Z'), clientType: 'corporate',
      } });
      await prisma.opsEvent.create({ data: {
        id: eventId, inquiryId, clientName: `Evidence Client ${name}`, eventName: `Evidence Event ${name}`, eventDate: new Date('2031-04-18T09:00:00.000Z'),
      } });
    }
  });

  afterAll(async () => {
    if (!live) return;
    const eventIds = [ids.eventA, ids.eventB];
    await prisma.opsPaymentReceipt.deleteMany({ where: { recordedBy: actor.name } });
    await prisma.opsStoredObject.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.opsEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.opsInquiry.deleteMany({ where: { id: { in: [ids.inquiryA, ids.inquiryB] } } });
    await prisma.$disconnect();
  });

  it('describes the attached proof on the receipt, and no proof until one is attached', async () => {
    const receipt = await record({ eventId: ids.eventA });
    expect(receipt).toMatchObject({ evidenceObjectId: null, evidence: null });

    const objectId = await storedProof(receipt.id, ids.eventA);
    const attached = await receipts.attachEvidence(receipt.id, { objectId }, actor);

    expect(attached).toMatchObject({ evidenceObjectId: objectId, evidence: { objectId, fileName: 'transfer-slip.pdf', contentType: 'application/pdf', byteSize: 48213 } });
    expect((await receipts.listReceipts({ eventId: ids.eventA })).find((entry) => entry.id === receipt.id)?.evidence).toMatchObject({ objectId, fileName: 'transfer-slip.pdf' });
  });

  it('attaches only a finished upload made as evidence for this very receipt of its event', async () => {
    const receipt = await record({ eventId: ids.eventA });
    const other = await record({ eventId: ids.eventA });
    const otherEvent = await record({ eventId: ids.eventB });
    const refuses = (objectId: string, receiptId = receipt.id) => expect(receipts.attachEvidence(receiptId, { objectId }, actor)).rejects.toBeInstanceOf(BadRequestException);

    // Another receipt's proof, another event's proof, a upload still in flight, a deleted file, and a file of the wrong kind.
    await refuses(await storedProof(other.id, ids.eventA));
    await refuses(await storedProof(receipt.id, ids.eventB));
    await refuses(await storedProof(receipt.id, ids.eventA, { lifecycleState: 'requested', storedAt: null }));
    await refuses(await storedProof(receipt.id, ids.eventA, { deletedAt: new Date() }));
    await refuses(await storedProof(receipt.id, ids.eventA, { usage: 'client_document', ownerRecordType: 'event', ownerRecordId: ids.eventA }));
    await refuses(`evidence_obj_missing_${suffix}`);
    // Proof stored under this event cannot be hung on a receipt held for a different one.
    await refuses(await storedProof(receipt.id, ids.eventA), otherEvent.id);

    expect((await receipts.getReceipt(receipt.id)).evidenceObjectId).toBeNull();
  });

  it('takes proof only for a live receipt that is held for an event, and a newer file replaces the older link', async () => {
    const unassigned = await record();
    await expect(receipts.attachEvidence(unassigned.id, { objectId: await storedProof(unassigned.id, ids.eventA) }, actor)).rejects.toBeInstanceOf(ConflictException);

    const rejected = await record({ eventId: ids.eventA });
    const rejectedProof = await storedProof(rejected.id, ids.eventA);
    await receipts.reject(rejected.id, { reason: 'No such transfer' }, actor);
    await expect(receipts.attachEvidence(rejected.id, { objectId: rejectedProof }, actor)).rejects.toThrow(/rejected receipt cannot take evidence/);

    const live = await record({ eventId: ids.eventA });
    const first = await storedProof(live.id, ids.eventA);
    const second = await storedProof(live.id, ids.eventA);
    await receipts.attachEvidence(live.id, { objectId: first }, actor);
    expect(await receipts.attachEvidence(live.id, { objectId: second }, actor)).toMatchObject({ evidenceObjectId: second });
    // The earlier file stays in storage; only the link moved.
    expect(await prisma.opsStoredObject.findUniqueOrThrow({ where: { id: first } })).toMatchObject({ lifecycleState: 'stored', deletedAt: null });
  });

  it('assigns an event to held money once, and refuses an unknown event or a second assignment', async () => {
    const held = await record();
    expect(held.eventId).toBeNull();

    await expect(receipts.earmark(held.id, { eventId: `missing_${suffix}` }, actor)).rejects.toBeInstanceOf(NotFoundException);
    const assigned = await receipts.earmark(held.id, { eventId: ids.eventA }, actor);
    expect(assigned.eventId).toBe(ids.eventA);
    expect((await receipts.listReceipts({ eventId: ids.eventA })).map((entry) => entry.id)).toContain(held.id);

    await expect(receipts.earmark(held.id, { eventId: ids.eventB }, actor)).rejects.toThrow(/already held for an event/);
    expect((await receipts.getReceipt(held.id)).eventId).toBe(ids.eventA);

    // Once held for an event, the same receipt can take its proof.
    const objectId = await storedProof(held.id, ids.eventA);
    expect(await receipts.attachEvidence(held.id, { objectId }, actor)).toMatchObject({ evidenceObjectId: objectId });
  });
});
