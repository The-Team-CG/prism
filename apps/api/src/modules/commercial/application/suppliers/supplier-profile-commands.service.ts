import { Inject, Injectable } from '@nestjs/common';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import {
  AuditActionType,
  AuditCategory,
  OpsUserRole,
  WorkflowCommandService,
} from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import type {
  ChangeSupplierTierInput,
  CreateSupplierCertificationInput,
  CreateSupplierInput,
  CreateSupplierReviewInput,
  AddSupplierReviewResult,
  SupplierDirectory,
  SupplierProfile,
  UpdateSupplierInput,
} from '../../contracts/supplier-directory.port';
import type { CreateSupplierReliabilityNoteInput, PromoteSupplierInput } from '@prism/types';
import { SUPPLIER_DIRECTORY } from '../../contracts/supplier-ops.tokens';

type SupplierResult = SupplierProfile;
type ChangeSupplierTierResult = Awaited<ReturnType<SupplierDirectory['changeSupplierTier']>>;

@Injectable()
export class SupplierProfileCommandsService {
  constructor(
    @Inject(SUPPLIER_DIRECTORY) private readonly suppliersService: SupplierDirectory,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly workflowCommandService: WorkflowCommandService,
  ) {}

  async createSupplier(input: CreateSupplierInput, actor: ResolvedEventOpsActor) {
    return this.workflowCommandService.execute<SupplierResult>({
      name: 'create_supplier',
      validatePermission: () => this.requireSupplierAdmin(actor, 'supplier creation'),
      write: () => this.suppliersService.createSupplier(input),
      sideEffects: async (supplier) => {
        await writeAudit(this.auditWriter, undefined, actor.name, `Created supplier profile: ${supplier.name}`, {
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
        await writeAudit(this.auditWriter, undefined, actor.name, `Updated supplier profile: ${supplier.name}`, {
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
        await writeAudit(this.auditWriter, undefined, actor.name, `Changed supplier tier: ${result.supplier.name}`, {
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
    return this.workflowCommandService.execute<AddSupplierReviewResult, SupplierResult>({
      name: 'add_supplier_review',
      eventId: input.eventId,
      sideEffectMode: 'same_tx',
      validatePermission: () => this.requireSupplierAdmin(actor, 'supplier private review', input.eventId),
      write: (transactionContext) =>
        this.suppliersService.addSupplierReview(supplierId, {
          ...input,
          reviewedBy: actor.name || input.reviewedBy || 'System',
        }, transactionContext),
      sideEffects: async (result, transactionContext) => {
        if (result.replayed) return;
        await writeAudit(this.auditWriter, input.eventId, actor.name, `Added private supplier review: ${result.supplier.name}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          category: AuditCategory.Suppliers,
          actionType: AuditActionType.Create,
          affectedType: 'supplier_review',
          affectedId: result.reviewId,
          affectedLabel: result.supplier.name,
          metadata: { rating: input.rating },
        }, transactionContext);
      },
      project: (result) => result.supplier,
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
        await writeAudit(this.auditWriter, undefined, actor.name, `Added supplier certification: ${supplier.name}`, {
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

  async addReliabilityNote(supplierId: string, input: CreateSupplierReliabilityNoteInput, actor: ResolvedEventOpsActor) {
    return this.workflowCommandService.execute<{ supplier: SupplierResult; noteId: string; replayed?: boolean }, SupplierResult>({
      name: 'add_supplier_reliability_note',
      eventId: input.eventId,
      sideEffectMode: 'same_tx',
      validatePermission: () => this.requireSupplierAdmin(actor, 'supplier private reliability note', input.eventId),
      write: (transactionContext) => this.suppliersService.addReliabilityNote(supplierId, input, transactionContext, actor.name),
      sideEffects: async (result, transactionContext) => {
        if (result.replayed) return;
        const supplier = result.supplier;
        await writeAudit(this.auditWriter, input.eventId, actor.name, `Added private supplier reliability note: ${supplier.name}`, {
          actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Suppliers,
          actionType: AuditActionType.Create, affectedType: 'supplier_reliability_note', affectedId: result.noteId,
          affectedLabel: supplier.name, metadata: { idempotencyKey: input.idempotencyKey ?? null },
        }, transactionContext);
      },
      project: (result) => result.supplier,
    });
  }

  async promoteSupplier(supplierId: string, input: PromoteSupplierInput, actor: ResolvedEventOpsActor) {
    return this.workflowCommandService.execute<SupplierResult>({
      name: 'promote_supplier', eventId: input.eventId, sideEffectMode: 'same_tx',
      validatePermission: () => this.requireSupplierAdmin(actor, 'supplier promotion', input.eventId),
      write: (transactionContext) => this.suppliersService.promoteSupplier(supplierId, input, transactionContext, actor.name),
      sideEffects: async (supplier) => {
        await writeAudit(this.auditWriter, input.eventId, actor.name, `Promoted supplier: ${supplier.name}`, {
          actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Suppliers,
          actionType: AuditActionType.Update, affectedType: 'supplier', affectedId: supplier.id,
          affectedLabel: supplier.name, metadata: { tier: input.tier, reason: input.reason },
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
}
