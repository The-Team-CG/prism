import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsSupplierQuoteRequest, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import {
  AuditActionType,
  AuditCategory,
  OpsUserRole,
  SupplierVerificationStatus,
  WorkflowCommandService,
  isOpsConstantValue,
} from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import {
  type ChangeSupplierTierInput,
  type CreateSupplierCertificationInput,
  type CreateSupplierInput,
  type CreateSupplierReviewInput,
  type SupplierDirectory,
  type UpdateSupplierInput,
} from '../../contracts/supplier-directory.port';
import type { SupplierEventStatusInput, SupplierReadinessInput, VerifySupplierEventStatusInput } from '../../contracts/supplier-commands.port';
import type { SupplierDocumentVault, UploadMetadataInput, ValidatedUploadMetadata } from '../../contracts/supplier-document-vault.port';
import {
  SUPPLIER_DIRECTORY,
  SUPPLIER_DOCUMENT_VAULT,
} from '../../contracts/supplier-ops.tokens';
import {
  PARE_APPROVAL_GOVERNANCE,
  PARE_DISPATCH_WRITER,
  type PareApprovalGovernance,
  type PareDispatchWriter,
  type PAREApprovalRecord,
} from '@prism/contexts/platform-ops';
import { SupplierProfileCommandsService } from './supplier-profile-commands.service';
import type { CreateSupplierReliabilityNoteInput, PromoteSupplierInput, CreateSupplierScheduleInput } from '@prism/types';

async function lockSupplierQuoteRequest(prisma: Prisma.TransactionClient, requestId: string) {
  await prisma.$queryRaw`SELECT id FROM "supplier_ops"."quote_requests" WHERE id = ${requestId} FOR UPDATE`; // QUERY_AUDIT_RAW_SQL: parameterized primary-key row lock rechecks assignment state and identity.
}

function requireLockedConfirmationRequest(
  request: OpsSupplierQuoteRequest | null,
  expectedAssignmentStatus: string,
  expectedEventId: string,
  expectedSupplierId: string,
) {
  if (
    !request ||
    request.assignmentStatus !== expectedAssignmentStatus ||
    request.eventId !== expectedEventId ||
    request.supplierId !== expectedSupplierId ||
    request.status !== 'selected' ||
    request.assignmentStatus !== 'pending_confirmation' ||
    !request.supplierId
  ) {
    throw new BadRequestException('Supplier assignment changed before confirmation');
  }
  return request;
}

function requireLockedWithdrawalRequest(
  request: OpsSupplierQuoteRequest | null,
  expectedAssignmentStatus: string,
  expectedEventId: string,
  expectedSupplierId: string,
) {
  if (
    !request ||
    request.assignmentStatus !== expectedAssignmentStatus ||
    request.eventId !== expectedEventId ||
    request.supplierId !== expectedSupplierId ||
    request.status !== 'selected' ||
    !request.supplierId ||
    !['pending_confirmation', 'confirmed'].includes(request.assignmentStatus)
  ) {
    throw new BadRequestException('Supplier assignment changed before withdrawal');
  }
  return request;
}

