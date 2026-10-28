import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsSupplierQuoteRequest, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { createHash, randomUUID } from 'node:crypto';
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
import { DOCUMENT_VAULT, type DocumentVault, type ValidatedUploadMetadata } from '@prism/contexts/event-lifecycle';
import {
  type ChangeSupplierTierInput,
  type CreateSupplierCertificationInput,
  type CreateSupplierInput,
  type CreateSupplierReviewInput,
  type SupplierDirectory,
  type UpdateSupplierInput,
} from '../../contracts/supplier-directory.port';
import type { SupplierCommands, SupplierEventStatusInput, SupplierReadinessInput, VerifySupplierEventStatusInput } from '../../contracts/supplier-commands.port';
import {
  SUPPLIER_DIRECTORY,
} from '../../contracts/supplier-ops.tokens';
import {
  PARE_APPROVAL_GOVERNANCE,
  PARE_DISPATCH_WRITER,
  NOTIFICATION_OUTBOX_WRITER,
  type NotificationOutboxWriter,
  writeNotification,
  type PareApprovalGovernance,
  type PareDispatchWriter,
  type PAREApprovalRecord,
} from '@prism/contexts/platform-ops';
import { SupplierProfileCommandsService } from './supplier-profile-commands.service';
import type {
  CorrectSupplierEventStatusInput,
  CreateSupplierReliabilityNoteInput,
  PromoteSupplierInput,
  CreateSupplierScheduleInput,
  PrismSupplierQuoteRequest,
  PrismVerifiedEventActor,
  UploadContractInput,
  UploadMetadataInput,
} from '@prism/types';
import { mapSupplierQuoteRequest, mapSupplierQuoteRequestForSupplier, mapSupplierSchedule, omitPmcmReviewFields } from '../quotes/supplier-quote.mappers';
import { OPERATIONS_EVENT_REFERENCE_READER, type OperationsEventReferenceReader } from '@prism/contexts/event-lifecycle/operations-reference';

async function lockSupplierQuoteRequest(prisma: Prisma.TransactionClient, requestId: string) {
  await prisma.$queryRaw`SELECT id FROM "commercial"."quote_requests" WHERE id = ${requestId} FOR UPDATE`; // QUERY_AUDIT_RAW_SQL: parameterized primary-key row lock rechecks assignment state and identity.
}

async function lockActiveEvent(prisma: Prisma.TransactionClient, eventId: string, actor: ResolvedEventOpsActor, eventReferences: OperationsEventReferenceReader) {
  if (actor.eventId && actor.eventId !== eventId) throw new ForbiddenException('Actor cannot access this event');
  const event = await eventReferences.findOperationsEvent(eventId, { prisma, correlationId: `supplier-event:${eventId}` });
  if (!event || event.archived) throw new NotFoundException('Active event not found');
}

const SUPPLIER_EVENT_STATUS_ORDER = ['arrived', 'set_up_ready', 'done_leaving'] as const;
const SUPPLIER_EVENT_STATUS_LABELS: Record<string, string> = {
  not_started: 'not started',
  arrived: 'arrived',
  set_up_ready: 'set-up ready',
  done_leaving: 'done leaving',
};

/**
 * Supplier-reported event-day status moves forward one step at a time. Any
 * unreported state (not_started, planned, or the automatic late flag) counts
 * as "before arrived". A repeat of the current status is handled by the caller.
 */
