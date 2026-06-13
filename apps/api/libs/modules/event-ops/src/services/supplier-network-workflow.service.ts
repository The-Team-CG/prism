import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsSupplierQuoteRequest } from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, OpsUserRole } from '../ops.constants';
import { AuditService } from './audit.service';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from './event-access-policy.service';
import {
  type ChangeSupplierTierInput,
  type CreateSupplierCertificationInput,
  type CreateSupplierInput,
  type CreateSupplierReviewInput,
  SuppliersService,
  type UpdateSupplierInput,
} from './suppliers.service';
import { WorkflowCommandService } from './workflow-command.service';

type SupplierResult = Awaited<ReturnType<SuppliersService['createSupplier']>>;
type ChangeSupplierTierResult = Awaited<ReturnType<SuppliersService['changeSupplierTier']>>;

export type UploadMetadataInput = {
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
};

export type SupplierReadinessInput = {
  notes?: string;
};

export type SupplierEventStatusInput = {
  status: string;
  notes?: string;
  photo?: UploadMetadataInput;
};

const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'video/mp4': ['mp4'],
  'video/quicktime': ['mov'],
};

@Injectable()
export class SupplierNetworkWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppliersService: SuppliersService,
    private readonly auditService: AuditService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly workflowCommandService: WorkflowCommandService,
  ) {}

  async createSupplier(input: CreateSupplierInput, actor: ResolvedEventOpsActor) {
    return this.workflowCommandService.execute<SupplierResult>({
      name: 'create_supplier',
      validatePermission: () => this.requireSupplierAdmin(actor, 'supplier creation'),
      write: () => this.suppliersService.createSupplier(input),
      sideEffects: async (supplier) => {
        await this.auditService.audit(undefined, actor.name, `Created supplier profile: ${supplier.name}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          category: AuditCategory.Suppliers,
          actionType: AuditActionType.Create,
          affectedType: 'supplier',
          affectedId: supplier.id,
          affectedLabel: supplier.name,
        });
      },
    });
  }

  async updateSupplier(supplierId: string, input: UpdateSupplierInput, actor: ResolvedEventOpsActor) {
    return this.workflowCommandService.execute<SupplierResult>({
      name: 'update_supplier',
      validatePermission: () => this.requireSupplierAdmin(actor, 'supplier update'),
      write: () => this.suppliersService.updateSupplier(supplierId, input),
      sideEffects: async (supplier) => {
        await this.auditService.audit(undefined, actor.name, `Updated supplier profile: ${supplier.name}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          category: AuditCategory.Suppliers,
          actionType: AuditActionType.Update,
          affectedType: 'supplier',
          affectedId: supplier.id,
          affectedLabel: supplier.name,
          metadata: input,
        });
      },
    });
  }

  async changeSupplierTier(supplierId: string, input: ChangeSupplierTierInput, actor: ResolvedEventOpsActor) {
    return this.workflowCommandService.execute<ChangeSupplierTierResult, SupplierResult>({
      name: 'change_supplier_tier',
      validatePermission: () => this.requireSupplierAdmin(actor, 'supplier tier change'),
      write: () => this.suppliersService.changeSupplierTier(supplierId, input),
      sideEffects: async (result) => {
        await this.auditService.audit(undefined, actor.name, `Changed supplier tier: ${result.supplier.name}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          category: AuditCategory.Suppliers,
          actionType: AuditActionType.Update,
          affectedType: 'supplier',
          affectedId: result.supplier.id,
          affectedLabel: result.supplier.name,
          metadata: {
            oldTier: result.oldTier,
            newTier: input.tier,
            reason: input.reason,
          },
        });
      },
      project: (result) => result.supplier,
    });
  }

  async addSupplierReview(supplierId: string, input: CreateSupplierReviewInput, actor: ResolvedEventOpsActor) {
    return this.workflowCommandService.execute<SupplierResult>({
      name: 'add_supplier_review',
      eventId: input.eventId,
      validatePermission: () => this.requireSupplierAdmin(actor, 'supplier private review', input.eventId),
      write: () =>
        this.suppliersService.addSupplierReview(supplierId, {
          ...input,
          reviewedBy: input.reviewedBy ?? actor.name,
        }),
      sideEffects: async (supplier) => {
        await this.auditService.audit(input.eventId, actor.name, `Added private supplier review: ${supplier.name}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          category: AuditCategory.Suppliers,
          actionType: AuditActionType.Create,
          affectedType: 'supplier_review',
          affectedId: supplier.id,
          affectedLabel: supplier.name,
          metadata: { rating: input.rating },
        });
      },
    });
  }

  async addSupplierCertification(
    supplierId: string,
    input: CreateSupplierCertificationInput,
    actor: ResolvedEventOpsActor,
  ) {
    return this.workflowCommandService.execute<SupplierResult>({
      name: 'add_supplier_certification',
      validatePermission: () => this.requireSupplierAdmin(actor, 'supplier certification'),
      write: () => this.suppliersService.addSupplierCertification(supplierId, input),
      sideEffects: async (supplier) => {
        await this.auditService.audit(undefined, actor.name, `Added supplier certification: ${supplier.name}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          category: AuditCategory.Suppliers,
          actionType: AuditActionType.Upload,
          affectedType: 'supplier_certification',
          affectedId: supplier.id,
          affectedLabel: input.fileName,
          metadata: {
            documentType: input.documentType,
            issuer: input.issuer ?? '',
            expiresAt: input.expiresAt ?? null,
            status: input.status ?? 'submitted',
          },
        });
      },
    });
  }

  async confirmSupplierAssignment(requestId: string, actor: ResolvedEventOpsActor) {
    let request: OpsSupplierQuoteRequest | null = null;

    return this.workflowCommandService.execute<OpsSupplierQuoteRequest>({
      name: 'confirm_supplier_assignment',
      validatePermission: async () => {
        request = await this.requireSupplierQuoteRequestForActor(requestId, actor);
      },
      write: () => {
        if (!request) throw new NotFoundException('Supplier quote request not found');
        return this.prisma.opsSupplierQuoteRequest.update({
          where: { id: request.id },
          data: {
            assignmentStatus: 'confirmed',
            assignmentConfirmedAt: new Date(),
          },
        });
      },
      sideEffects: async (updated) => {
        if (!request) return;
        await this.auditService.audit(request.eventId, actor.name, `Confirmed supplier assignment: ${request.supplierName}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Update,
          category: AuditCategory.Suppliers,
          affectedType: 'supplier_quote_request',
          affectedId: request.id,
          affectedLabel: request.supplierName,
          metadata: { assignmentStatus: updated.assignmentStatus ?? 'confirmed' },
        });
      },
    });
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
        await this.auditService.audit(request.eventId, actor.name, `Confirmed supplier readiness: ${request.supplierName}`, {
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
    let photo: ReturnType<SupplierNetworkWorkflowService['validateUploadMetadata']> | null = null;

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
        await this.auditService.audit(request.eventId, actor.name, `Supplier status update: ${input.status}`, {
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

  async uploadSupplierContract(requestId: string, input: UploadMetadataInput, actor: ResolvedEventOpsActor) {
    let request: OpsSupplierQuoteRequest | null = null;
    let upload: ReturnType<SupplierNetworkWorkflowService['validateUploadMetadata']> | null = null;

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
        await this.auditService.audit(request.eventId, actor.name, `Uploaded supplier contract: ${request.supplierName}`, {
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

  validateUploadMetadata(input: UploadMetadataInput, prefix: string) {
    const fileName = input.fileName?.trim();
    if (!fileName) throw new BadRequestException('File name is required');
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = input.mimeType?.trim().toLowerCase() ?? '';
    const allowedExtensions = ALLOWED_UPLOAD_TYPES[mimeType];
    if (!allowedExtensions || !allowedExtensions.includes(extension)) {
      throw new BadRequestException('Unsupported file type');
    }
    const sizeBytes = input.sizeBytes ?? 0;
    if (sizeBytes <= 0) throw new BadRequestException('File size is required');
    if (sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException('File exceeds allowed size');
    }
    const generatedFileName = `${randomUUID()}.${extension}`;
    const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
    return {
      originalFileName: fileName.replace(/^.*[\\/]/, ''),
      generatedFileName,
      mimeType,
      sizeBytes,
      storageBucket: 'document-vault',
      storageKey: `${cleanPrefix}/${generatedFileName}`,
      validationStatus: 'accepted',
    };
  }
}