@Injectable()
export class SupplierNetworkWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SUPPLIER_DIRECTORY) private readonly suppliersService: SupplierDirectory,
    private readonly supplierProfileCommandsService: SupplierProfileCommandsService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(PARE_APPROVAL_GOVERNANCE) private readonly pareGovernance: PareApprovalGovernance,
    @Inject(PARE_DISPATCH_WRITER) private readonly pareDispatchWriter: PareDispatchWriter,
    @Inject(SUPPLIER_DOCUMENT_VAULT) private readonly documentVaultService: SupplierDocumentVault,
  ) {}

  async createSupplier(input: CreateSupplierInput, actor: ResolvedEventOpsActor) {
    return this.supplierProfileCommandsService.createSupplier(input, actor);
  }

  async updateSupplier(supplierId: string, input: UpdateSupplierInput, actor: ResolvedEventOpsActor) {
    return this.supplierProfileCommandsService.updateSupplier(supplierId, input, actor);
  }

  async changeSupplierTier(supplierId: string, input: ChangeSupplierTierInput, actor: ResolvedEventOpsActor) {
    return this.supplierProfileCommandsService.changeSupplierTier(supplierId, input, actor);
  }

  async addSupplierReview(supplierId: string, input: CreateSupplierReviewInput, actor: ResolvedEventOpsActor) {
    return this.supplierProfileCommandsService.addSupplierReview(supplierId, input, actor);
  }

  async addReliabilityNote(supplierId: string, input: CreateSupplierReliabilityNoteInput, actor: ResolvedEventOpsActor) {
    return this.supplierProfileCommandsService.addReliabilityNote(supplierId, input, actor);
  }

  async promoteSupplier(supplierId: string, input: PromoteSupplierInput, actor: ResolvedEventOpsActor) {
    return this.supplierProfileCommandsService.promoteSupplier(supplierId, input, actor);
  }

  async addSupplierCertification(
    supplierId: string,
    input: CreateSupplierCertificationInput,
    actor: ResolvedEventOpsActor,
  ) {
    return this.supplierProfileCommandsService.addSupplierCertification(supplierId, input, actor);
  }

  async confirmSupplierAssignment(requestId: string, actor: ResolvedEventOpsActor) {
    let request: OpsSupplierQuoteRequest | null = null;
    let expectedAssignmentStatus = '';
    let expectedEventId = '';
    let expectedSupplierId = '';

    return this.workflowCommandService.execute<OpsSupplierQuoteRequest>({
      name: 'confirm_supplier_assignment',
      context: { actorId: actor.id ?? actor.name, actorRole: actor.role, correlationId: `supplier-confirm:${requestId}` },
      sideEffectMode: 'same_tx',
      validatePermission: async () => {
        request = await this.requireSupplierQuoteRequestForActor(requestId, actor);
        expectedAssignmentStatus = request.assignmentStatus;
        expectedEventId = request.eventId;
        expectedSupplierId = request.supplierId ?? '';
        if (request.status !== 'selected' || request.assignmentStatus !== 'pending_confirmation' || !request.supplierId) {
          throw new BadRequestException('Only a selected supplier assignment can be confirmed');
        }
      },
      write: async (transactionContext) => {
        if (!request) throw new NotFoundException('Supplier quote request not found');
        const prisma = transactionContext?.prisma ?? this.prisma;
        await lockSupplierQuoteRequest(prisma, requestId);
        request = requireLockedConfirmationRequest(
          await prisma.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } }),
          expectedAssignmentStatus,
          expectedEventId,
          expectedSupplierId,
        );
        return prisma.opsSupplierQuoteRequest.updateMany({
          where: {
            id: request.id,
            eventId: expectedEventId,
            supplierId: expectedSupplierId,
            status: 'selected',
            assignmentStatus: expectedAssignmentStatus,
          },
          data: {
            assignmentStatus: 'confirmed',
            assignmentConfirmedAt: new Date(),
          },
        }).then(async (changed) => {
          if (changed.count !== 1) throw new BadRequestException('Supplier assignment changed before confirmation');
          const updated = await prisma.opsSupplierQuoteRequest.findUnique({ where: { id: request!.id } });
          if (!updated) throw new NotFoundException('Supplier quote request not found');
          return updated;
        });
      },
      sideEffects: async (updated, transactionContext) => {
        if (!request) return;
        await writeAudit(this.auditWriter, request.eventId, actor.name, `Confirmed supplier assignment: ${request.supplierName}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Update,
          category: AuditCategory.Suppliers,
          affectedType: 'supplier_quote_request',
            affectedId: request.id,
            affectedLabel: request.supplierName,
          metadata: { assignmentStatus: updated.assignmentStatus ?? 'confirmed' },
        }, transactionContext);
      },
    });
  }

  async withdrawSupplier(requestId: string, reason: string, actor: ResolvedEventOpsActor, eventId?: string) {
    let request: OpsSupplierQuoteRequest | null = null;
    let expectedAssignmentStatus = '';
    let expectedEventId = '';
    let expectedSupplierId = '';

    const result = await this.workflowCommandService.execute<
      { request: OpsSupplierQuoteRequest; sourceUpdatedAt: Date },
      { request: OpsSupplierQuoteRequest; sourceUpdatedAt: Date }
    >({
      name: 'withdraw_supplier',
      sideEffectMode: 'same_tx',
      context: { actorId: actor.id ?? actor.name, actorRole: actor.role, correlationId: `supplier-withdraw:${requestId}` },
      validatePermission: () => this.requireSupplierAdmin(actor, 'withdraw supplier'),
      validateState: async () => {
        request = await this.prisma.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new NotFoundException('Supplier quote request not found');
        if (eventId && request.eventId !== eventId) throw new NotFoundException('Supplier quote request not found');
        expectedAssignmentStatus = request.assignmentStatus;
        expectedEventId = request.eventId;
        expectedSupplierId = request.supplierId ?? '';
        if (
          request.status !== 'selected' ||
          !request.supplierId ||
          !['pending_confirmation', 'confirmed'].includes(request.assignmentStatus)
        ) {
          throw new BadRequestException('Only a selected supplier assignment can be withdrawn');
        }
      },
      write: async (transactionContext) => {
        if (!request) throw new NotFoundException('Supplier quote request not found');
        const prisma = transactionContext?.prisma ?? this.prisma;
        await lockSupplierQuoteRequest(prisma, requestId);
        request = requireLockedWithdrawalRequest(
          await prisma.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } }),
          expectedAssignmentStatus,
          expectedEventId,
          expectedSupplierId,
        );
        const changed = await prisma.opsSupplierQuoteRequest.updateMany({
          where: {
            id: request.id,
            eventId: expectedEventId,
            supplierId: expectedSupplierId,
            status: 'selected',
            assignmentStatus: expectedAssignmentStatus,
          },
          data: { assignmentStatus: 'withdrawn' },
        });
        if (changed.count !== 1) throw new BadRequestException('Supplier assignment changed before withdrawal');
        const sourceUpdatedAt = new Date();
        const updated = await prisma.opsSupplierQuoteRequest.findUnique({ where: { id: request.id }, include: { supplier: true } });
        if (!updated) throw new NotFoundException('Supplier quote request not found');
        return { request: updated, sourceUpdatedAt };
      },
      sideEffects: async (result, transactionContext) => {
        if (!request) return;
        await writeAudit(this.auditWriter, request.eventId, actor.name, `Supplier withdrawn: ${request.supplierName}. Reason: ${reason}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            actionType: AuditActionType.Update,
            category: AuditCategory.Suppliers,
            affectedType: 'supplier_quote_request',
            affectedId: request.id,
          affectedLabel: request.supplierName,
        }, transactionContext);
        await this.pareDispatchWriter.queue({
          eventId: request.eventId,
          requestId: request.id,
          sourceUpdatedAt: result.sourceUpdatedAt,
          correlationId: transactionContext?.correlationId ?? `supplier-withdraw:${request.id}`,
        }, transactionContext);
      },
    });
    return result.request;
  }

  pareGetPendingApprovals(eventId?: string) {
    return this.pareGovernance.getPendingApprovals(eventId);
  }

  async pareApprove(approvalRecordId: string, approvedBy: string) {
    const result = await this.pareGovernance.approveRecommendation(approvalRecordId, approvedBy);
    await this.auditPareDecision(result, approvalRecordId, approvedBy, 'approved');
    return result;
  }

  async pareReject(approvalRecordId: string, rejectedBy: string) {
    const result = await this.pareGovernance.rejectRecommendation(approvalRecordId, rejectedBy);
    await this.auditPareDecision(result, approvalRecordId, rejectedBy, 'rejected');
    return result;
  }

  async confirmSupplierReadiness(
    requestId: string,
    input: SupplierReadinessInput,
    actor: ResolvedEventOpsActor,
  ) {
    let request: OpsSupplierQuoteRequest | null = null;

    return this.workflowCommandService.execute<OpsSupplierQuoteRequest>({
      name: 'confirm_supplier_readiness',
      validatePermission: async () => {
        request = await this.requireSupplierQuoteRequestForActor(requestId, actor);
        if (request.status !== 'selected' || request.assignmentStatus !== 'confirmed') {
          throw new BadRequestException('Supplier readiness requires a confirmed assignment');
        }
      },
      write: (transactionContext) => {
        if (!request) throw new NotFoundException('Supplier quote request not found');
        const prisma = transactionContext?.prisma ?? this.prisma;
        return prisma.opsSupplierQuoteRequest.update({
          where: { id: request.id },
          data: {
            readinessStatus: 'confirmed',
            readinessConfirmedAt: new Date(),
            readinessNotes: input.notes?.trim() ?? '',
          },
        });
      },
      sideEffects: async (updated, transactionContext) => {
        if (!request) return;
        await writeAudit(this.auditWriter, request.eventId, actor.name, `Confirmed supplier readiness: ${request.supplierName}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Update,
          category: AuditCategory.Suppliers,
          affectedType: 'supplier_quote_request',
          affectedId: request.id,
          affectedLabel: request.supplierName,
          metadata: { notes: input.notes ?? '' },
        }, transactionContext);
      },
    });
  }

  async updateSupplierEventStatus(
    requestId: string,
    input: SupplierEventStatusInput,
    actor: ResolvedEventOpsActor,
  ) {
    let request: OpsSupplierQuoteRequest | null = null;
    let photo: ValidatedUploadMetadata | null = null;

    return this.workflowCommandService.execute<OpsSupplierQuoteRequest>({
      name: 'update_supplier_event_status',
      validatePermission: async () => {
        request = await this.requireSupplierQuoteRequestForActor(requestId, actor);
        if (request.status !== 'selected' || request.assignmentStatus !== 'confirmed' || request.readinessStatus !== 'confirmed') {
          throw new BadRequestException('Supplier event-day status requires confirmed assignment and readiness');
        }
      },
      validateState: () => {
        const allowed = ['arrived', 'set_up_ready', 'done_leaving'];
        if (!allowed.includes(input.status)) throw new BadRequestException('Unsupported supplier event-day status');
        if (!request) throw new NotFoundException('Supplier quote request not found');
        photo = input.photo ? this.validateUploadMetadata(input.photo, `events/${request.eventId}/supplier-status`) : null;
      },
      write: (transactionContext) => {
        if (!request) throw new NotFoundException('Supplier quote request not found');
        const prisma = transactionContext?.prisma ?? this.prisma;
        return prisma.opsSupplierQuoteRequest.update({
          where: { id: request.id },
          data: {
            eventDayStatus: input.status,
            eventDayStatusAt: new Date(),
            eventDayNotes: input.notes?.trim() ?? '',
            statusPhotoFileName: photo?.generatedFileName ?? null,
          },
        });
      },
      sideEffects: async (updated, transactionContext) => {
        if (!request) return;
        await writeAudit(this.auditWriter, request.eventId, actor.name, `Supplier status update: ${input.status}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Update,
          category: AuditCategory.Suppliers,
          affectedType: 'supplier_quote_request',
          affectedId: request.id,
          affectedLabel: request.supplierName,
          metadata: { status: input.status, notes: input.notes ?? '', photoFileName: photo?.generatedFileName ?? null },
        }, transactionContext);
      },
    });
  }

  async verifySupplierEventStatus(
    eventId: string,
    requestId: string,
    input: VerifySupplierEventStatusInput,
    actor: ResolvedEventOpsActor,
  ) {
    let request: OpsSupplierQuoteRequest | null = null;
    let verificationStatus: SupplierVerificationStatus | null = null;
    const verifiedBy = actor.name;

    return this.workflowCommandService.execute<OpsSupplierQuoteRequest>({
      name: 'verify_supplier_event_status',
      eventId,
      validatePermission: async () => {
        await this.eventAccessPolicyService.requireActorRole(
          actor,
          [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
          'supplier setup verification',
          eventId,
        );
      },
      validateState: async () => {
        const requestedStatus = input.verificationStatus?.trim();
        if (!isOpsConstantValue(SupplierVerificationStatus, requestedStatus)) {
          throw new BadRequestException('Unsupported supplier verification status');
        }
        verificationStatus = requestedStatus;
        request = await this.prisma.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } });
        if (request?.eventId !== eventId) request = null;
        if (!request) throw new NotFoundException('Supplier quote request not found');
      },
      write: () => {
        if (!verificationStatus) throw new BadRequestException('Unsupported supplier verification status');
        return this.prisma.opsSupplierQuoteRequest.update({
          where: { id: requestId },
          data: {
            eventDayVerificationStatus: verificationStatus,
            eventDayVerifiedAt: new Date(),
            eventDayVerifiedBy: verifiedBy,
            eventDayVerificationNotes: input.notes?.trim() ?? '',
          },
        });
      },
      sideEffects: async (updated) => {
        if (!verificationStatus) return;
        const metadata = { verificationStatus, verifiedBy, notes: input.notes ?? '' };
        await writeAudit(this.auditWriter, eventId, actor.name, `Marked supplier setup ${verificationStatus}: ${updated.supplierName}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Update,
          category: AuditCategory.Suppliers,
          affectedType: 'supplier_quote_request',
          affectedId: updated.id,
          affectedLabel: updated.supplierName,
          metadata,
        });
      },
    });
  }

  async uploadSupplierContract(requestId: string, input: UploadMetadataInput, actor: ResolvedEventOpsActor) {
    let request: OpsSupplierQuoteRequest | null = null;
    let upload: ValidatedUploadMetadata | null = null;

    return this.workflowCommandService.execute<OpsSupplierQuoteRequest>({
      name: 'upload_supplier_contract',
      validatePermission: async () => {
        request = await this.requireSupplierQuoteRequestForActor(requestId, actor);
      },
      validateState: () => {
        if (!request) throw new NotFoundException('Supplier quote request not found');
        upload = this.validateUploadMetadata(input, `events/${request.eventId}/supplier-contracts`);
      },
      write: async () => {
        if (!request || !upload) throw new NotFoundException('Supplier quote request not found');
        const document = await this.prisma.opsDocument.create({
          data: {
            id: `doc_${randomUUID()}`,
            eventId: request.eventId,
            type: 'supplier_contract',
            fileName: upload.originalFileName,
            generatedFileName: upload.generatedFileName,
            status: 'submitted',
            mimeType: upload.mimeType,
            sizeBytes: upload.sizeBytes,
            validationStatus: upload.validationStatus,
            storageBucket: upload.storageBucket,
            storageKey: upload.storageKey,
            uploadedByRole: 'supplier',
          },
        });
        const updated = await this.prisma.opsSupplierQuoteRequest.update({
          where: { id: request.id },
          data: { contractDocumentId: document.id },
        });
        return updated;
      },
      sideEffects: async (updated) => {
        if (!request) return;
        await writeAudit(this.auditWriter, request.eventId, actor.name, `Uploaded supplier contract: ${request.supplierName}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Upload,
          category: AuditCategory.Documents,
          affectedType: 'document',
          affectedId: updated.contractDocumentId ?? undefined,
          affectedLabel: upload?.originalFileName,
        });
      },
    });
  }

  async createSupplierSchedule(eventId: string, input: CreateSupplierScheduleInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator], 'supplier ingress schedule', eventId);
    const ingressAt = new Date(input.ingressAt);
    const egressAt = new Date(input.egressAt);
    if (egressAt <= ingressAt) throw new BadRequestException('Egress must be after ingress');
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const request = await tx.opsSupplierQuoteRequest.findUnique({ where: { id: input.requestId } });
      if (!request || request.eventId !== eventId || request.status !== 'selected' || request.assignmentStatus !== 'confirmed') {
        throw new BadRequestException('Only a confirmed supplier assignment can receive a schedule');
      }
      const schedule = await tx.opsSupplierSchedule.upsert({
        where: { requestId: input.requestId },
        create: { id: `ss_${randomUUID()}`, eventId, requestId: input.requestId, ingressAt, egressAt, location: input.location ?? '', notes: input.notes ?? '' },
        update: { ingressAt, egressAt, location: input.location ?? '', notes: input.notes ?? '', status: 'planned' },
      });
      const lateFlagReset = await tx.opsSupplierQuoteRequest.updateMany({
        where: { id: request.id, eventDayStatus: 'late' },
        data: { eventDayStatus: 'not_started', eventDayStatusAt: null },
      });
      await writeAudit(this.auditWriter, eventId, actor.name, `Scheduled supplier ingress: ${request.supplierName}`, {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Create, category: AuditCategory.Suppliers,
        affectedType: 'supplier_schedule', affectedId: schedule.id, affectedLabel: request.supplierName,
        metadata: {
          requestId: request.id,
          ingressAt: ingressAt.toISOString(),
          egressAt: egressAt.toISOString(),
          lateFlagReset: lateFlagReset.count === 1,
        },
      }, { prisma: tx, actorId: actor.id, correlationId: `supplier-schedule:${schedule.id}` });
      return schedule;
    });
  }

  async listSupplierSchedules(eventId: string, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator], 'supplier ingress schedule', eventId);
    return this.prisma.opsSupplierSchedule.findMany({ where: { eventId }, include: { request: true }, orderBy: { ingressAt: 'asc' } });
  }

  private requireSupplierAdmin(actor: ResolvedEventOpsActor, resource: string, eventId?: string) {
    return this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      resource,
      eventId,
    );
  }

  private async requireSupplierQuoteRequestForActor(requestId: string, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Supplier], 'supplier quote request');
    const supplier = await this.resolveSupplierForActor(actor);
    const request = await this.prisma.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Supplier quote request not found');
    if (request.supplierId !== supplier.id) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'supplier quote request', request.id);
      throw new ForbiddenException('Supplier cannot access this quote request');
    }
    return request;
  }

  private async resolveSupplierForActor(actor: ResolvedEventOpsActor) {
    const suppliers = await this.suppliersService.listSuppliers();
    const supplier = suppliers.find(
      (item) =>
        this.eventAccessPolicyService.sameText(actor.supplierId, item.id) ||
        this.eventAccessPolicyService.sameText(actor.email, item.email) ||
        (!actor.verified && this.eventAccessPolicyService.sameText(actor.name, item.name)),
    );
    if (!supplier) throw new NotFoundException('Supplier profile not found for actor');
    return supplier;
  }

  private async auditPareDecision(
    result: PAREApprovalRecord,
    approvalRecordId: string,
    actorName: string,
    decision: 'approved' | 'rejected',
  ) {
    try {
      const candidate = result.pareResult?.budgetAnalysis?.selectedCandidate;
      await writeAudit(this.auditWriter,
        result.eventId,
        actorName,
        `PARE recommendation ${decision}: ${candidate?.supplierName ?? 'unknown supplier'}`,
        {
          actorRole: OpsUserRole.PmcmAdmin,
          actionType: decision === 'approved' ? 'pare_approved' : 'pare_rejected',
          category: AuditCategory.Suppliers,
          affectedType: 'pare_approval',
          affectedId: approvalRecordId,
          affectedLabel: candidate?.supplierName,
          metadata: { approvalRecordId, candidate },
        },
      );
    } catch {
      // PARE approval state is authoritative even if audit logging is unavailable.
    }
  }

  validateUploadMetadata(input: UploadMetadataInput, prefix: string) {
    return this.documentVaultService.validateUploadMetadata(input, prefix);
  }
}
