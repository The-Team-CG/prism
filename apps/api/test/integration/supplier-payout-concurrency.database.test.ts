import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type AuditWriter } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { supplierPayoutReceiptTargetPrefix, type PrismVerifiedEventActor } from '@prism/types';
import { SupplierWorkflowService } from '../../src/modules/commercial/application/suppliers/supplier-workflow.service';
import { OperationsEventReferenceService } from '../../src/modules/event-lifecycle/application/onboarding/operations-event-reference.service';
import { StorageObjectService } from '../../src/modules/platform-ops/application/storage/storage-object.service';
import { StorageValidationService } from '../../src/modules/platform-ops/application/storage/storage-validation.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));

if (databaseUrl && !live) {
  throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
}

function verifiedActor(id: string, role: string, email: string, name: string, supplierId?: string): PrismVerifiedEventActor {
  return { id, actorId: id, role, actorRole: role, email, actorEmail: email, name, actorName: name, supplierId, expiresAt: '2099-01-01' } as PrismVerifiedEventActor;
}

function connect() {
  const url = databaseUrl!;
  process.env.P0_TEST_DATABASE_URL = url;
  process.env.DATABASE_URL = url;
  process.env.PRISMA_DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  process.env.DB_SSL = 'false';
  return new PrismaService();
}

/** One confirmed supplier assignment with a locked quote and a ₱100 payable, plus the service that works on it. */
async function seedPayable(prisma: PrismaService) {
  const suffix = randomUUID().replaceAll('-', '');
  const ids = {
    suffix, categoryId: `payout_category_${suffix}`, supplierId: `payout_supplier_${suffix}`, inquiryId: `payout_inquiry_${suffix}`,
    eventId: `payout_event_${suffix}`, requestId: `payout_request_${suffix}`, quoteId: `payout_quote_${suffix}`, milestoneId: `payout_milestone_${suffix}`,
    supplierEmail: `${suffix}@example.test`,
  };
  await prisma.opsSupplierCategory.create({ data: { id: ids.categoryId, slug: `${ids.categoryId}-slug`, name: 'Payout Concurrency' } });
  await prisma.opsSupplier.create({ data: { id: ids.supplierId, categoryId: ids.categoryId, name: 'Payout Concurrency Supplier', email: ids.supplierEmail } });
  await prisma.opsInquiry.create({ data: {
    id: ids.inquiryId, clientName: 'Payout Concurrency Client', email: `${suffix}-client@example.test`,
    eventName: 'Payout Concurrency Event', eventDate: new Date('2031-04-18T09:00:00.000Z'),
    clientType: 'corporate', normalizedEmail: `${suffix}-client@example.test`,
  } });
  await prisma.opsEvent.create({ data: {
    id: ids.eventId, inquiryId: ids.inquiryId, clientName: 'Payout Concurrency Client', eventName: 'Payout Concurrency Event',
    eventDate: new Date('2031-04-18T09:00:00.000Z'),
  } });
  await prisma.opsSupplierQuoteRequest.create({ data: {
    id: ids.requestId, eventId: ids.eventId, supplierId: ids.supplierId, categoryId: ids.categoryId, supplierName: 'Payout Concurrency Supplier',
    category: 'Payout Concurrency', accessToken: `${ids.requestId}-token`, status: 'selected', assignmentStatus: 'confirmed',
  } });
  await prisma.opsSupplierQuote.create({ data: {
    id: ids.quoteId, eventId: ids.eventId, requestId: ids.requestId, supplierId: ids.supplierId, categoryId: ids.categoryId, supplierName: 'Payout Concurrency Supplier',
    category: 'Payout Concurrency', amount: 100, status: 'selected', lockedAt: new Date(),
  } });
  await prisma.opsSupplierPayableMilestone.create({ data: {
    id: ids.milestoneId, eventId: ids.eventId, requestId: ids.requestId, quoteId: ids.quoteId, supplierId: ids.supplierId,
    label: 'Concurrency test payable', amount: 100, createdBy: 'Portal Test PMCM',
  } });

  const policy = new EventAccessPolicyService({ write: async () => undefined });
  const auditWriter: AuditWriter = { write: async () => undefined };
  const notices: Array<{ recipient: string; message: string }> = [];
  const service = new SupplierWorkflowService(
    prisma, policy, auditWriter, new OperationsEventReferenceService(prisma),
    new StorageObjectService(prisma, policy, new StorageValidationService()),
    { write: async (input: { recipient: string; message: string }) => { notices.push(input); } },
  );
  const pmcm = policy.resolveVerifiedActor(verifiedActor(`actor-${suffix}`, OpsUserRole.PmcmAdmin, 'portal-test-pmcm@example.test', 'Portal Test PMCM'));
  const supplier = policy.resolveVerifiedActor(verifiedActor(`supplier-actor-${suffix}`, OpsUserRole.Supplier, ids.supplierEmail, 'Payout Concurrency Supplier', ids.supplierId));
  return { ids, service, notices, pmcm, supplier, policy };
}

