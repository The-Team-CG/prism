import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { OpsEvent, OpsSupplierQuoteRequest, Prisma } from '@prisma/client';
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
import type { SupplierPareApprovalRecord, SupplierPareAutomation } from '../../contracts/supplier-pare-automation.port';
import {
  SUPPLIER_DIRECTORY,
  SUPPLIER_DOCUMENT_VAULT,
  SUPPLIER_PARE_AUTOMATION,
} from '../../contracts/supplier-ops.tokens';
import { SupplierProfileCommandsService } from './supplier-profile-commands.service';

@Injectable()
export class SupplierNetworkWorkflowService {
  private readonly logger = new Logger(SupplierNetworkWorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SUPPLIER_DIRECTORY) private readonly suppliersService: SupplierDirectory,
    private readonly supplierProfileCommandsService: SupplierProfileCommandsService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(SUPPLIER_PARE_AUTOMATION) private readonly pareService: SupplierPareAutomation,
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

  async addSupplierCertification(
    supplierId: string,
    input: CreateSupplierCertificationInput,
    actor: ResolvedEventOpsActor,
  ) {
    return this.supplierProfileCommandsService.addSupplierCertification(supplierId, input, actor);
  }

  async confirmSupplierAssignment(requestId: string, actor: ResolvedEventOpsActor) {
    let request: OpsSupplierQuoteRequest | null = null;

    return this.workflowCommandService.execute<OpsSupplierQuoteRequest>({
      name: 'confirm_supplier_assignment',
      context: { actorId: actor.id ?? actor.name, actorRole: actor.role, correlationId: `supplier-confirm:${requestId}` },
      sideEffectMode: 'same_tx',
      validatePermission: async () => {
        request = await this.requireSupplierQuoteRequestForActor(requestId, actor);
        if (request.status !== 'selected' || !request.supplierId) {
          throw new BadRequestException('Only a selected supplier assignment can be confirmed');
        }
      },
      write: (transactionContext) => {
        if (!request) throw new NotFoundException('Supplier quote request not found');
        const prisma = transactionContext?.prisma ?? this.prisma;
        return prisma.opsSupplierQuoteRequest.update({
          where: { id: request.id },
          data: {
            assignmentStatus: 'confirmed',
            assignmentConfirmedAt: new Date(),
          },
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

  async withdrawSupplier(requestId: string, reason: string, actor: ResolvedEventOpsActor) {
    let request: OpsSupplierQuoteRequest | null = null;

    return this.workflowCommandService.execute<
      { request: OpsSupplierQuoteRequest; event: OpsEvent | null },
      OpsSupplierQuoteRequest
    >({
      name: 'withdraw_supplier',
      validatePermission: () => this.requireSupplierAdmin(actor, 'withdraw supplier'),
      validateState: async () => {
        request = await this.prisma.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new NotFoundException('Supplier quote request not found');
      },
      write: async () => {
        if (!request) throw new NotFoundException('Supplier quote request not found');
        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          const [updated, event] = await Promise.all([
            tx.opsSupplierQuoteRequest.update({
              where: { id: request!.id },
              data: { assignmentStatus: 'withdrawn' },
              include: { supplier: true },
            }),
            tx.opsEvent.findUnique({ where: { id: request!.eventId } }),
          ]);
          return { request: updated, event };
        });
      },
      sideEffects: async (result) => {
        if (!request) return;
        try {
          await writeAudit(this.auditWriter, request.eventId, actor.name, `Supplier withdrawn: ${request.supplierName}. Reason: ${reason}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            actionType: AuditActionType.Update,
            category: AuditCategory.Suppliers,
            affectedType: 'supplier_quote_request',
            affectedId: request.id,
            affectedLabel: request.supplierName,
          });
        } catch {
          // Supplier withdrawal should not be rolled back by an audit logging outage.
        }

        void this.triggerPareForWithdrawnSupplier(request, result.request, result.event);
      },
      project: (result) => result.request,
    });
  }

  pareGetPendingApprovals(eventId?: string) {
    return this.pareService.getPendingApprovals(eventId);
  }

  async pareApprove(approvalRecordId: string, approvedBy: string) {
    const result = await this.pareService.approveRecommendation(approvalRecordId, approvedBy);
    await this.auditPareDecision(result, approvalRecordId, approvedBy, 'approved');
    return result;
  }

  async pareReject(approvalRecordId: string, rejectedBy: string) {
    const result = await this.pareService.rejectRecommendation(approvalRecordId, rejectedBy);
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
      },
      write: () => {
        if (!request) throw new NotFoundException('Supplier quote request not found');
        return this.prisma.opsSupplierQuoteRequest.update({
          where: { id: request.id },
          data: {
            readinessStatus: 'confirmed',
            readinessConfirmedAt: new Date(),
            readinessNotes: input.notes?.trim() ?? '',
          },
        });
      },
      sideEffects: async () => {
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
        });
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
      },
      validateState: () => {
        const allowed = ['arrived', 'set_up_ready', 'done_leaving'];
        if (!allowed.includes(input.status)) throw new BadRequestException('Unsupported supplier event-day status');
        if (!request) throw new NotFoundException('Supplier quote request not found');
        photo = input.photo ? this.validateUploadMetadata(input.photo, `events/${request.eventId}/supplier-status`) : null;
      },
      write: () => {
        if (!request) throw new NotFoundException('Supplier quote request not found');
        return this.prisma.opsSupplierQuoteRequest.update({
          where: { id: request.id },
          data: {
            eventDayStatus: input.status,
            eventDayStatusAt: new Date(),
            eventDayNotes: input.notes?.trim() ?? '',
            statusPhotoFileName: photo?.generatedFileName ?? null,
          },
        });
      },
      sideEffects: async () => {
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
        });
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
        this.eventAccessPolicyService.sameText(actor.name, item.name),
    );
    if (!supplier) throw new NotFoundException('Supplier profile not found for actor');
    return supplier;
  }

  private async triggerPareForWithdrawnSupplier(
    originalRequest: OpsSupplierQuoteRequest,
    updatedRequest: OpsSupplierQuoteRequest,
    event: OpsEvent | null,
  ) {
    const prefetched = event ? { request: updatedRequest, event } : undefined;
    try {
      const approval = await this.pareService.handleEmergencyTrigger(originalRequest.id, prefetched);
      const candidate = approval.pareResult?.budgetAnalysis?.selectedCandidate;
      const label = candidate?.supplierName
        ? `Recommended: ${candidate.supplierName} (${approval.pareResult?.mode ?? 'mock'} mode)`
        : 'PARE engine completed';
      await writeAudit(this.auditWriter,
        originalRequest.eventId,
        'PARE Engine',
        `PARE triggered for ${originalRequest.supplierName} - ${label}`,
        {
          actorRole: OpsUserRole.System,
          actionType: 'pare_triggered',
          category: AuditCategory.Suppliers,
          affectedType: 'supplier_quote_request',
          affectedId: originalRequest.id,
          affectedLabel: originalRequest.supplierName,
          metadata: { approvalRecordId: approval.id, mode: approval.pareResult?.mode },
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`PARE trigger failed for request ${originalRequest.id}: ${message}`);
    }
  }

  private async auditPareDecision(
    result: SupplierPareApprovalRecord,
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