function assertSupplierEventStatusStep(current: string, next: string): void {
  const currentIndex = SUPPLIER_EVENT_STATUS_ORDER.findIndex((status) => status === current);
  const nextIndex = SUPPLIER_EVENT_STATUS_ORDER.findIndex((status) => status === next);
  if (nextIndex === currentIndex + 1) return;
  const expected = SUPPLIER_EVENT_STATUS_ORDER[currentIndex + 1];
  const nextLabel = SUPPLIER_EVENT_STATUS_LABELS[next] ?? next;
  if (!expected) {
    throw new BadRequestException(`Event-day status is already complete and cannot move back to "${nextLabel}".`);
  }
  const expectedLabel = SUPPLIER_EVENT_STATUS_LABELS[expected];
  const direction = nextIndex < currentIndex ? 'cannot move backward to' : 'cannot skip ahead to';
  throw new BadRequestException(`Event-day status ${direction} "${nextLabel}". Report "${expectedLabel}" next, in order: arrived, set-up ready, done leaving.`);
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
export class SupplierNetworkWorkflowService implements SupplierCommands {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SUPPLIER_DIRECTORY) private readonly suppliersService: SupplierDirectory,
    private readonly supplierProfileCommandsService: SupplierProfileCommandsService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(PARE_APPROVAL_GOVERNANCE) private readonly pareGovernance: PareApprovalGovernance,
    @Inject(PARE_DISPATCH_WRITER) private readonly pareDispatchWriter: PareDispatchWriter,
    @Inject(DOCUMENT_VAULT) private readonly documentVaultService: DocumentVault,
    @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly eventReferences: OperationsEventReferenceReader,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
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

    const updated = await this.workflowCommandService.execute<OpsSupplierQuoteRequest>({
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
    return mapSupplierQuoteRequestForSupplier(updated);
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
          data: { assignmentStatus: 'withdrawn', accessTokenRevokedAt: new Date() },
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
    return mapSupplierQuoteRequest(result.request);
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

    const updated = await this.workflowCommandService.execute<OpsSupplierQuoteRequest>({
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
    return mapSupplierQuoteRequestForSupplier(updated);
  }

  async updateSupplierEventStatus(
    requestId: string,
    input: SupplierEventStatusInput,
    actor: ResolvedEventOpsActor,
  ) {
    let request: OpsSupplierQuoteRequest | null = null;
    let photo: ValidatedUploadMetadata | null = null;
    let replay = false;

    const updated = await this.workflowCommandService.execute<OpsSupplierQuoteRequest>({
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
        replay = request.eventDayStatus === input.status;
        if (!replay) assertSupplierEventStatusStep(request.eventDayStatus, input.status);
        photo = input.photo ? this.validateUploadMetadata(input.photo, `events/${request.eventId}/supplier-status`) : null;
      },
      write: (transactionContext) => {
        if (!request) throw new NotFoundException('Supplier quote request not found');
        if (replay) return Promise.resolve(request);
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
        if (!request || replay) return;
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
    return mapSupplierQuoteRequestForSupplier(updated);
  }

  /**
   * PMCM-only correction path for a supplier's event-day status. Unlike the supplier's own forward-only updates it
   * may move the status in any direction, but needs a reason; the supplier then continues from the corrected status.
   */
  async correctSupplierEventStatus(
    eventId: string,
    requestId: string,
    input: CorrectSupplierEventStatusInput,
    actor: ResolvedEventOpsActor,
  ) {
    let request: OpsSupplierQuoteRequest | null = null;
    let previousStatus = '';
    let replay = false;
    const reason = input.reason?.trim();

    const updated = await this.workflowCommandService.execute<OpsSupplierQuoteRequest>({
      name: 'correct_supplier_event_status',
      eventId,
      validatePermission: () => this.requireSupplierAdmin(actor, 'supplier event-day status correction', eventId),
      validateState: async () => {
        if (!reason) throw new BadRequestException('A reason is required to correct a supplier status');
        request = await this.prisma.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } });
        if (request?.eventId !== eventId) request = null;
        if (!request) throw new NotFoundException('Supplier quote request not found');
        if (request.status !== 'selected') {
          throw new BadRequestException('Only a selected supplier assignment has an event-day status to correct');
        }
        previousStatus = request.eventDayStatus;
        replay = previousStatus === input.status;
      },
      write: (transactionContext) => {
        if (!request) throw new NotFoundException('Supplier quote request not found');
        if (replay) return Promise.resolve(request);
        const prisma = transactionContext?.prisma ?? this.prisma;
        return prisma.opsSupplierQuoteRequest.update({
          where: { id: request.id },
          data: {
            eventDayStatus: input.status,
            eventDayStatusAt: new Date(),
          },
        });
      },
      sideEffects: async (saved, transactionContext) => {
        if (!request || replay) return;
        const key = `supplier-event-status-correction:${request.id}:${saved.eventDayStatusAt?.getTime() ?? Date.now()}`;
        await writeAudit(this.auditWriter, request.eventId, actor.name, `Corrected supplier event-day status: ${request.supplierName}, ${previousStatus} to ${input.status}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Update,
          category: AuditCategory.Suppliers,
          affectedType: 'supplier_quote_request',
          affectedId: request.id,
          affectedLabel: request.supplierName,
          metadata: { actorId: actor.id, previousStatus, status: input.status, reason },
        }, transactionContext);
        const supplier = request.supplierId
          ? await this.prisma.opsSupplier.findUnique({ where: { id: request.supplierId }, select: { email: true } })
          : null;
        await writeNotification(
          this.notificationOutboxWriter,
          request.eventId,
          supplier?.email.trim() || request.supplierName,
          `PMCM corrected your event-day status to "${SUPPLIER_EVENT_STATUS_LABELS[input.status] ?? input.status.replace(/_/g, ' ')}". Reason: ${reason}`,
          'email',
          { idempotencyKey: key },
          transactionContext,
        );
      },
    });
    return mapSupplierQuoteRequest(updated);
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

    const updated = await this.workflowCommandService.execute<OpsSupplierQuoteRequest>({
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
    return mapSupplierQuoteRequest(updated);
  }

  async uploadSupplierContract(
    requestId: string,
    input: UploadContractInput,
    actor: ResolvedEventOpsActor,
    verifiedActor: PrismVerifiedEventActor,
  ) {
    let request: OpsSupplierQuoteRequest = await this.requireSupplierQuoteRequestForActor(requestId, actor);
    this.assertVerifiedSupplierActor(verifiedActor, actor, request);
    const upload: ValidatedUploadMetadata = this.validateUploadMetadata(input, `events/${request.eventId}/supplier-contracts`);
    const payloadHash = createHash('sha256').update(JSON.stringify({
      requestId,
      eventId: request.eventId,
      documentKind: 'supplier_contract',
      fileName: upload.originalFileName,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
    })).digest('hex');

    const updated = await this.workflowCommandService.execute<
      OpsSupplierQuoteRequest,
      PrismSupplierQuoteRequest
    >({
      name: 'upload_supplier_contract',
      eventId: request.eventId,
      context: {
        actorId: verifiedActor.actorId,
        actorRole: verifiedActor.actorRole,
        eventId: request.eventId,
        correlationId: `supplier-contract:${requestId}:${input.idempotencyKey}`,
        idempotencyKey: input.idempotencyKey,
      },
      sideEffectMode: 'same_tx',
      idempotencyPayloadHash: payloadHash,
      validatePermission: async () => {
        const current = await this.requireSupplierQuoteRequestForActor(requestId, actor);
        if (current.eventId !== request?.eventId || current.supplierId !== request?.supplierId) {
          throw new NotFoundException('Supplier quote request not found');
        }
        this.assertVerifiedSupplierActor(verifiedActor, actor, current);
        request = current;
      },
      validateState: () => {
        if (!request) throw new NotFoundException('Supplier quote request not found');
      },
      validateStateInTransaction: async (transactionContext) => {
        if (!request) throw new NotFoundException('Supplier quote request not found');
        const current = await transactionContext.prisma.opsSupplierQuoteRequest.findUnique({ where: { id: requestId } });
        if (!current || current.eventId !== request.eventId || current.supplierId !== request.supplierId) {
          throw new NotFoundException('Supplier quote request not found');
        }
        request = current;
      },
      write: async (transactionContext) => {
        if (!request) throw new NotFoundException('Supplier quote request not found');
        const document = await this.documentVaultService.registerDocument({
          eventId: request.eventId,
          documentKind: 'supplier_contract',
          logicalTarget: { kind: 'supplier_quote_request', id: request.id },
          fileName: upload.originalFileName,
          generatedFileName: upload.generatedFileName,
          mimeType: upload.mimeType,
          sizeBytes: upload.sizeBytes,
          validationStatus: upload.validationStatus,
          storageBucket: upload.storageBucket,
          storageKey: upload.storageKey,
          status: 'submitted',
          verifiedActor,
          idempotencyKey: input.idempotencyKey,
        }, transactionContext);
        const db = transactionContext?.prisma ?? this.prisma;
        return db.opsSupplierQuoteRequest.update({
          where: { id: request.id },
          data: { contractDocumentId: document.id },
        });
      },
      sideEffects: async (updated, transactionContext) => {
        if (!request) return;
        await writeAudit(this.auditWriter, request.eventId, actor.name, `Uploaded supplier contract: ${request.supplierName}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Upload,
          category: AuditCategory.Documents,
          affectedType: 'document',
          affectedId: updated.contractDocumentId ?? undefined,
          affectedLabel: upload.originalFileName,
        }, transactionContext);
      },
      project: mapSupplierQuoteRequestForSupplier,
    });
    // Replays return the stored receipt result verbatim, so receipts written before the projection fix
    // may still carry PMCM review fields. Sanitize at the response boundary for fresh and replayed results.
    return omitPmcmReviewFields(updated);
  }

  private assertVerifiedSupplierActor(
    verifiedActor: PrismVerifiedEventActor,
    actor: ResolvedEventOpsActor,
    request: OpsSupplierQuoteRequest,
  ) {
    if (
      verifiedActor.actorRole !== OpsUserRole.Supplier ||
      !verifiedActor.supplierId ||
      verifiedActor.supplierId !== request.supplierId ||
      verifiedActor.actorId !== actor.id
    ) {
      throw new ForbiddenException('Verified supplier identity does not match the contract request');
    }
  }

  async createSupplierSchedule(eventId: string, input: CreateSupplierScheduleInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator], 'supplier ingress schedule', eventId);
    const ingressAt = new Date(input.ingressAt);
    const egressAt = new Date(input.egressAt);
    if (egressAt <= ingressAt) throw new BadRequestException('Egress must be after ingress');
    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockActiveEvent(tx, eventId, actor, this.eventReferences);
      await lockSupplierQuoteRequest(tx, input.requestId);
      const request = await tx.opsSupplierQuoteRequest.findUnique({ where: { id: input.requestId } });
      if (!request || request.eventId !== eventId || request.status !== 'selected' || request.assignmentStatus !== 'confirmed') {
        throw new BadRequestException('Only a confirmed supplier assignment can receive a schedule');
      }
      const location = input.location ?? '';
      const notes = input.notes ?? '';
      const current = await tx.opsSupplierSchedule.findUnique({ where: { requestId: input.requestId } });
      if (current && current.ingressAt.getTime() === ingressAt.getTime() && current.egressAt.getTime() === egressAt.getTime() &&
        current.location === location && current.notes === notes) {
        return { schedule: current, supplierName: request.supplierName };
      }
      const schedule = await tx.opsSupplierSchedule.upsert({
        where: { requestId: input.requestId },
        create: { id: `ss_${randomUUID()}`, eventId, requestId: input.requestId, ingressAt, egressAt, location, notes },
        update: {
          ingressAt,
          egressAt,
          location,
          notes,
          status: 'planned',
          revision: { increment: 1 },
          acknowledgedRevision: null,
          acknowledgedAt: null,
          acknowledgedBy: null,
          changeRequestNote: null,
          changeRequestedAt: null,
        },
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
      return { schedule, supplierName: request.supplierName };
    });
    return mapSupplierSchedule(result.schedule, result.supplierName);
  }

  async listSupplierSchedules(eventId: string, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator], 'supplier ingress schedule', eventId);
    const schedules = await this.prisma.opsSupplierSchedule.findMany({
      where: { eventId },
      include: { request: { select: { supplierName: true } } },
      orderBy: { ingressAt: 'asc' },
    });
    return schedules.map(({ request, ...schedule }) => mapSupplierSchedule(schedule, request.supplierName));
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
