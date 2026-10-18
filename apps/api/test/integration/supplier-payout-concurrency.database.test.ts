import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type AuditWriter } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismVerifiedEventActor } from '@prism/types';
import { SupplierWorkflowService } from '../../src/modules/commercial/application/suppliers/supplier-workflow.service';
import { OperationsEventReferenceService } from '../../src/modules/event-lifecycle/application/onboarding/operations-event-reference.service';
import { StorageObjectService } from '../../src/modules/platform-ops/application/storage/storage-object.service';
import { StorageValidationService } from '../../src/modules/platform-ops/application/storage/storage-validation.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));

if (databaseUrl && !live) {
  throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
}

function verifiedPmcmActor(id: string): PrismVerifiedEventActor {
  return {
    id,
    actorId: id,
    role: OpsUserRole.PmcmAdmin,
    actorRole: OpsUserRole.PmcmAdmin,
    email: 'portal-test-pmcm@example.test',
    actorEmail: 'portal-test-pmcm@example.test',
    name: 'Portal Test PMCM',
    actorName: 'Portal Test PMCM',
    expiresAt: '2099-01-01',
  };
}

describe.skipIf(!live)('supplier payout release concurrency against PostgreSQL', () => {
  it('serializes competing releases so their net total cannot exceed the milestone', async () => {
    const url = databaseUrl!;
    process.env.P0_TEST_DATABASE_URL = url;
    process.env.DATABASE_URL = url;
    process.env.PRISMA_DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    process.env.DB_SSL = 'false';

    const prisma = new PrismaService();
    const suffix = randomUUID().replaceAll('-', '');
    const categoryId = `payout_category_${suffix}`;
    const supplierId = `payout_supplier_${suffix}`;
    const inquiryId = `payout_inquiry_${suffix}`;
    const eventId = `payout_event_${suffix}`;
    const requestId = `payout_request_${suffix}`;
    const quoteId = `payout_quote_${suffix}`;
    const milestoneId = `payout_milestone_${suffix}`;

    try {
      await prisma.opsSupplierCategory.create({ data: { id: categoryId, slug: `${categoryId}-slug`, name: 'Payout Concurrency' } });
      await prisma.opsSupplier.create({ data: { id: supplierId, categoryId, name: 'Payout Concurrency Supplier', email: `${suffix}@example.test` } });
      await prisma.opsInquiry.create({ data: {
        id: inquiryId, clientName: 'Payout Concurrency Client', email: `${suffix}-client@example.test`,
        eventName: 'Payout Concurrency Event', eventDate: new Date('2031-04-18T09:00:00.000Z'),
        clientType: 'corporate', normalizedEmail: `${suffix}-client@example.test`,
      } });
      await prisma.opsEvent.create({ data: {
        id: eventId, inquiryId, clientName: 'Payout Concurrency Client', eventName: 'Payout Concurrency Event',
        eventDate: new Date('2031-04-18T09:00:00.000Z'),
      } });
      await prisma.opsSupplierQuoteRequest.create({ data: {
        id: requestId, eventId, supplierId, categoryId, supplierName: 'Payout Concurrency Supplier',
        category: 'Payout Concurrency', accessToken: `${requestId}-token`, status: 'selected', assignmentStatus: 'confirmed',
      } });
      await prisma.opsSupplierQuote.create({ data: {
        id: quoteId, eventId, requestId, supplierId, categoryId, supplierName: 'Payout Concurrency Supplier',
        category: 'Payout Concurrency', amount: 100, status: 'selected', lockedAt: new Date(),
      } });
      await prisma.opsSupplierPayableMilestone.create({ data: {
        id: milestoneId, eventId, requestId, quoteId, supplierId, label: 'Concurrency test payable', amount: 100, createdBy: 'Portal Test PMCM',
      } });

      const policy = new EventAccessPolicyService({ write: async () => undefined });
      const auditWriter: AuditWriter = { write: async () => undefined };
      const service = new SupplierWorkflowService(
        prisma, policy, auditWriter, new OperationsEventReferenceService(prisma),
        new StorageObjectService(prisma, policy, new StorageValidationService()),
      );
      const actor = policy.resolveVerifiedActor(verifiedPmcmActor(`actor-${suffix}`));
      const paymentDate = new Date().toISOString();
      const releases = await Promise.allSettled([
        service.releasePayout(milestoneId, {
          amount: 70, paymentDate, method: 'bank transfer', referenceNumber: 'release-one', idempotencyKey: `release-one-${suffix}`,
        }, actor),
        service.releasePayout(milestoneId, {
          amount: 70, paymentDate, method: 'bank transfer', referenceNumber: 'release-two', idempotencyKey: `release-two-${suffix}`,
        }, actor),
      ]);

      expect(releases.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(releases.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const records = await prisma.opsSupplierPayoutRecord.findMany({ where: { milestoneId } });
      expect(records).toHaveLength(1);
      expect(records[0]?.kind).toBe('release');
      expect(records[0]?.amount).toBe(70);
      const milestone = await prisma.opsSupplierPayableMilestone.findUnique({ where: { id: milestoneId } });
      expect(milestone?.status).toBe('partially_released');
    } finally {
      // Owner schemas have no cross-domain cascades, so remove Commercial rows before Lifecycle rows.
      await prisma.opsSupplierPayoutRecord.deleteMany({ where: { milestoneId } });
      await prisma.opsSupplierPayableMilestone.deleteMany({ where: { id: milestoneId } });
      await prisma.opsSupplierQuote.deleteMany({ where: { id: quoteId } });
      await prisma.opsSupplierQuoteRequest.deleteMany({ where: { id: requestId } });
      await prisma.opsEvent.deleteMany({ where: { id: eventId } });
      await prisma.opsInquiry.deleteMany({ where: { id: inquiryId } });
      await prisma.opsSupplier.deleteMany({ where: { id: supplierId } });
      await prisma.opsSupplierCategory.deleteMany({ where: { id: categoryId } });
      await prisma.$disconnect();
    }
  });
});
