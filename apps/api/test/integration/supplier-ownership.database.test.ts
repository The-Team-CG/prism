import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { WorkflowCommandService, OpsUserRole } from '@prism/kernel/event-core';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import type { AuditWriter } from '@prism/kernel/access-control';
import { SuppliersService } from '../../src/modules/commercial/application/suppliers/suppliers.service';
import { SupplierNetworkWorkflowService } from '../../src/modules/commercial/application/suppliers/supplier-network-workflow.service';
import type { PareApprovalGovernance } from '@prism/contexts/platform-ops';
import type { SupplierDocumentVault } from '../../src/modules/commercial/contracts/supplier-document-vault.port';
import type { SupplierProfileCommandsService } from '../../src/modules/commercial/application/suppliers/supplier-profile-commands.service';
import { EventReadModelQueries } from '../../src/modules/read-models/application/queries/event-read-models.queries';
import { EventReadModelsService } from '../../src/modules/read-models/application/services/event-read-models.service';
import type { GuestReader, StaffingReader } from '@prism/contexts/operations';
import type { PrismVerifiedEventActor } from '@prism/types';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));

if (databaseUrl && !live) {
  throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
}

function verifiedSupplierActor(id: string, email: string, name: string): PrismVerifiedEventActor {
  return {
    id,
    actorId: id,
    role: OpsUserRole.Supplier,
    actorRole: OpsUserRole.Supplier,
    email,
    actorEmail: email,
    name,
    actorName: name,
    expiresAt: '2099-01-01',
  };
}

