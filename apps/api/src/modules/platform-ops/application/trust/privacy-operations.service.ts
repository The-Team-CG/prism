import { Inject, Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { COMMERCIAL_PRIVACY_REDACTOR, type CommercialPrivacyRedactor } from '@prism/contexts/commercial';
import { LIFECYCLE_PRIVACY_REDACTOR, type LifecyclePrivacyRedactor } from '@prism/contexts/event-lifecycle';
import { IDENTITY_PRIVACY_REDACTOR, type IdentityPrivacyRedactor } from '@prism/contexts/identity-access';
import { OPERATIONS_PRIVACY_REDACTOR, type OperationsPrivacyRedactor } from '@prism/contexts/operations';
import { PLATFORM_REFERENCE_READ_MODEL, type PlatformReferenceReadModel } from '@prism/contexts/read-models';
import { privacyCorrectionPatchSchema, type PrivacyCorrectionPatch } from '@prism/types';
import type {
  CreatePrivacyLegalHoldInput,
  ListPrivacyLegalHoldsQuery,
  PrismPrivacyExecutionResult,
  PrismPrivacyExportBundle,
  PrismPrivacyExportSection,
  PrismPrivacyLegalHold,
  ReleasePrivacyLegalHoldInput,
} from '@prism/types';
import { randomUUID } from 'node:crypto';
import {
  AuditActionType,
  AuditCategory,
  OpsUserRole,
  PrivacyRequestStatus,
  PrivacyRequestType,
  isOpsConstantValue,
} from '@prism/kernel/event-core';
import { AuditService } from './audit.service';
import {
  activeLegalHoldWhere,
  exactActiveLegalHoldWhere,
  normalizePrivacyLegalHoldScope,
  privacyLegalHoldLockKeys,
  privacyRequestLegalHoldScope,
  type PrivacyLegalHoldScope,
} from './privacy-legal-hold.policy';
import { requireVerifiedTrustActor } from './verified-trust-actor';
import { mapPrivacyRequest, privacyRequestDueAt, type OpsPrivacyRequestRecord } from './privacy-request.mapper';

type CreatePrivacyRequestInput = {
  subjectType: string;
  subjectEmail?: string;
  subjectName?: string;
  eventId?: string;
  requestType: string;
  requestNotes?: string;
};

type ReviewPrivacyRequestInput = {
  status: string;
  reviewReason?: string;
};

type ExecutePrivacyRequestInput = {
  executionNotes?: string;
  // Correction patch; the service re-validates it with privacyCorrectionPatchSchema before any write.
  correction?: unknown;
};

type PrivacyInventoryInput = {
  eventId?: string;
};

type OpsPrivacyLegalHoldRecord = {
  id: string;
  subjectType: string;
  subjectEmail: string;
  subjectName: string;
  eventId: string | null;
  reason: string;
  placedById: string;
  placedByName: string;
  placedAt: Date;
  releaseReason: string | null;
  releasedById: string | null;
  releasedByName: string | null;
  releasedAt: Date | null;
  createdAt: Date;
};

type PrivacyOwnerReceipt = {
  owner: 'event-lifecycle' | 'commercial' | 'operations' | 'identity-access';
  outcome: 'completed' | 'no_matches';
  surfaces: string[];
  touchedRecords: number;
};

function timestamp(value?: Date | null) {
  return value ? value.toISOString() : null;
}

@Injectable()
export class PrivacyOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Optional() @Inject(PLATFORM_REFERENCE_READ_MODEL)
    private readonly platformReferences: PlatformReferenceReadModel | undefined,
    @Inject(LIFECYCLE_PRIVACY_REDACTOR)
    private readonly lifecyclePrivacy: LifecyclePrivacyRedactor,
    @Inject(COMMERCIAL_PRIVACY_REDACTOR)
    private readonly commercialPrivacy: CommercialPrivacyRedactor,
    @Inject(OPERATIONS_PRIVACY_REDACTOR)
    private readonly operationsPrivacy: OperationsPrivacyRedactor,
    @Inject(IDENTITY_PRIVACY_REDACTOR)
    private readonly identityPrivacy: IdentityPrivacyRedactor,
  ) {}

  async getInventory(input: PrivacyInventoryInput = {}) {
    const source = await this.requirePlatformReferences().findPrivacyInventory(input);
    const eventsInventory = source.events.map((event) => {
      const surfaces = [
        this.privacySurface('inquiry', event.inquiry ? 1 : 0, ['client_contact', 'event_details', 'consent'], [
          event.inquiry,
        ]),
        this.privacySurface('guest_check_in', event.guestCheckIns.length, ['guest_name', 'attendance', 'consent'], event.guestCheckIns),
        this.privacySurface('guest_roster_entry', event.guestRosterEntryCount, ['guest_name', 'email', 'phone'], []),
        this.privacySurface('guest_feedback', event.guestFeedback.length, ['guest_name', 'rating', 'comment', 'media_metadata', 'consent'], event.guestFeedback),
        this.privacySurface('guest_feedback_media_metadata', event.guestFeedbackMedia.length, ['file_name_metadata', 'consent'], event.guestFeedbackMedia),
      ];
      return {
        eventId: event.id,
        eventName: event.eventName,
        clientName: event.clientName,
        dataCategories: Array.from(new Set(surfaces.flatMap((surface) => surface.dataCategories))),
        recordCount: surfaces.reduce((total, surface) => total + surface.recordCount, 0),
        surfaces,
        retentionNotes: 'Event personal-data records stay with the event until PMCM defines the final archive retention policy.',
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      events: eventsInventory,
      globalSurfaces: [
        this.privacySurface('account_approval_request', source.approvalRequests.length, ['email', 'role', 'organization', 'consent'], source.approvalRequests),
      ],
      retentionNotes: [
        'Personal-data records remain with the event until the archive retention policy is finalized.',
        'Guest feedback remains moderated and is never published automatically.',
        'AI use remains blocked unless ZDR, sanitizer, audit, and human approval records are present.',
      ],
    };
  }

  async listLegalHolds(input: ListPrivacyLegalHoldsQuery = {}) {
    const holds = await this.prisma.opsPrivacyLegalHold.findMany({
      where: {
        releasedAt: null,
        ...(input.eventId ? { OR: [{ eventId: null }, { eventId: input.eventId }] } : {}),
      },
      orderBy: { placedAt: 'desc' },
    });
    return holds.map((hold) => this.mapLegalHold(hold));
  }

  async createLegalHold(input: CreatePrivacyLegalHoldInput, actor: ResolvedEventOpsActor) {
    const verifiedActor = this.requireLegalHoldAdmin(actor, 'placing a legal hold');
    const scope = normalizePrivacyLegalHoldScope(input);
    if (!['client', 'supplier', 'guest'].includes(scope.subjectType) ||
      (scope.subjectType === 'guest' ? !scope.subjectName : !scope.subjectEmail)) {
      throw new BadRequestException('A legal hold requires a supported subject identity');
    }
    if (scope.eventId && !(await this.requirePlatformReferences().findEventReference(scope.eventId))) {
      throw new NotFoundException('Event not found');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.lockPrivacySubject(tx, scope);
      const active = await tx.opsPrivacyLegalHold.findFirst({ where: exactActiveLegalHoldWhere(scope) });
      if (active) return this.mapLegalHold(active);

      const hold = await tx.opsPrivacyLegalHold.create({
        data: {
          id: `hold_${randomUUID()}`,
          ...scope,
          reason: input.reason.trim(),
          placedById: verifiedActor.id,
          placedByName: verifiedActor.name,
          placedAt: new Date(),
        },
      });
      await this.auditService.audit(scope.eventId ?? undefined, verifiedActor.name, 'Placed privacy legal hold', {
        actorRole: verifiedActor.role,
        actorEmail: verifiedActor.email,
        actionType: AuditActionType.Create,
        category: AuditCategory.Access,
        affectedType: 'privacy_legal_hold',
        affectedId: hold.id,
        affectedLabel: 'Privacy legal hold',
        metadata: {
          actorId: verifiedActor.id,
          holdId: hold.id,
          subjectType: scope.subjectType,
          eventId: scope.eventId,
          reason: input.reason.trim(),
        },
      }, { prisma: tx, correlationId: `privacy-legal-hold:${hold.id}:place`, actorId: verifiedActor.id });
      return this.mapLegalHold(hold);
    });
  }

  async releaseLegalHold(holdId: string, input: ReleasePrivacyLegalHoldInput, actor: ResolvedEventOpsActor) {
    const verifiedActor = this.requireLegalHoldAdmin(actor, 'releasing a legal hold');
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.opsPrivacyLegalHold.findUnique({ where: { id: holdId } });
      if (!existing) throw new NotFoundException('Privacy legal hold not found');
      const hold = existing as OpsPrivacyLegalHoldRecord;
      await this.lockPrivacySubject(tx, hold);
      const releasedAt = new Date();
      const updated = await tx.opsPrivacyLegalHold.updateMany({
        where: { id: holdId, releasedAt: null },
        data: {
          releaseReason: input.reason.trim(),
          releasedById: verifiedActor.id,
          releasedByName: verifiedActor.name,
          releasedAt,
        },
      });
      if (updated.count !== 1) throw new ConflictException('Privacy legal hold was already released');

      const saved = await tx.opsPrivacyLegalHold.findUniqueOrThrow({ where: { id: holdId } });
      await this.auditService.audit(hold.eventId ?? undefined, verifiedActor.name, 'Released privacy legal hold', {
        actorRole: verifiedActor.role,
        actorEmail: verifiedActor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Access,
        affectedType: 'privacy_legal_hold',
        affectedId: hold.id,
        affectedLabel: 'Privacy legal hold',
        metadata: {
          actorId: verifiedActor.id,
          holdId: hold.id,
          subjectType: hold.subjectType,
          eventId: hold.eventId,
          reason: input.reason.trim(),
        },
      }, { prisma: tx, correlationId: `privacy-legal-hold:${hold.id}:release`, actorId: verifiedActor.id });
      return this.mapLegalHold(saved);
    });
  }

  async createRequest(input: CreatePrivacyRequestInput, actor: ResolvedEventOpsActor) {
    const verifiedActor = requireVerifiedTrustActor(actor, 'this privacy action');
    this.assertRequestType(input.requestType);
    const subjectType = input.subjectType.trim().toLowerCase();
    if (!['client', 'guest', 'supplier', 'account'].includes(subjectType)) {
      throw new BadRequestException('Unsupported privacy subject type');
    }
    if (subjectType === 'guest' && !input.eventId) {
      throw new BadRequestException('Guest privacy requests require an event scope');
    }
    if (!input.subjectEmail && !input.subjectName) {
      throw new BadRequestException('Privacy request requires a subject email or subject name');
    }
    if (input.eventId && !(await this.requirePlatformReferences().findEventReference(input.eventId))) {
      throw new NotFoundException('Event not found');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const submittedAt = new Date();
      const request = await tx.opsPrivacyRequest.create({
        data: {
          id: `priv_${randomUUID()}`,
          createdAt: submittedAt,
          dueAt: privacyRequestDueAt(submittedAt),
          eventId: input.eventId ?? null,
          subjectType,
          subjectEmail: input.subjectEmail?.trim().toLowerCase() ?? '',
          subjectName: input.subjectName?.trim() ?? '',
          requestType: input.requestType,
          status: PrivacyRequestStatus.Submitted,
          requestNotes: input.requestNotes ?? '',
          createdBy: verifiedActor.name,
        },
      });

      await this.auditService.audit(input.eventId, verifiedActor.name, `Logged privacy request: ${input.requestType}`, {
        actorRole: verifiedActor.role,
        actorEmail: verifiedActor.email,
        actionType: AuditActionType.Create,
        category: AuditCategory.Access,
        affectedType: 'privacy_request',
        affectedId: request.id,
        affectedLabel: input.subjectEmail ?? input.subjectName,
        metadata: { actorId: verifiedActor.id, requestType: input.requestType, subjectType: input.subjectType },
      }, { prisma: tx, correlationId: `privacy:${request.id}`, actorId: verifiedActor.id });

      return this.mapRequest(request);
    });
  }

  async reviewRequest(requestId: string, input: ReviewPrivacyRequestInput, actor: ResolvedEventOpsActor) {
    if (
      !isOpsConstantValue(PrivacyRequestStatus, input.status) ||
      (input.status !== PrivacyRequestStatus.Approved && input.status !== PrivacyRequestStatus.Rejected)
    ) {
      throw new BadRequestException('Privacy request review must approve or reject');
    }
    const verifiedActor = requireVerifiedTrustActor(actor, 'this privacy action');
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const request = await tx.opsPrivacyRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new NotFoundException('Privacy request not found');
      if (request.status !== PrivacyRequestStatus.Submitted) {
        throw new BadRequestException('Only submitted privacy requests can be reviewed');
      }

      const changed = await tx.opsPrivacyRequest.updateMany({
        where: { id: requestId, status: PrivacyRequestStatus.Submitted },
        data: {
          status: input.status,
          reviewReason: input.reviewReason ?? '',
          reviewedBy: verifiedActor.name,
          reviewedAt: new Date(),
        },
      });
      if (changed.count !== 1) throw new BadRequestException('Privacy request was already reviewed');
      const saved = await tx.opsPrivacyRequest.findUniqueOrThrow({ where: { id: requestId } });

      await this.auditService.audit(request.eventId ?? undefined, verifiedActor.name, `${input.status === PrivacyRequestStatus.Approved ? 'Approved' : 'Rejected'} privacy request`, {
        actorRole: verifiedActor.role,
        actorEmail: verifiedActor.email,
        actionType: input.status === PrivacyRequestStatus.Approved ? AuditActionType.Approve : AuditActionType.Decline,
        category: AuditCategory.Access,
        affectedType: 'privacy_request',
        affectedId: request.id,
        affectedLabel: request.subjectEmail || request.subjectName,
        metadata: { actorId: verifiedActor.id, reviewReason: input.reviewReason ?? '' },
      }, { prisma: tx, correlationId: `privacy:${request.id}`, actorId: verifiedActor.id });

      return this.mapRequest(saved);
    });
  }

  async executeRequest(requestId: string, input: ExecutePrivacyRequestInput, actor: ResolvedEventOpsActor): Promise<PrismPrivacyExecutionResult> {
    const verifiedActor = requireVerifiedTrustActor(actor, 'this privacy action');
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`privacy-request:${requestId}`}, 0))`; // QUERY_AUDIT_RAW_SQL: parameterized request advisory lock prevents duplicate privacy execution.
      const request = await tx.opsPrivacyRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new NotFoundException('Privacy request not found');
      if (request.status !== PrivacyRequestStatus.Approved) {
        throw new BadRequestException('Privacy request must be approved before execution');
      }
      return this.executeApprovedRequest(request, input, verifiedActor, tx);
    });
  }

  private async executeApprovedRequest(
    request: OpsPrivacyRequestRecord,
    input: ExecutePrivacyRequestInput,
    verifiedActor: ReturnType<typeof requireVerifiedTrustActor>,
    prisma: Prisma.TransactionClient,
  ): Promise<PrismPrivacyExecutionResult> {
    if (request.requestType === PrivacyRequestType.Access || request.requestType === PrivacyRequestType.Export) {
      return this.executeExport(request, input, verifiedActor, prisma);
    }
    if (input.correction !== undefined && request.requestType !== PrivacyRequestType.Correction) {
      throw new BadRequestException('A correction patch is only accepted for correction requests');
    }
    if (request.requestType === PrivacyRequestType.Correction) {
      return this.executeCorrection(request, input, verifiedActor, prisma);
    }
    if (request.requestType !== PrivacyRequestType.Deletion) {
      throw new BadRequestException('Unsupported privacy request type for execution');
    }
    return this.executeDeletion(request, input, verifiedActor, prisma);
  }

  private async executeDeletion(
    request: OpsPrivacyRequestRecord,
    input: ExecutePrivacyRequestInput,
    verifiedActor: ReturnType<typeof requireVerifiedTrustActor>,
    prisma: Prisma.TransactionClient,
  ): Promise<PrismPrivacyExecutionResult> {
    this.assertDeletionIdentity(request);
    const account = await this.subjectAccountFor(request, prisma);
    await this.lockAndAssertNoLegalHold(request, account, prisma);

    const redaction = await this.softRedactSubject(request, account, prisma);
    if (!redaction.touchedRecords) {
      throw new BadRequestException('No supported records matched this privacy request; execution remains pending');
    }
    for (const receipt of redaction.ownerReceipts) {
      await this.auditService.audit(
        request.eventId ?? undefined,
        verifiedActor.name,
        `Privacy redaction receipt: ${receipt.owner}`,
        {
          actorRole: verifiedActor.role,
          actorEmail: verifiedActor.email,
          actionType: AuditActionType.Update,
          category: AuditCategory.Access,
          affectedType: 'privacy_owner_redaction_receipt',
          affectedId: `${request.id}:${receipt.owner}`,
          affectedLabel: receipt.owner,
          metadata: { actorId: verifiedActor.id, requestId: request.id, ...receipt },
        },
        {
          prisma,
          correlationId: `privacy:${request.id}:owner:${receipt.owner}`,
          actorId: verifiedActor.id,
        },
      );
    }
    await this.auditService.audit(request.eventId ?? undefined, verifiedActor.name, 'Soft redaction summary for privacy request', {
      actorRole: verifiedActor.role,
      actorEmail: verifiedActor.email,
      actionType: AuditActionType.Update,
      category: AuditCategory.Access,
      affectedType: 'privacy_request',
      affectedId: request.id,
      affectedLabel: request.subjectEmail || request.subjectName,
      metadata: { actorId: verifiedActor.id, ...redaction },
    }, { prisma, correlationId: `privacy:${request.id}`, actorId: verifiedActor.id });
    const saved = await prisma.opsPrivacyRequest.update({
      where: { id: request.id },
      data: { status: PrivacyRequestStatus.Executed, executionNotes: input.executionNotes ?? '', executedBy: verifiedActor.name, executedAt: new Date() },
    });
    return { ...this.mapRequest(saved), export: null };
  }

  /**
   * Builds the subject's export inside the execution transaction, audits per-owner counts (never record contents),
   * and marks the request executed. The bundle is returned once to the PMCM operator who executed the request.
   */
  private async executeExport(
    request: OpsPrivacyRequestRecord,
    input: ExecutePrivacyRequestInput,
    verifiedActor: ReturnType<typeof requireVerifiedTrustActor>,
    prisma: Prisma.TransactionClient,
  ): Promise<PrismPrivacyExecutionResult> {
    const { bundle, receipts } = await this.buildExport(request, prisma);
    for (const receipt of receipts) {
      await this.auditService.audit(
        request.eventId ?? undefined,
        verifiedActor.name,
        `Privacy export receipt: ${receipt.owner}`,
        {
          actorRole: verifiedActor.role,
          actorEmail: verifiedActor.email,
          actionType: AuditActionType.Export,
          category: AuditCategory.Access,
          affectedType: 'privacy_owner_export_receipt',
          affectedId: `${request.id}:${receipt.owner}`,
          affectedLabel: receipt.owner,
          metadata: { actorId: verifiedActor.id, requestId: request.id, ...receipt },
        },
        { prisma, correlationId: `privacy:${request.id}:export:${receipt.owner}`, actorId: verifiedActor.id },
      );
    }
    const touchedRecords = bundle.sections.reduce((total, section) => total + section.records.length, 0);
    await this.auditService.audit(request.eventId ?? undefined, verifiedActor.name, 'Privacy export summary for privacy request', {
      actorRole: verifiedActor.role,
      actorEmail: verifiedActor.email,
      actionType: AuditActionType.Export,
      category: AuditCategory.Access,
      affectedType: 'privacy_request',
      affectedId: request.id,
      affectedLabel: request.subjectEmail || request.subjectName,
      metadata: { actorId: verifiedActor.id, requestId: request.id, surfaces: bundle.sections.map((section) => section.surface), touchedRecords },
    }, { prisma, correlationId: `privacy:${request.id}`, actorId: verifiedActor.id });
    const saved = await prisma.opsPrivacyRequest.update({
      where: { id: request.id },
      data: { status: PrivacyRequestStatus.Executed, executionNotes: input.executionNotes ?? '', executedBy: verifiedActor.name, executedAt: new Date() },
    });
    return { ...this.mapRequest(saved), export: bundle };
  }

  private async buildExport(
    request: OpsPrivacyRequestRecord,
    prisma: Prisma.TransactionClient,
  ): Promise<{ bundle: PrismPrivacyExportBundle; receipts: PrivacyOwnerReceipt[] }> {
    const sections: PrismPrivacyExportSection[] = [];
    const receipts: PrivacyOwnerReceipt[] = [];
    const collect = (owner: PrivacyOwnerReceipt['owner'], ownerSections: PrismPrivacyExportSection[]) => {
      sections.push(...ownerSections);
      receipts.push(this.ownerReceipt(owner, {
        surfaces: ownerSections.map((section) => section.surface),
        touchedRecords: ownerSections.reduce((total, section) => total + section.records.length, 0),
      }));
    };

    if (request.subjectType === 'guest') {
      if (!request.eventId || !request.subjectName.trim()) {
        throw new BadRequestException('Guest export requires a name and event scope');
      }
      collect('operations', await this.operationsPrivacy.exportGuest({ eventId: request.eventId, name: request.subjectName }, prisma));
    } else {
      const account = await this.subjectAccountFor(request, prisma);
      if (request.subjectType === 'account' && !account) {
        throw new BadRequestException('No native account matches this privacy request; execution remains pending');
      }
      const email = request.subjectEmail.trim().toLowerCase();
      if (!email) throw new BadRequestException('Client, supplier, and account export require an email identity');
      const role = request.subjectType === 'account' ? account?.role : request.subjectType;
      if (role === OpsUserRole.Client) {
        const lifecycle = await this.lifecyclePrivacy.exportClient({ email, eventId: request.eventId }, prisma);
        collect('event-lifecycle', lifecycle.sections);
        collect('commercial', await this.commercialPrivacy.exportClientBilling({ eventIds: lifecycle.eventIds }, prisma));
      } else if (role === OpsUserRole.Supplier) {
        collect('commercial', await this.commercialPrivacy.exportSupplier({ email }, prisma));
      }
      collect('identity-access', await this.identityPrivacy.exportAccount(email, prisma));
    }

    return {
      bundle: { requestId: request.id, subjectType: request.subjectType, generatedAt: new Date().toISOString(), sections },
      receipts,
    };
  }

  /**
   * Applies an explicit, validated name/email patch to the subject's own identity and contact records in one
   * transaction. Only client, supplier, non-staff account, and event-scoped guest subjects are corrected; the audit records changed
   * field names and per-owner counts, never the values.
   */
  private async executeCorrection(
    request: OpsPrivacyRequestRecord,
    input: ExecutePrivacyRequestInput,
    verifiedActor: ReturnType<typeof requireVerifiedTrustActor>,
    prisma: Prisma.TransactionClient,
  ): Promise<PrismPrivacyExecutionResult> {
    const patch = this.requireCorrectionPatch(input.correction);
    const owners = request.subjectType === 'guest'
      ? await this.applyGuestCorrection(request, patch, prisma)
      : await this.applySubjectCorrection(request, patch, prisma);
    const changedFields = (['name', 'email'] as const).filter((field) => patch[field] !== undefined);
    const touchedRecords = owners.reduce((total, { result }) => total + result.touchedRecords, 0);
    if (!touchedRecords) {
      throw new BadRequestException('No supported records matched this privacy request; execution remains pending');
    }
    for (const { owner, result } of owners) {
      await this.auditService.audit(request.eventId ?? undefined, verifiedActor.name, `Privacy correction receipt: ${owner}`, {
        actorRole: verifiedActor.role,
        actorEmail: verifiedActor.email,
        actionType: AuditActionType.Update,
        category: AuditCategory.Access,
        affectedType: 'privacy_owner_correction_receipt',
        affectedId: `${request.id}:${owner}`,
        affectedLabel: owner,
        metadata: { actorId: verifiedActor.id, requestId: request.id, ...this.ownerReceipt(owner, result), changedFields },
      }, { prisma, correlationId: `privacy:${request.id}:correction:${owner}`, actorId: verifiedActor.id });
    }
    await this.auditService.audit(request.eventId ?? undefined, verifiedActor.name, 'Privacy correction summary for privacy request', {
      actorRole: verifiedActor.role,
      actorEmail: verifiedActor.email,
      actionType: AuditActionType.Update,
      category: AuditCategory.Access,
      affectedType: 'privacy_request',
      affectedId: request.id,
      affectedLabel: request.subjectEmail || request.subjectName,
      metadata: { actorId: verifiedActor.id, requestId: request.id, changedFields, touchedRecords },
    }, { prisma, correlationId: `privacy:${request.id}`, actorId: verifiedActor.id });
    const saved = await prisma.opsPrivacyRequest.update({
      where: { id: request.id },
      data: { status: PrivacyRequestStatus.Executed, executionNotes: input.executionNotes ?? '', executedBy: verifiedActor.name, executedAt: new Date() },
    });
    return { ...this.mapRequest(saved), export: null };
  }

  private async applySubjectCorrection(request: OpsPrivacyRequestRecord, patch: PrivacyCorrectionPatch, prisma: Prisma.TransactionClient) {
    const { account, role } = await this.resolveCorrectionSubject(request, prisma);
    await this.lockAndAssertNoLegalHold(request, account, prisma);
    await this.assertCorrectedEmailAvailable(patch, account, prisma);
    const email = request.subjectEmail.trim().toLowerCase();
    return this.applyCorrection({ email, eventId: request.eventId, patch, role, account }, prisma);
  }

  /**
   * A guest is identified by name inside one event, so the correction only touches that event's roster, check-in,
   * and feedback rows for the subject name. Email exists only on roster rows. Matching legal holds block the write.
   */
  private async applyGuestCorrection(request: OpsPrivacyRequestRecord, patch: PrivacyCorrectionPatch, prisma: Prisma.TransactionClient) {
    if (!request.eventId || !request.subjectName.trim()) {
      throw new BadRequestException('Guest correction requires a name and event scope');
    }
    await this.lockAndAssertNoLegalHold(request, null, prisma);
    const result = await this.operationsPrivacy.correctGuest({ eventId: request.eventId, name: request.subjectName, patch }, prisma);
    return [{ owner: 'operations' as const, result }];
  }

  /** Resolves who is being corrected and refuses subject types, identities, or roles a correction may not touch. */
  private async resolveCorrectionSubject(request: OpsPrivacyRequestRecord, prisma: Prisma.TransactionClient) {
    if (!['client', 'supplier', 'account'].includes(request.subjectType)) {
      throw new BadRequestException('Correction for this subject type is not supported');
    }
    if (!request.subjectEmail.trim()) {
      throw new BadRequestException('Client, supplier, and account correction require an email identity');
    }
    const account = await this.subjectAccountFor(request, prisma);
    if (request.subjectType === 'account' && !account) {
      throw new BadRequestException('No native account matches this privacy request; execution remains pending');
    }
    if (request.subjectType !== 'account' && account) {
      throw new BadRequestException('This identity has a native account; submit the correction against the account subject');
    }
    const role = request.subjectType === 'account' ? account?.role : request.subjectType;
    if (role !== OpsUserRole.Client && role !== OpsUserRole.Supplier) {
      throw new ForbiddenException('Staff and non-subject accounts cannot be corrected through a privacy request');
    }
    return { account, role };
  }

  private async assertCorrectedEmailAvailable(
    patch: PrivacyCorrectionPatch,
    account: { id: string } | null,
    prisma: Prisma.TransactionClient,
  ) {
    if (patch.email === undefined) return;
    const holder = await this.identityPrivacy.findNativeAccount(patch.email, prisma);
    if (holder && holder.id !== account?.id) {
      throw new ConflictException('A native account already uses the corrected email');
    }
  }

  private async applyCorrection(
    subject: {
      email: string;
      eventId?: string | null;
      patch: PrivacyCorrectionPatch;
      role: string;
      account: { id: string } | null;
    },
    prisma: Prisma.TransactionClient,
  ) {
    const { email, eventId, patch, role, account } = subject;
    const owners: Array<{ owner: PrivacyOwnerReceipt['owner']; result: { surfaces: string[]; touchedRecords: number } }> = [];
    if (role === OpsUserRole.Client) {
      const lifecycle = await this.lifecyclePrivacy.correctClient({ email, eventId, patch }, prisma);
      const billing = await this.commercialPrivacy.correctClientBilling({ eventIds: lifecycle.eventIds, patch }, prisma);
      owners.push({ owner: 'event-lifecycle', result: lifecycle }, { owner: 'commercial', result: billing });
    } else {
      owners.push({ owner: 'commercial', result: await this.commercialPrivacy.correctSupplier({ email, patch }, prisma) });
    }
    const approvals = await this.identityPrivacy.correctApprovalIdentity({ email, role, patch }, prisma);
    const accountChange = account
      ? await this.identityPrivacy.correctAccount({ accountId: account.id, email, patch }, prisma)
      : { count: 0 };
    owners.push({
      owner: 'identity-access',
      result: {
        surfaces: [
          ...(approvals.count ? ['approval_request'] : []),
          ...(accountChange.count ? ['account'] : []),
        ],
        touchedRecords: approvals.count + accountChange.count,
      },
    });
    return owners;
  }

  private requireCorrectionPatch(candidate: unknown): PrivacyCorrectionPatch {
    if (candidate === undefined) {
      throw new BadRequestException('Correction execution requires an explicit name or email patch');
    }
    const parsed = privacyCorrectionPatchSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new BadRequestException('Correction patch must contain only a valid name or email');
    }
    const { name, email } = parsed.data;
    return {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email: email.toLowerCase() } : {}),
    };
  }

  /** Serializes the subject's record writes behind the subject lock and refuses while a matching legal hold is active. */
  private async lockAndAssertNoLegalHold(
    request: OpsPrivacyRequestRecord,
    account: { id: string; role: string } | null,
    prisma: Prisma.TransactionClient,
  ) {
    // A native account's legal holds are recorded against its role (client/supplier), so resolve that scope first.
    const subjectScope = privacyRequestLegalHoldScope(
      request.subjectType === 'account' && account ? { ...request, subjectType: account.role } : request,
    );
    await this.lockPrivacySubject(prisma, subjectScope);
    const activeHold = await prisma.opsPrivacyLegalHold.findFirst({
      where: activeLegalHoldWhere(subjectScope),
      select: { id: true },
    });
    if (activeHold) {
      throw new BadRequestException('An active legal hold prevents this privacy execution; contact a PMCM administrator');
    }
  }

  private async subjectAccountFor(request: OpsPrivacyRequestRecord, prisma: Prisma.TransactionClient) {
    if (request.subjectType === 'guest') return null;
    const email = request.subjectEmail.trim().toLowerCase();
    return email ? this.identityPrivacy.findNativeAccount(email, prisma) : null;
  }

  private privacySurface(
    surface: string,
    recordCount: number,
    dataCategories: string[],
    records: Array<{ privacyConsentAccepted?: boolean; privacyNoticeVersion?: string; marketingConsentAccepted?: boolean } | null | undefined>,
  ) {
    const presentRecords = records.filter(Boolean) as Array<{
      privacyConsentAccepted?: boolean;
      privacyNoticeVersion?: string;
      marketingConsentAccepted?: boolean;
    }>;
    return {
      surface,
      recordCount,
      dataCategories,
      consentAcceptedCount: presentRecords.filter((record) => Boolean(record.privacyConsentAccepted)).length,
      missingConsentCount: Math.max(0, recordCount - presentRecords.filter((record) => Boolean(record.privacyConsentAccepted)).length),
      privacyNoticeVersions: Array.from(
        new Set(presentRecords.map((record) => record.privacyNoticeVersion).filter(Boolean)),
      ),
      marketingConsentAcceptedCount: presentRecords.filter((record) => Boolean(record.marketingConsentAccepted)).length,
    };
  }

  private requirePlatformReferences() {
    if (!this.platformReferences) throw new ServiceUnavailableException('Platform reference read model is unavailable');
    return this.platformReferences;
  }

  private assertRequestType(requestType: string) {
    if (!isOpsConstantValue(PrivacyRequestType, requestType)) {
      throw new BadRequestException('Unsupported privacy request type');
    }
  }

  private async softRedactSubject(
    request: OpsPrivacyRequestRecord,
    account: { id: string; role: string } | null,
    prisma: Prisma.TransactionClient,
  ) {
    const redactedEmail = `redacted+privacy_${request.id}@privacy.local`;
    if (request.subjectType === 'guest') {
      return { ...await this.redactNameSurfaces(request, request.subjectName, prisma), redactedEmail: null };
    }
    const byEmail = request.subjectEmail.trim().toLowerCase();
    if (request.subjectType === 'account') {
      // Native-account erasure redacts the role's owner surfaces and then the account row itself, in one transaction.
      if (!account) throw new BadRequestException('No native account matches this privacy request; execution remains pending');
      if (account.role !== OpsUserRole.Client && account.role !== OpsUserRole.Supplier) {
        throw new ForbiddenException('Staff and non-subject accounts cannot be erased through a privacy request');
      }
      const result = account.role === OpsUserRole.Client
        ? await this.redactClientSurfaces(request, byEmail, redactedEmail, prisma, account.id)
        : await this.redactSupplierSurfaces(byEmail, redactedEmail, prisma, account.id);
      return { ...result, redactedEmail };
    }
    if (account) {
      throw new BadRequestException('This identity has a native account; submit an account erasure request instead');
    }
    const result = request.subjectType === 'client'
      ? await this.redactClientSurfaces(request, byEmail, redactedEmail, prisma)
      : await this.redactSupplierSurfaces(byEmail, redactedEmail, prisma);
    return {
      ...result,
      redactedEmail,
    };
  }

  private assertDeletionIdentity(request: OpsPrivacyRequestRecord) {
    if (!['client', 'supplier', 'guest', 'account'].includes(request.subjectType)) {
      throw new BadRequestException('Deletion for this subject type is not supported yet');
    }
    if (request.subjectType !== 'guest' && !request.subjectEmail.trim()) {
      throw new BadRequestException('Client, supplier, and account deletion require an email identity');
    }
    if (request.subjectType === 'guest' && (!request.subjectName || !request.eventId)) {
      throw new BadRequestException('Guest deletion requires a name and event scope');
    }
  }

  private requireLegalHoldAdmin(actor: ResolvedEventOpsActor, action: string) {
    const verifiedActor = requireVerifiedTrustActor(actor, action);
    if (verifiedActor.role !== OpsUserRole.PmcmAdmin) {
      throw new ForbiddenException('Only a verified PMCM administrator may manage legal holds');
    }
    return verifiedActor;
  }

  private async lockPrivacySubject(prisma: Prisma.TransactionClient, scope: PrivacyLegalHoldScope) {
    for (const lockKey of privacyLegalHoldLockKeys(scope)) {
      await prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`; // QUERY_AUDIT_RAW_SQL: acquire normalized subject then optional event locks in the same order for every hold operation.
    }
  }

  private async redactClientSurfaces(
    request: OpsPrivacyRequestRecord,
    byEmail: string,
    redactedEmail: string,
    prisma: Prisma.TransactionClient,
    accountId?: string,
  ) {
    // The inquiry owner captures matching IDs before replacing either email column.
    const lifecycle = await this.lifecyclePrivacy.redactClient(
      { email: byEmail, redactedEmail, eventId: request.eventId },
      prisma,
    );
    const commercial = await this.commercialPrivacy.redactClientBilling(
      { eventIds: lifecycle.eventIds, redactedEmail },
      prisma,
    );
    const identity = await this.redactIdentitySurfaces(byEmail, redactedEmail, OpsUserRole.Client, prisma, accountId);
    return {
      surfaces: [...lifecycle.surfaces, ...commercial.surfaces, ...identity.surfaces],
      touchedRecords: lifecycle.touchedRecords + commercial.touchedRecords + identity.touchedRecords,
      ownerReceipts: [
        this.ownerReceipt('event-lifecycle', lifecycle),
        this.ownerReceipt('commercial', commercial),
        identity.receipt,
      ],
    };
  }

  private async redactSupplierSurfaces(
    byEmail: string,
    redactedEmail: string,
    prisma: Prisma.TransactionClient,
    accountId?: string,
  ) {
    const commercial = await this.commercialPrivacy.redactSupplier({ email: byEmail, redactedEmail }, prisma);
    const identity = await this.redactIdentitySurfaces(byEmail, redactedEmail, OpsUserRole.Supplier, prisma, accountId);
    return {
      surfaces: [...commercial.surfaces, ...identity.surfaces],
      touchedRecords: commercial.touchedRecords + identity.touchedRecords,
      ownerReceipts: [
        this.ownerReceipt('commercial', commercial),
        identity.receipt,
      ],
    };
  }

  /** Approval identity first (matched by the original email), then the native account row when erasing it. */
  private async redactIdentitySurfaces(
    byEmail: string,
    redactedEmail: string,
    role: string,
    prisma: Prisma.TransactionClient,
    accountId?: string,
  ) {
    const approvals = await this.identityPrivacy.redactApprovalIdentity({ email: byEmail, redactedEmail, role }, prisma);
    const erased = accountId
      ? await this.identityPrivacy.eraseAccount({ accountId, email: byEmail, redactedEmail }, prisma)
      : { count: 0 };
    const surfaces = [
      ...(approvals.count ? ['approval_request'] : []),
      ...(erased.count ? ['account'] : []),
    ];
    const touchedRecords = approvals.count + erased.count;
    return {
      surfaces,
      touchedRecords,
      receipt: this.ownerReceipt('identity-access', { surfaces, touchedRecords }),
    };
  }

  private async redactNameSurfaces(request: OpsPrivacyRequestRecord, byName: string, prisma: Prisma.TransactionClient) {
    if (!request.eventId) throw new BadRequestException('Guest deletion requires an event scope');
    const result = await this.operationsPrivacy.redactGuest({ eventId: request.eventId, name: byName }, prisma);
    return { ...result, ownerReceipts: [this.ownerReceipt('operations', result)] };
  }

  private ownerReceipt(
    owner: PrivacyOwnerReceipt['owner'],
    result: { surfaces: string[]; touchedRecords: number },
  ): PrivacyOwnerReceipt {
    return {
      owner,
      outcome: result.touchedRecords ? 'completed' : 'no_matches',
      surfaces: result.surfaces,
      touchedRecords: result.touchedRecords,
    };
  }

  private mapRequest(request: OpsPrivacyRequestRecord) {
    return mapPrivacyRequest(request);
  }

  private mapLegalHold(hold: OpsPrivacyLegalHoldRecord): PrismPrivacyLegalHold {
    return {
      id: hold.id,
      subjectType: hold.subjectType as PrismPrivacyLegalHold['subjectType'],
      subjectEmail: hold.subjectEmail,
      subjectName: hold.subjectName,
      eventId: hold.eventId,
      reason: hold.reason,
      placedById: hold.placedById,
      placedByName: hold.placedByName,
      placedAt: timestamp(hold.placedAt) ?? '',
      releaseReason: hold.releaseReason,
      releasedById: hold.releasedById,
      releasedByName: hold.releasedByName,
      releasedAt: timestamp(hold.releasedAt),
      createdAt: timestamp(hold.createdAt) ?? '',
    };
  }
}