/** Owner schemas have no cross-domain cascades, so remove Commercial rows before Lifecycle rows. */
async function cleanup(prisma: PrismaService, ids: Awaited<ReturnType<typeof seedPayable>>['ids']) {
  await prisma.opsStoredObject.deleteMany({ where: { eventId: ids.eventId } });
  await prisma.opsSupplierPayoutRecord.deleteMany({ where: { milestoneId: ids.milestoneId, reversesRecordId: { not: null } } });
  await prisma.opsSupplierPayoutRecord.deleteMany({ where: { milestoneId: ids.milestoneId } });
  await prisma.opsSupplierPayableMilestone.deleteMany({ where: { id: ids.milestoneId } });
  await prisma.opsSupplierQuote.deleteMany({ where: { id: ids.quoteId } });
  await prisma.opsSupplierQuoteRequest.deleteMany({ where: { id: ids.requestId } });
  await prisma.opsEvent.deleteMany({ where: { id: ids.eventId } });
  await prisma.opsInquiry.deleteMany({ where: { id: ids.inquiryId } });
  await prisma.opsSupplier.deleteMany({ where: { id: ids.supplierId } });
  await prisma.opsSupplierCategory.deleteMany({ where: { id: ids.categoryId } });
}

describe.skipIf(!live)('supplier payouts against PostgreSQL', () => {
  it('serializes competing releases so their net total cannot exceed the milestone', async () => {
    const prisma = connect();
    const { ids, service, notices, pmcm } = await seedPayable(prisma);
    try {
      const paymentDate = new Date().toISOString();
      const releases = await Promise.allSettled([
        service.releasePayout(ids.milestoneId, {
          amount: 70, paymentDate, method: 'bank transfer', referenceNumber: 'release-one', idempotencyKey: `release-one-${ids.suffix}`,
        }, pmcm),
        service.releasePayout(ids.milestoneId, {
          amount: 70, paymentDate, method: 'bank transfer', referenceNumber: 'release-two', idempotencyKey: `release-two-${ids.suffix}`,
        }, pmcm),
      ]);

      expect(releases.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(releases.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const records = await prisma.opsSupplierPayoutRecord.findMany({ where: { milestoneId: ids.milestoneId } });
      expect(records).toHaveLength(1);
      expect(records[0]?.kind).toBe('release');
      expect(records[0]?.amount).toBe(70);
      const milestone = await prisma.opsSupplierPayableMilestone.findUnique({ where: { id: ids.milestoneId } });
      expect(milestone?.status).toBe('partially_released');
      // The supplier hears once, for the release that went through, never for the refused one.
      expect(notices).toHaveLength(1);
      expect(notices[0]?.message).toMatch(/^PMCM sent ₱70 for Concurrency test payable on Payout Concurrency Event by bank transfer \(ref release-(one|two)\)\.$/);
    } finally {
      await cleanup(prisma, ids);
      await prisma.$disconnect();
    }
  });

  it('lets the supplier confirm a payout and attach their official receipt, but not for a reversed payout or a stranger\'s file', async () => {
    const prisma = connect();
    const { ids, service, notices, pmcm, supplier } = await seedPayable(prisma);
    try {
      const paymentDate = new Date().toISOString();
      await service.releasePayout(ids.milestoneId, { amount: 60, paymentDate, method: 'GCash', referenceNumber: 'GC-1', idempotencyKey: `release-a-${ids.suffix}` }, pmcm);
      await service.releasePayout(ids.milestoneId, { amount: 40, paymentDate, method: 'GCash', referenceNumber: 'GC-2', idempotencyKey: `release-b-${ids.suffix}` }, pmcm);
      const [first, second] = await prisma.opsSupplierPayoutRecord.findMany({ where: { milestoneId: ids.milestoneId }, orderBy: { referenceNumber: 'asc' } });
      notices.length = 0;

      const confirmed = await service.confirmPayoutReceived(first.id, {}, supplier);
      const firstView = confirmed.history.find((record) => record.id === first.id);
      expect(firstView?.receivedAt).toBeTruthy();
      expect(firstView?.officialReceipt).toBeNull();
      expect(notices).toEqual([expect.objectContaining({ recipient: 'PMCM Admin', message: 'Payout Concurrency Supplier confirmed the ₱60 PMCM sent reached them.' })]);

      // Confirming again changes nothing and tells PMCM nothing new.
      await service.confirmPayoutReceived(first.id, {}, supplier);
      expect(notices).toHaveLength(1);

      const receipt = await prisma.opsStoredObject.create({ data: {
        id: `obj_${ids.suffix}`, eventId: ids.eventId, ownerRecordType: 'supplier', ownerRecordId: ids.supplierId, usage: 'supplier_document',
        logicalTarget: `${supplierPayoutReceiptTargetPrefix(first.id)}${randomUUID()}`, originalFileName: 'OR-0001.pdf', contentType: 'application/pdf',
        declaredByteSize: 1024, checksumSha256: 'a'.repeat(64), lifecycleState: 'stored', uploaderActorId: `supplier-actor-${ids.suffix}`, uploaderActorRole: OpsUserRole.Supplier,
        providerName: 'local', providerObjectKey: `k_${ids.suffix}`, storedAt: new Date(),
      } });
      const withReceipt = await service.confirmPayoutReceived(first.id, { officialReceiptObjectId: receipt.id }, supplier);
      expect(withReceipt.history.find((record) => record.id === first.id)?.officialReceipt).toEqual({ objectId: receipt.id, fileName: 'OR-0001.pdf' });
      expect(notices[notices.length - 1]?.message).toBe('Payout Concurrency Supplier sent their official receipt for the ₱60 PMCM paid them.');
      const stored = await prisma.opsSupplierPayoutRecord.findUnique({ where: { id: first.id } });
      expect(stored?.receivedAt?.toISOString()).toBe(firstView?.receivedAt);

      // A file stored for another payout cannot be used as this payout's receipt.
      await expect(service.confirmPayoutReceived(second.id, { officialReceiptObjectId: receipt.id }, supplier)).rejects.toThrow('not a finished upload');
      // PMCM cannot confirm on the supplier's behalf.
      await expect(service.confirmPayoutReceived(second.id, {}, pmcm)).rejects.toThrow();
      // A reversed payout cannot be confirmed.
      await service.reversePayout(second.id, { paymentDate, reason: 'Sent to the wrong account', idempotencyKey: `reverse-b-${ids.suffix}` }, pmcm);
      await expect(service.confirmPayoutReceived(second.id, {}, supplier)).rejects.toThrow('PMCM reversed this payment');
    } finally {
      await cleanup(prisma, ids);
      await prisma.$disconnect();
    }
  });
});