describe.skipIf(!live)('supplier identity ownership against PostgreSQL', () => {
  it('resolves namesake suppliers by stable email and scopes each workspace to its assignment', async () => {
    const url = databaseUrl as string;
    process.env.P0_TEST_DATABASE_URL = url;
    process.env.SUPABASE_DB_URL = url;
    process.env.DATABASE_URL = url;
    process.env.PRISMA_DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    process.env.DB_SSL = 'false';

    const prisma = new PrismaService();
    const suffix = randomUUID().replaceAll('-', '');
    const categoryId = `p0_supplier_category_${suffix}`;
    const supplierIds = [`p0_supplier_one_${suffix}`, `p0_supplier_two_${suffix}`];
    const inquiryIds = [`p0_supplier_inquiry_one_${suffix}`, `p0_supplier_inquiry_two_${suffix}`];
    const eventIds = [`p0_supplier_event_one_${suffix}`, `p0_supplier_event_two_${suffix}`];
    const requestIds = [`p0_supplier_request_one_${suffix}`, `p0_supplier_request_two_${suffix}`];
    const emails = [`supplier-one-${suffix}@example.test`, `supplier-two-${suffix}@example.test`];

    try {
      await prisma.opsSupplierCategory.create({
        data: { id: categoryId, slug: `${categoryId}-slug`, name: 'Namesake Test Category' },
      });
      await prisma.opsSupplier.createMany({
        data: supplierIds.map((id, index) => ({
          id,
          categoryId,
          name: 'Same Supplier Company',
          email: emails[index],
        })),
      });
      for (const [index, inquiryId] of inquiryIds.entries()) {
        await prisma.opsInquiry.create({
          data: {
            id: inquiryId,
            clientName: `Supplier Ownership Client ${index}`,
            email: `supplier-ownership-client-${index}-${suffix}@example.test`,
            eventName: `Supplier Ownership Event ${index}`,
            eventDate: new Date('2031-04-18T09:00:00.000Z'),
            clientType: 'corporate',
            normalizedEmail: `supplier-ownership-client-${index}-${suffix}@example.test`,
          },
        });
        await prisma.opsEvent.create({
          data: {
            id: eventIds[index],
            inquiryId,
            clientName: `Supplier Ownership Client ${index}`,
            eventName: `Supplier Ownership Event ${index}`,
            eventDate: new Date('2031-04-18T09:00:00.000Z'),
          },
        });
        await prisma.opsSupplierQuoteRequest.create({
          data: {
            id: requestIds[index],
            eventId: eventIds[index],
            supplierId: supplierIds[index],
            categoryId,
            supplierName: 'Same Supplier Company',
            category: 'Namesake Test Category',
            accessToken: `${requestIds[index]}-token`,
            status: 'selected',
          },
        });
      }

      const queries = new EventReadModelQueries(prisma);
      const policy = new EventAccessPolicyService({ write: async () => undefined });
      const service = new EventReadModelsService(
        queries,
        policy,
        {} as unknown as GuestReader,
        {} as unknown as StaffingReader,
        {} as unknown as ConstructorParameters<typeof EventReadModelsService>[4],
        {} as unknown as ConstructorParameters<typeof EventReadModelsService>[5],
      );
      const mappers = {
        mapSupplierQuoteRequest: (request: { id: string }) => request,
        mapSupplierQuoteForSupplier: (quote: { id: string }) => quote,
      };

      let auditCalls = 0;
      const auditWriter: AuditWriter = {
        write: async () => {
          auditCalls += 1;
          return undefined;
        },
      };
      const pareService: PareApprovalGovernance = {
        getPendingApprovals: async () => [],
        approveRecommendation: async () => ({ id: 'test' } as never),
        rejectRecommendation: async () => ({ id: 'test' } as never),
      };
      const documentVault: SupplierDocumentVault = {
        validateUploadMetadata: () => ({
          originalFileName: 'test.pdf',
          generatedFileName: 'test.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1,
          storageBucket: 'test',
          storageKey: 'test',
          validationStatus: 'accepted',
        }),
      };
      const commandService = new SupplierNetworkWorkflowService(
        prisma,
        new SuppliersService(prisma),
        {} as unknown as SupplierProfileCommandsService,
        auditWriter,
        policy,
        new WorkflowCommandService(new PrismTransactionRunner(prisma)),
        pareService,
        { queue: async () => ({}) },
        documentVault,
      );

      const own = await service.supplierWorkspace(
        policy.resolveVerifiedActor(verifiedSupplierActor(`actor-${supplierIds[0]}`, emails[0], 'Same Supplier Company')),
        mappers,
      );
      expect(own.quoteRequests).toEqual([expect.objectContaining({ id: requestIds[0] })]);

      const second = await service.supplierWorkspace(
        policy.resolveVerifiedActor(verifiedSupplierActor(`actor-${supplierIds[1]}`, emails[1], 'Same Supplier Company')),
        mappers,
      );
      expect(second.quoteRequests).toEqual([expect.objectContaining({ id: requestIds[1] })]);

      const firstActor = policy.resolveVerifiedActor(verifiedSupplierActor(`actor-${supplierIds[0]}`, emails[0], 'Same Supplier Company'));
      await commandService.confirmSupplierAssignment(requestIds[0], firstActor);
      expect((await prisma.opsSupplierQuoteRequest.findUnique({ where: { id: requestIds[0] } }))?.assignmentStatus).toBe('confirmed');
      const auditCallsAfterOwnCommand = auditCalls;
      await expect(commandService.confirmSupplierAssignment(requestIds[1], firstActor)).rejects.toThrow(
        'Supplier cannot access this quote request',
      );
      expect(auditCalls).toBe(auditCallsAfterOwnCommand);

      await expect(
        service.supplierWorkspace(
          policy.resolveVerifiedActor({
            ...verifiedSupplierActor(`actor-unknown-${suffix}`, `unknown-${suffix}@example.test`, 'Same Supplier Company'),
          }),
          mappers,
        ),
      ).rejects.toThrow('Supplier profile not found for actor');
    } finally {
      await prisma.opsSupplierQuoteRequest.deleteMany({ where: { id: { in: requestIds } } });
      await prisma.opsEvent.deleteMany({ where: { id: { in: eventIds } } });
      await prisma.opsInquiry.deleteMany({ where: { id: { in: inquiryIds } } });
      await prisma.opsSupplier.deleteMany({ where: { id: { in: supplierIds } } });
      await prisma.opsSupplierCategory.deleteMany({ where: { id: categoryId } });
      await prisma.$disconnect();
    }
  });
});
