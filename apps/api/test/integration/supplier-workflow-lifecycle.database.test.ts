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

function supplierActor(id: string, supplierId: string, email: string): PrismVerifiedEventActor {
  return {
    id,
    actorId: id,
    role: OpsUserRole.Supplier,
    actorRole: OpsUserRole.Supplier,
    supplierId,
    email,
    actorEmail: email,
    name: `Supplier ${supplierId}`,
    actorName: `Supplier ${supplierId}`,
    expiresAt: '2099-01-01',
  };
}

function pmcmActor(id: string, eventId: string): PrismVerifiedEventActor {
  return {
    id,
    actorId: id,
    role: OpsUserRole.PmcmAdmin,
    actorRole: OpsUserRole.PmcmAdmin,
    eventId,
    email: 'portal-workflow-pmcm@example.test',
    actorEmail: 'portal-workflow-pmcm@example.test',
    name: 'Portal Workflow PMCM',
    actorName: 'Portal Workflow PMCM',
    expiresAt: '2099-01-01',
  };
}

describe.skipIf(!live)('supplier contract, schedule, and deliverable workflows against PostgreSQL', () => {
  it('keeps contracts assignment-owned and versioned, requires current schedule revisions, and preserves creative submission history', async () => {
    const url = databaseUrl!;
    process.env.P0_TEST_DATABASE_URL = url;
    process.env.DATABASE_URL = url;
    process.env.PRISMA_DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    process.env.DB_SSL = 'false';

    const prisma = new PrismaService();
    const suffix = randomUUID().replaceAll('-', '');
    const categoryId = `workflow_category_${suffix}`;
    const supplierId = `workflow_supplier_${suffix}`;
    const otherSupplierId = `workflow_other_supplier_${suffix}`;
    const inquiryId = `workflow_inquiry_${suffix}`;
    const eventId = `workflow_event_${suffix}`;
    const requestId = `workflow_request_${suffix}`;
    const otherRequestId = `workflow_other_request_${suffix}`;
    const scheduleId = `workflow_schedule_${suffix}`;
    const taskId = `workflow_task_${suffix}`;
    const objectIds = [`workflow_object_one_${suffix}`, `workflow_object_two_${suffix}`, `workflow_object_wrong_owner_${suffix}`, `workflow_object_archived_${suffix}`];
    const checksum = 'a'.repeat(64);

    try {
      await prisma.opsSupplierCategory.create({ data: { id: categoryId, slug: `${categoryId}-slug`, name: 'Supplier Workflow Test' } });
      await prisma.opsSupplier.createMany({ data: [
        { id: supplierId, categoryId, name: 'Workflow Supplier', email: `${supplierId}@example.test` },
        { id: otherSupplierId, categoryId, name: 'Other Workflow Supplier', email: `${otherSupplierId}@example.test` },
      ] });
      await prisma.opsInquiry.create({ data: {
        id: inquiryId, clientName: 'Supplier Workflow Client', email: `${suffix}-client@example.test`,
        eventName: 'Supplier Workflow Event', eventDate: new Date('2031-04-18T09:00:00.000Z'),
        clientType: 'corporate', normalizedEmail: `${suffix}-client@example.test`,
      } });
      await prisma.opsEvent.create({ data: {
        id: eventId, inquiryId, clientName: 'Supplier Workflow Client', eventName: 'Supplier Workflow Event',
        eventDate: new Date('2031-04-18T09:00:00.000Z'),
      } });
      await prisma.opsSupplierQuoteRequest.createMany({ data: [
        { id: requestId, eventId, supplierId, categoryId, supplierName: 'Workflow Supplier', category: 'Supplier Workflow Test', accessToken: `${requestId}-token`, status: 'selected', assignmentStatus: 'confirmed' },
        { id: otherRequestId, eventId, supplierId: otherSupplierId, categoryId, supplierName: 'Other Workflow Supplier', category: 'Supplier Workflow Test', accessToken: `${otherRequestId}-token`, status: 'selected', assignmentStatus: 'confirmed' },
      ] });
      await prisma.opsSupplierSchedule.create({ data: {
        id: scheduleId, eventId, requestId, ingressAt: new Date('2031-04-18T06:00:00.000Z'),
        egressAt: new Date('2031-04-18T20:00:00.000Z'), location: 'Loading entrance', notes: 'Use service lift',
      } });
      await prisma.opsSupplierCreativeTask.create({ data: {
        id: taskId, eventId, requestId, supplierId, title: 'Provide approved artwork', brief: 'Submit print-ready artwork', createdBy: 'Portal Workflow PMCM',
      } });

      const logicalTargets = [
        `supplier-contract:${requestId}:${randomUUID()}`,
        `supplier-contract:${requestId}:${randomUUID()}`,
        `supplier-contract:${otherRequestId}:${randomUUID()}`,
        `supplier-contract:${requestId}:${randomUUID()}`,
      ];
      await prisma.opsStoredObject.createMany({ data: objectIds.map((id, index) => ({
        id, eventId, ownerRecordType: 'supplier', ownerRecordId: index === 2 ? otherSupplierId : supplierId,
        usage: 'supplier_document', logicalTarget: logicalTargets[index], originalFileName: `${id}.pdf`, contentType: 'application/pdf',
        declaredByteSize: 128, checksumSha256: checksum, uploaderActorId: `actor-${supplierId}`,
        uploaderActorRole: OpsUserRole.Supplier, lifecycleState: 'stored', providerName: 'test', providerObjectKey: id, storedAt: new Date(),
      })) });

      const policy = new EventAccessPolicyService({ write: async () => undefined });
      const service = new SupplierWorkflowService(
        prisma, policy, { write: async () => undefined } satisfies AuditWriter, new OperationsEventReferenceService(prisma),
        new StorageObjectService(prisma, policy, new StorageValidationService()),
      );
      const supplier = policy.resolveVerifiedActor(supplierActor(`actor-${supplierId}`, supplierId, `${supplierId}@example.test`));
      const otherSupplier = policy.resolveVerifiedActor(supplierActor(`actor-${otherSupplierId}`, otherSupplierId, `${otherSupplierId}@example.test`));
      const pmcm = policy.resolveVerifiedActor(pmcmActor(`actor-pmcm-${suffix}`, eventId));

      const taskAssignment = {
        requestId,
        idempotencyKey: randomUUID(),
        title: 'Prepare stage artwork',
        brief: 'Provide the final stage artwork package.',
        dueAt: null,
      };
      const assignedTask = await service.createCreativeTask(eventId, taskAssignment, pmcm);
      const retriedTaskAssignment = await service.createCreativeTask(eventId, taskAssignment, pmcm);
      expect(retriedTaskAssignment.id).toBe(assignedTask.id);
      expect(await prisma.opsSupplierCreativeTask.count({ where: { id: assignedTask.id } })).toBe(1);
      await expect(service.createCreativeTask(eventId, { ...taskAssignment, title: 'Different payload' }, pmcm))
        .rejects.toThrow('Idempotency key was reused for another supplier deliverable');

      await expect(service.bindContract(requestId, { storedObjectId: objectIds[2]!, checksumSha256: checksum }, supplier))
        .rejects.toThrow('Uploaded contract is not a confirmed upload for this supplier assignment');
      const firstContract = await service.bindContract(requestId, { storedObjectId: objectIds[0]!, checksumSha256: checksum }, supplier);
      const secondContract = await service.bindContract(requestId, { storedObjectId: objectIds[1]!, checksumSha256: checksum }, supplier);
      expect([firstContract.version, secondContract.version]).toEqual([1, 2]);
      await expect(service.reviewContract(firstContract.id, { decision: 'accepted', reason: '' }, pmcm))
        .rejects.toThrow('A newer contract version has replaced this one');
      const reviewedContract = await service.reviewContract(secondContract.id, { decision: 'changes_requested', reason: 'Please include the signed page.' }, pmcm);
      expect(reviewedContract).toMatchObject({ version: 2, reviewStatus: 'changes_requested', reviewReason: 'Please include the signed page.' });
      await expect(service.bindContract(otherRequestId, { storedObjectId: objectIds[0]!, checksumSha256: checksum }, supplier))
        .rejects.toThrow('Supplier cannot access this assignment');

      const acknowledged = await service.acknowledgeSchedule(requestId, { expectedRevision: 1 }, supplier);
      expect(acknowledged).toMatchObject({ revision: 1, acknowledgedRevision: 1 });
      await prisma.opsSupplierSchedule.update({ where: { requestId }, data: {
        revision: 2, acknowledgedRevision: null, acknowledgedAt: null, acknowledgedBy: null,
      } });
      await expect(service.acknowledgeSchedule(requestId, { expectedRevision: 1 }, supplier))
        .rejects.toThrow('The schedule changed. Review the latest times before responding.');
      const change = await service.requestScheduleChange(requestId, { expectedRevision: 2, reason: 'Please allow additional setup time.' }, supplier);
      expect(change).toMatchObject({ revision: 2, acknowledgedRevision: null, changeRequestNote: 'Please allow additional setup time.' });

      await expect(service.updateCreativeProgress(taskId, { note: 'Should not leak across suppliers' }, otherSupplier))
        .rejects.toThrow('Supplier cannot access this deliverable');
      const progress = await service.updateCreativeProgress(taskId, { note: 'Artwork is in progress.' }, supplier);
      expect(progress).toMatchObject({ status: 'in_progress', supplierProgressNote: 'Artwork is in progress.' });
      const firstSubmission = await service.submitCreativeTask(taskId, { note: 'First print-ready draft.' }, supplier);
      expect(firstSubmission).toMatchObject({ status: 'submitted', submissionVersion: 1 });
      const retriedSubmission = await service.submitCreativeTask(taskId, { note: 'First print-ready draft.' }, supplier);
      expect(retriedSubmission).toMatchObject({ status: 'submitted', submissionVersion: 1 });
      expect(retriedSubmission.submissions.map(({ id }) => id)).toEqual(firstSubmission.submissions.map(({ id }) => id));
      expect(await prisma.opsSupplierCreativeSubmission.count({ where: { taskId } })).toBe(1);
      const returned = await service.reviewCreativeTask(taskId, { status: 'changes_requested', reviewNote: 'Correct the bleed area.' }, pmcm);
      expect(returned.status).toBe('changes_requested');
      await service.updateCreativeProgress(taskId, { note: 'Correcting the bleed area.' }, supplier);
      const secondSubmission = await service.submitCreativeTask(taskId, { note: 'Updated print-ready draft.' }, supplier);
      expect(secondSubmission).toMatchObject({ status: 'submitted', submissionVersion: 2 });
      const accepted = await service.reviewCreativeTask(taskId, { status: 'accepted', reviewNote: 'Approved for print.' }, pmcm);
      expect(accepted).toMatchObject({ status: 'accepted', submissionVersion: 2, reviewNote: 'Approved for print.' });
      expect(accepted.submissions.map(({ version, note }) => ({ version, note }))).toEqual([
        { version: 2, note: 'Updated print-ready draft.' },
        { version: 1, note: 'First print-ready draft.' },
      ]);

      await prisma.opsEvent.update({ where: { id: eventId }, data: { archived: true } });
      await expect(service.acknowledgeSchedule(requestId, { expectedRevision: 2 }, supplier)).rejects.toThrow('Active event not found');
      await expect(service.bindContract(requestId, { storedObjectId: objectIds[3]!, checksumSha256: checksum }, supplier)).rejects.toThrow('Active event not found');
      expect(await prisma.opsSupplierCreativeSubmission.count({ where: { taskId } })).toBe(2);
    } finally {
      await prisma.opsEvent.deleteMany({ where: { id: eventId } });
      await prisma.opsInquiry.deleteMany({ where: { id: inquiryId } });
      await prisma.opsSupplier.deleteMany({ where: { id: { in: [supplierId, otherSupplierId] } } });
      await prisma.opsSupplierCategory.deleteMany({ where: { id: categoryId } });
      await prisma.$disconnect();
    }
  }, 30_000);
});
