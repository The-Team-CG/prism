import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '@prism/database';
import { randomUUID } from 'node:crypto';
import {
  AuditActionType,
  AuditCategory,
  OpsUserRole,
  PrivacyRequestStatus,
  PrivacyRequestType,
  isOpsConstantValue,
} from '../ops.constants';
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
        retentionPeriod: '7 years append-only sample policy',
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
    if (!input.subjectEmail && !input.subjectName) {
      throw new BadRequestException('Privacy request requires a subject email or subject name');
    }

    const request = await this.prisma.opsPrivacyRequest.create({
      data: {
        id: `priv_${randomUUID()}`,
        eventId: input.eventId ?? null,
        subjectType: input.subjectType.trim().toLowerCase(),
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
    });

    return this.mapRequest(request);
  }

  async reviewRequest(requestId: string, input: ReviewPrivacyRequestInput, actor: PrivacyActor) {
    if (
      !isOpsConstantValue(PrivacyRequestStatus, input.status) ||
      (input.status !== PrivacyRequestStatus.Approved && input.status !== PrivacyRequestStatus.Rejected)
    ) {
      throw new BadRequestException('Privacy request review must approve or reject');
    }
    const request = await this.requireRequest(requestId);
    if (request.status !== PrivacyRequestStatus.Submitted) {
      throw new BadRequestException('Only submitted privacy requests can be reviewed');
    }

    const saved = await this.prisma.opsPrivacyRequest.update({
      where: { id: requestId },
      data: {
        status: input.status,
        reviewReason: input.reviewReason ?? '',
        reviewedBy: actor.name,
        reviewedAt: new Date(),
      },
    });

    await this.auditService.audit(request.eventId ?? undefined, actor.name, `${input.status === PrivacyRequestStatus.Approved ? 'Approved' : 'Rejected'} privacy request`, {
      actorRole: actor.role,
      actionType: input.status === PrivacyRequestStatus.Approved ? AuditActionType.Approve : AuditActionType.Decline,
      category: AuditCategory.Access,
      affectedType: 'privacy_request',
      affectedId: request.id,
      affectedLabel: request.subjectEmail || request.subjectName,
      metadata: { reviewReason: input.reviewReason ?? '' },
    });

    return this.mapRequest(saved);
  }

  async executeRequest(requestId: string, input: ExecutePrivacyRequestInput, actor: PrivacyActor) {
    const request = await this.requireRequest(requestId);
    if (request.status !== PrivacyRequestStatus.Approved) {
      throw new BadRequestException('Privacy request must be approved before execution');
    }

    const redaction = request.requestType === PrivacyRequestType.Deletion
      ? await this.softRedactSubject(request)
      : { touchedRecords: 0, surfaces: [] as string[] };

    await this.auditService.audit(request.eventId ?? undefined, actor.name, 'Soft redaction summary for privacy request', {
      actorRole: actor.role,
      actionType: AuditActionType.Update,
      category: AuditCategory.Access,
      affectedType: 'privacy_request',
      affectedId: request.id,
      affectedLabel: request.subjectEmail || request.subjectName,
      metadata: redaction,
    });

    const saved = await this.prisma.opsPrivacyRequest.update({
      where: { id: requestId },
      data: {
        status: PrivacyRequestStatus.Executed,
        executionNotes: input.executionNotes ?? '',
        executedBy: actor.name,
        executedAt: new Date(),
      },
    });

    await this.auditService.audit(request.eventId ?? undefined, actor.name, `Executed privacy request: ${request.requestType}`, {
      actorRole: actor.role,
      actionType: AuditActionType.Resolve,
      category: AuditCategory.Access,
      affectedType: 'privacy_request',
      affectedId: request.id,
      affectedLabel: request.subjectEmail || request.subjectName,
      metadata: { executionNotes: input.executionNotes ?? '', redaction },
    });

    return this.mapRequest(saved);
  }

  private async requireRequest(requestId: string) {
    const request = await this.prisma.opsPrivacyRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Privacy request not found');
    return request;
  }

  private assertRequestType(requestType: string) {
    if (!isOpsConstantValue(PrivacyRequestType, requestType)) {
      throw new BadRequestException('Unsupported privacy request type');
    }
  }

  private async softRedactSubject(request: OpsPrivacyRequestRecord) {
    const redactedEmail = `redacted+privacy_${request.id}@privacy.local`;
    const byEmail = request.subjectEmail ? request.subjectEmail.toLowerCase() : undefined;
    const byName = request.subjectName || undefined;
    let touchedRecords = 0;
    const surfaces: string[] = [];

    if (byEmail) {
      const inquiries = await this.prisma.opsInquiry.updateMany({
        where: { email: byEmail },
        data: {
          clientName: 'Redacted data subject',
          companyName: '',
          email: redactedEmail,
          referralDetails: '',
          message: '[redacted by privacy request]',
          loggedByName: null,
        },
      });
      if (inquiries.count) surfaces.push('inquiry');
      touchedRecords += inquiries.count;

      const approvals = await this.prisma.opsApprovalRequest.updateMany({
        where: { email: byEmail },
        data: {
          name: 'Redacted data subject',
          email: redactedEmail,
          organization: '',
        },
      });
      if (approvals.count) surfaces.push('approval_request');
      touchedRecords += approvals.count;

      const suppliers = await this.prisma.opsSupplier.updateMany({
        where: { email: byEmail },
        data: {
          contactName: 'Redacted supplier contact',
          email: redactedEmail,
          phone: '',
          performanceNotes: '[redacted by privacy request]',
        },
      });
      if (suppliers.count) surfaces.push('supplier');
      touchedRecords += suppliers.count;
    }

    if (byName) {
      const guestWhere = {
        ...(request.eventId ? { eventId: request.eventId } : {}),
        guestName: byName,
      };
      const checkIns = await this.prisma.opsGuestCheckIn.updateMany({
        where: guestWhere,
        data: { guestName: 'Redacted guest' },
      });
      if (checkIns.count) surfaces.push('guest_check_in');
      touchedRecords += checkIns.count;

      const feedback = await this.prisma.opsGuestFeedback.updateMany({
        where: guestWhere,
        data: {
          guestName: 'Redacted guest',
          comment: '[redacted by privacy request]',
          photoFileName: null,
          videoFileName: null,
        },
      });
      if (feedback.count) surfaces.push('guest_feedback');
      touchedRecords += feedback.count;
    }

    return {
      touchedRecords,
      surfaces,
      redactedEmail: byEmail ? redactedEmail : null,
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
}
