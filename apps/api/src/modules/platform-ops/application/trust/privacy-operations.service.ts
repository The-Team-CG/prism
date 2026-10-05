import { Inject, Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { COMMERCIAL_PRIVACY_REDACTOR, type CommercialPrivacyRedactor } from '@prism/contexts/commercial';
import { LIFECYCLE_PRIVACY_REDACTOR, type LifecyclePrivacyRedactor } from '@prism/contexts/event-lifecycle';
import { IDENTITY_PRIVACY_REDACTOR, type IdentityPrivacyRedactor } from '@prism/contexts/identity-access';
import { OPERATIONS_PRIVACY_REDACTOR, type OperationsPrivacyRedactor } from '@prism/contexts/operations';
import { PLATFORM_REFERENCE_READ_MODEL, type PlatformReferenceReadModel } from '@prism/contexts/read-models';
import type { CreatePrivacyLegalHoldInput, ListPrivacyLegalHoldsQuery, PrismPrivacyLegalHold, ReleasePrivacyLegalHoldInput } from '@prism/types';
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
};

type ListPrivacyRequestsInput = {
  eventId?: string;
  status?: string;
};

type PrivacyInventoryInput = {
  eventId?: string;
};

type OpsPrivacyRequestRecord = {
  id: string;
  eventId?: string | null;
  subjectType: string;
  subjectEmail: string;
  subjectName: string;
  requestType: string;
  status: string;
  requestNotes: string;
  reviewReason: string;
  executionNotes?: string;
  createdBy: string;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  executedBy?: string | null;
  executedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
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

  listRetentionPolicies() {
    return [
      {
        surface: 'inquiry',
        dataCategories: ['client_contact', 'event_details', 'consent'],
        retentionPeriod: '3 years after event archive',
        deletionBehavior: 'Soft redact personal contact and free-text fields; keep event linkage.',
      },
      {
        surface: 'approval_request',
        dataCategories: ['email', 'role', 'organization', 'consent'],
        retentionPeriod: '1 year after approval decision',
        deletionBehavior: 'Soft redact requester identity; keep approval decision history.',
      },
      {
        surface: 'supplier',
        dataCategories: ['supplier_contact', 'certification_metadata', 'performance_notes'],
        retentionPeriod: 'Active supplier lifetime plus 5 years',
        deletionBehavior: 'Soft redact supplier contact details when legally required; keep operational history.',
      },
      {
        surface: 'guest_check_in',
        dataCategories: ['guest_name', 'attendance', 'consent'],
        retentionPeriod: '1 year after event archive',
        deletionBehavior: 'Soft redact guest name; keep attendance count and event-day aggregate.',
      },
      {
        surface: 'guest_feedback',
        dataCategories: ['guest_name', 'rating', 'comment', 'media_metadata', 'consent'],
        retentionPeriod: '1 year after moderation or event archive',
        deletionBehavior: 'Soft redact guest name, comments, and media metadata; keep moderation status.',
      },
      {
        surface: 'documents',
        dataCategories: ['file_metadata', 'uploader_role', 'validation_result'],
        retentionPeriod: 'Event archive lifetime until PMCM document retention is finalized',
        deletionBehavior: 'Keep metadata unless PMCM executes a document-specific redaction workflow.',
      },
      {
        surface: 'audit',
        dataCategories: ['actor', 'action', 'affected_record', 'hash_chain'],
        retentionPeriod: 'Pending PMCM policy decision',
        deletionBehavior: 'Never hard delete or mutate in normal workflows; append redaction events instead.',
      },
      {
        surface: 'legal_hold',
        dataCategories: ['subject_identity', 'hold_reason', 'placement_and_release_actor'],
        retentionPeriod: 'No automatic expiry; retain while active and until PMCM defines post-release retention.',
        deletionBehavior: 'Only a verified PMCM administrator can release a hold; active holds block matching deletion execution.',
      },
    ];
  }

  async listRequests(input: ListPrivacyRequestsInput = {}) {
    // QUERY_AUDIT_ALLOW_UNBOUNDED: PMCM currently needs the complete request queue; pagination requires an API and UI contract change.
    const requests = await this.prisma.opsPrivacyRequest.findMany({
      where: {
        ...(input.eventId ? { eventId: input.eventId } : {}),
        ...(input.status && input.status !== 'all' ? { status: input.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request: OpsPrivacyRequestRecord) => this.mapRequest(request));
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
      const request = await tx.opsPrivacyRequest.create({
        data: {
          id: `priv_${randomUUID()}`,
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

  async executeRequest(requestId: string, input: ExecutePrivacyRequestInput, actor: ResolvedEventOpsActor) {
    const verifiedActor = requireVerifiedTrustActor(actor, 'this privacy action');
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`privacy-request:${requestId}`}, 0))`; // QUERY_AUDIT_RAW_SQL: parameterized request advisory lock prevents duplicate privacy execution.
      const request = await tx.opsPrivacyRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new NotFoundException('Privacy request not found');
      if (request.status !== PrivacyRequestStatus.Approved) {
        throw new BadRequestException('Privacy request must be approved before execution');
      }
      if (request.requestType !== PrivacyRequestType.Deletion) {
        throw new BadRequestException('Access and correction execution is not supported yet');
      }
      this.assertDeletionIdentity(request);
      const subjectScope = privacyRequestLegalHoldScope(request);
      await this.lockPrivacySubject(tx, subjectScope);
      const activeHold = await tx.opsPrivacyLegalHold.findFirst({
        where: activeLegalHoldWhere(subjectScope),
        select: { id: true },
      });
      if (activeHold) {
        throw new BadRequestException('An active legal hold prevents this privacy execution; contact a PMCM administrator');
      }

      const redaction = await this.softRedactSubject(request, tx);
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
            prisma: tx,
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
      }, { prisma: tx, correlationId: `privacy:${request.id}`, actorId: verifiedActor.id });
      const saved = await tx.opsPrivacyRequest.update({
        where: { id: requestId },
        data: { status: PrivacyRequestStatus.Executed, executionNotes: input.executionNotes ?? '', executedBy: verifiedActor.name, executedAt: new Date() },
      });
      return this.mapRequest(saved);
    });
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

  private async softRedactSubject(request: OpsPrivacyRequestRecord, prisma: Prisma.TransactionClient) {
    const redactedEmail = `redacted+privacy_${request.id}@privacy.local`;
    if (request.subjectType === 'guest') {
      return { ...await this.redactNameSurfaces(request, request.subjectName, prisma), redactedEmail: null };
    }
    const byEmail = request.subjectEmail.trim().toLowerCase();
    if (await this.identityPrivacy.hasAccount(byEmail, prisma)) {
      throw new BadRequestException('This identity has an account; account deletion is not supported yet');
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
    if (!['client', 'supplier', 'guest'].includes(request.subjectType)) {
      throw new BadRequestException('Deletion for this subject type is not supported yet');
    }
    if (request.subjectType !== 'guest' && !request.subjectEmail.trim()) {
      throw new BadRequestException('Client and supplier deletion require an email identity');
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

  private recordRedaction(surfaces: string[], surface: string, count: number) {
    if (count) surfaces.push(surface);
    return count;
  }

  private async redactClientSurfaces(request: OpsPrivacyRequestRecord, byEmail: string, redactedEmail: string, prisma: Prisma.TransactionClient) {
    // The inquiry owner captures matching IDs before replacing either email column.
    const lifecycle = await this.lifecyclePrivacy.redactClient(
      { email: byEmail, redactedEmail, eventId: request.eventId },
      prisma,
    );
    const commercial = await this.commercialPrivacy.redactClientBilling(
      { eventIds: lifecycle.eventIds, redactedEmail },
      prisma,
    );
    const approvals = await this.identityPrivacy.redactApprovalIdentity(
      { email: byEmail, redactedEmail, role: OpsUserRole.Client },
      prisma,
    );
    const surfaces = [...lifecycle.surfaces, ...commercial.surfaces];
    this.recordRedaction(surfaces, 'approval_request', approvals.count);
    return {
      surfaces,
      touchedRecords: lifecycle.touchedRecords + commercial.touchedRecords + approvals.count,
      ownerReceipts: [
        this.ownerReceipt('event-lifecycle', lifecycle),
        this.ownerReceipt('commercial', commercial),
        this.ownerReceipt('identity-access', {
          surfaces: approvals.count ? ['approval_request'] : [],
          touchedRecords: approvals.count,
        }),
      ],
    };
  }

  private async redactSupplierSurfaces(byEmail: string, redactedEmail: string, prisma: Prisma.TransactionClient) {
    const commercial = await this.commercialPrivacy.redactSupplier({ email: byEmail, redactedEmail }, prisma);
    const approvals = await this.identityPrivacy.redactApprovalIdentity(
      { email: byEmail, redactedEmail, role: OpsUserRole.Supplier },
      prisma,
    );
    const surfaces = [...commercial.surfaces];
    this.recordRedaction(surfaces, 'approval_request', approvals.count);
    return {
      surfaces,
      touchedRecords: commercial.touchedRecords + approvals.count,
      ownerReceipts: [
        this.ownerReceipt('commercial', commercial),
        this.ownerReceipt('identity-access', {
          surfaces: approvals.count ? ['approval_request'] : [],
          touchedRecords: approvals.count,
        }),
      ],
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
    return {
      id: request.id,
      eventId: request.eventId ?? null,
      subjectType: request.subjectType,
      subjectEmail: request.subjectEmail,
      subjectName: request.subjectName,
      requestType: request.requestType,
      status: request.status,
      requestNotes: request.requestNotes,
      reviewReason: request.reviewReason,
      executionNotes: request.executionNotes ?? '',
      createdBy: request.createdBy,
      reviewedBy: request.reviewedBy ?? null,
      reviewedAt: timestamp(request.reviewedAt),
      executedBy: request.executedBy ?? null,
      executedAt: timestamp(request.executedAt),
      createdAt: timestamp(request.createdAt),
      updatedAt: timestamp(request.updatedAt),
    };
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
