import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { OpsEvent, OpsGuestCheckIn, OpsGuestFeedback, OpsInquiry, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
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

type PrivacyActor = {
  name: string;
  role: string;
};

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

function timestamp(value?: Date | null) {
  return value ? value.toISOString() : null;
}

@Injectable()
export class PrivacyOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getInventory(input: PrivacyInventoryInput = {}) {
    const [events, inquiries, approvalRequests] = await Promise.all([
      this.prisma.opsEvent.findMany({
        where: input.eventId ? { id: input.eventId } : {},
        orderBy: { eventDate: 'asc' },
      }),
      this.prisma.opsInquiry.findMany(),
      this.prisma.opsApprovalRequest.findMany(),
    ]);
    const eventIds = events.map((event: OpsEvent) => event.id);
    const [guestCheckIns, guestFeedback] = await Promise.all([
      this.prisma.opsGuestCheckIn.findMany({
        where: eventIds.length ? { eventId: { in: eventIds } } : { eventId: { in: [] } },
        orderBy: { checkedInAt: 'desc' },
      }),
      this.prisma.opsGuestFeedback.findMany({
        where: eventIds.length ? { eventId: { in: eventIds } } : { eventId: { in: [] } },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);

    const eventsInventory = events.map((event: OpsEvent) => {
      const inquiry = inquiries.find((item: OpsInquiry) => item.id === event.inquiryId);
      const checkIns = guestCheckIns.filter((item: OpsGuestCheckIn) => item.eventId === event.id);
      const feedback = guestFeedback.filter((item: OpsGuestFeedback) => item.eventId === event.id);
      const surfaces = [
        this.privacySurface('inquiry', inquiry ? 1 : 0, ['client_contact', 'event_details', 'consent'], [
          inquiry,
        ]),
        this.privacySurface('guest_check_in', checkIns.length, ['guest_name', 'attendance', 'consent'], checkIns),
        this.privacySurface('guest_feedback', feedback.length, ['guest_name', 'rating', 'comment', 'media_metadata', 'consent'], feedback),
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
        this.privacySurface('account_approval_request', approvalRequests.length, ['email', 'role', 'organization', 'consent'], approvalRequests),
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
    ];
  }

  async listRequests(input: ListPrivacyRequestsInput = {}) {
    const requests = await this.prisma.opsPrivacyRequest.findMany({
      where: {
        ...(input.eventId ? { eventId: input.eventId } : {}),
        ...(input.status && input.status !== 'all' ? { status: input.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request: OpsPrivacyRequestRecord) => this.mapRequest(request));
  }

  async createRequest(input: CreatePrivacyRequestInput, actor: PrivacyActor) {
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
          createdBy: actor.name,
        },
      });

      await this.auditService.audit(input.eventId, actor.name, `Logged privacy request: ${input.requestType}`, {
        actorRole: actor.role,
        actionType: AuditActionType.Create,
        category: AuditCategory.Access,
        affectedType: 'privacy_request',
        affectedId: request.id,
        affectedLabel: input.subjectEmail ?? input.subjectName,
        metadata: { requestType: input.requestType, subjectType: input.subjectType },
      }, { prisma: tx, correlationId: `privacy:${request.id}`, actorId: actor.name });

      return this.mapRequest(request);
    });
  }

  async reviewRequest(requestId: string, input: ReviewPrivacyRequestInput, actor: PrivacyActor) {
    if (
      !isOpsConstantValue(PrivacyRequestStatus, input.status) ||
      (input.status !== PrivacyRequestStatus.Approved && input.status !== PrivacyRequestStatus.Rejected)
    ) {
      throw new BadRequestException('Privacy request review must approve or reject');
    }
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
          reviewedBy: actor.name,
          reviewedAt: new Date(),
        },
      });
      if (changed.count !== 1) throw new BadRequestException('Privacy request was already reviewed');
      const saved = await tx.opsPrivacyRequest.findUniqueOrThrow({ where: { id: requestId } });

      await this.auditService.audit(request.eventId ?? undefined, actor.name, `${input.status === PrivacyRequestStatus.Approved ? 'Approved' : 'Rejected'} privacy request`, {
        actorRole: actor.role,
        actionType: input.status === PrivacyRequestStatus.Approved ? AuditActionType.Approve : AuditActionType.Decline,
        category: AuditCategory.Access,
        affectedType: 'privacy_request',
        affectedId: request.id,
        affectedLabel: request.subjectEmail || request.subjectName,
        metadata: { reviewReason: input.reviewReason ?? '' },
      }, { prisma: tx, correlationId: `privacy:${request.id}`, actorId: actor.name });

      return this.mapRequest(saved);
    });
  }

  async executeRequest(requestId: string, input: ExecutePrivacyRequestInput, actor: PrivacyActor) {
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

      const redaction = await this.softRedactSubject(request, tx);
      if (!redaction.touchedRecords) {
        throw new BadRequestException('No supported records matched this privacy request; execution remains pending');
      }
      await this.auditService.audit(request.eventId ?? undefined, actor.name, 'Soft redaction summary for privacy request', {
        actorRole: actor.role,
        actionType: AuditActionType.Update,
        category: AuditCategory.Access,
        affectedType: 'privacy_request',
        affectedId: request.id,
        affectedLabel: request.subjectEmail || request.subjectName,
        metadata: redaction,
      }, { prisma: tx, correlationId: `privacy:${request.id}`, actorId: actor.name });
      const saved = await tx.opsPrivacyRequest.update({
        where: { id: requestId },
        data: { status: PrivacyRequestStatus.Executed, executionNotes: input.executionNotes ?? '', executedBy: actor.name, executedAt: new Date() },
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
    const account = await prisma.opsUser.findFirst({
      where: { email: { equals: byEmail, mode: 'insensitive' } }, select: { id: true },
    });
    if (account) throw new BadRequestException('This identity has an account; account deletion is not supported yet');
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

  private recordRedaction(surfaces: string[], surface: string, count: number) {
    if (count) surfaces.push(surface);
    return count;
  }

  private async redactClientSurfaces(request: OpsPrivacyRequestRecord, byEmail: string, redactedEmail: string, prisma: Prisma.TransactionClient) {
    const surfaces: string[] = [];
    let touchedRecords = 0;
    // Capture links before redacting either email column, including pre-normalization records.
    const identities = await prisma.opsInquiry.findMany({
      where: {
        OR: [{ email: { equals: byEmail, mode: 'insensitive' } }, { normalizedEmail: byEmail }],
        ...(request.eventId ? { events: { some: { id: request.eventId } } } : {}),
      },
      select: { id: true },
    });
    const inquiryIds = identities.map((inquiry) => inquiry.id);
    const inquiries = await prisma.opsInquiry.updateMany({
      where: { id: { in: inquiryIds } },
      data: {
        clientName: 'Redacted data subject',
        companyName: '',
        email: redactedEmail,
        normalizedEmail: redactedEmail,
        referralDetails: '',
        message: '[redacted by privacy request]',
        loggedByName: null,
        previousDeclineReason: null,
        declineReason: null,
      },
    });
    touchedRecords += this.recordRedaction(surfaces, 'inquiry', inquiries.count);

    const linkedEvents = await prisma.opsEvent.updateMany({
      where: { inquiryId: { in: inquiryIds } },
      data: { clientName: 'Redacted data subject' },
    });
    touchedRecords += this.recordRedaction(surfaces, 'event_client_copy', linkedEvents.count);

    const billing = await prisma.opsBillingStatement.updateMany({
      where: { event: { inquiryId: { in: inquiryIds } } },
      data: { clientName: 'Redacted data subject', clientContact: redactedEmail },
    });
    touchedRecords += this.recordRedaction(surfaces, 'billing_client_copy', billing.count);
    const approvals = await this.redactApprovalIdentity(byEmail, redactedEmail, OpsUserRole.Client, prisma);
    touchedRecords += this.recordRedaction(surfaces, 'approval_request', approvals.count);
    return { surfaces, touchedRecords };
  }

  private async redactSupplierSurfaces(byEmail: string, redactedEmail: string, prisma: Prisma.TransactionClient) {
    const surfaces: string[] = [];
    let touchedRecords = 0;
    const suppliers = await prisma.opsSupplier.updateMany({
      where: { email: { equals: byEmail, mode: 'insensitive' } },
      data: {
        contactName: 'Redacted supplier contact',
        email: redactedEmail,
        phone: '',
        performanceNotes: '[redacted by privacy request]',
      },
    });
    touchedRecords += this.recordRedaction(surfaces, 'supplier', suppliers.count);
    const supplierApplications = await prisma.opsSupplierApplication.updateMany({
      where: { OR: [{ email: { equals: byEmail, mode: 'insensitive' } }, { normalizedEmail: byEmail }] },
      data: {
        contactName: 'Redacted supplier contact', email: redactedEmail, normalizedEmail: redactedEmail,
        phone: '', portfolioUrl: '', additionalNotes: '[redacted by privacy request]',
      },
    });
    touchedRecords += this.recordRedaction(surfaces, 'supplier_application', supplierApplications.count);
    const approvals = await this.redactApprovalIdentity(byEmail, redactedEmail, OpsUserRole.Supplier, prisma);
    touchedRecords += this.recordRedaction(surfaces, 'approval_request', approvals.count);
    return { surfaces, touchedRecords };
  }

  private redactApprovalIdentity(byEmail: string, redactedEmail: string, role: string, prisma: Prisma.TransactionClient) {
    return prisma.opsApprovalRequest.updateMany({
      where: { email: { equals: byEmail, mode: 'insensitive' }, role },
      data: { name: 'Redacted data subject', email: redactedEmail, organization: '' },
    });
  }

  private async redactNameSurfaces(request: OpsPrivacyRequestRecord, byName: string, prisma: Prisma.TransactionClient) {
    const surfaces: string[] = [];
    let touchedRecords = 0;
    const guestWhere = {
      ...(request.eventId ? { eventId: request.eventId } : {}),
      guestName: { equals: byName.trim(), mode: 'insensitive' as const },
    };
    if (!request.eventId) throw new BadRequestException('Guest deletion requires an event scope');
    const checkIns = await prisma.opsGuestCheckIn.updateMany({
      where: guestWhere,
      data: { guestName: 'Redacted guest' },
    });
    touchedRecords += this.recordRedaction(surfaces, 'guest_check_in', checkIns.count);

    const feedback = await prisma.opsGuestFeedback.updateMany({
      where: guestWhere,
      data: {
        guestName: 'Redacted guest',
        comment: '[redacted by privacy request]',
        photoFileName: null,
        videoFileName: null,
      },
    });
    touchedRecords += this.recordRedaction(surfaces, 'guest_feedback', feedback.count);
    return { surfaces, touchedRecords };
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
}
