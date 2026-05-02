import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { OpsDocument, OpsInquiry } from '@prisma/client';
import { toPrismaJson } from '@prism/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, OpsUserRole } from '../ops.constants';
import { AuditService } from './audit.service';

export type CreateInquiryInput = {
  clientName: string;
  companyName?: string;
  email: string;
  eventName: string;
  eventType?: string;
  eventDate: string;
  clientType: string;
  source?: string;
  referralDetails?: string;
  loggedByRole?: string;
  loggedByName?: string;
  message: string;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
};

export type UpdateInquiryStatusInput = {
  status: string;
  declineReason?: string;
};

export type DemoActorInput = {
  actorRole?: string;
  role?: string;
  actorName?: string;
  name?: string;
  actorEmail?: string;
  email?: string;
};

type InquiryWithTriage = OpsInquiry & {
  normalizedEmail?: string;
  referralDetails?: string;
  loggedByRole?: string | null;
  loggedByName?: string | null;
  duplicateOfInquiryId?: string | null;
  previousDeclinedInquiryId?: string | null;
  previousDeclineReason?: string | null;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
};

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function sameNormalizedEmail(inquiry: InquiryWithTriage, normalizedEmail: string) {
  return (inquiry.normalizedEmail || normalizeEmail(inquiry.email)) === normalizedEmail;
}

function daysBetween(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) / 86_400_000;
}

export class InquiriesService {
  constructor(
    private readonly prisma: any,
    private readonly auditService: AuditService,
  ) {}

  async createInquiry(input: CreateInquiryInput) {
    if (input.source === 'Log on Behalf') {
      throw new BadRequestException('Public inquiries cannot use Log on Behalf source');
    }
    if (!input.privacyConsentAccepted) {
      throw new BadRequestException('Privacy consent is required before submitting a public inquiry');
    }

    return this.createInquiryRecord(input, false);
  }

  async logInquiryOnBehalf(input: CreateInquiryInput, actorInput: DemoActorInput = {}) {
    const role = actorInput.actorRole ?? actorInput.role ?? OpsUserRole.Unknown;
    if (role !== OpsUserRole.PmcmAdmin && role !== OpsUserRole.System) {
      throw new ForbiddenException('Only PMCM can log inquiries on behalf of clients');
    }

    return this.createInquiryRecord(
      {
        ...input,
        source: 'Log on Behalf',
        loggedByRole: role,
        loggedByName: actorInput.actorName ?? actorInput.name ?? actorInput.actorEmail ?? actorInput.email ?? 'PMCM Admin',
      },
      true,
    );
  }

  async updateInquiryStatus(inquiryId: string, input: UpdateInquiryStatusInput) {
    const current = await this.prisma.opsInquiry.findUnique({ where: { id: inquiryId } });
    if (!current) throw new NotFoundException('Inquiry not found');
    if (current.status === 'declined' && input.status !== 'declined') {
      throw new BadRequestException('Declined inquiries are permanently flagged and cannot be reopened');
    }
    if (input.status === 'declined' && !input.declineReason) {
      throw new BadRequestException('Decline reason is required');
    }

    const now = new Date();
    const data =
      input.status === 'accepted'
        ? {
            status: 'accepted',
            acceptedAt: current.acceptedAt ?? now,
            conformeSentAt: current.conformeSentAt ?? now,
            declineReason: null,
          }
        : input.status === 'pending'
          ? {
              status: 'pending',
              pendingAt: now,
            }
          : input.status === 'declined'
            ? {
                status: 'declined',
                declinedAt: current.declinedAt ?? now,
                declineReason: input.declineReason,
              }
            : {
                status: input.status,
              };

    const inquiry = await this.prisma.opsInquiry.update({ where: { id: inquiryId }, data });

    if (input.status === 'accepted') {
      await Promise.all([
        this.audit(undefined, 'PMCM Admin', `Accepted inquiry for ${inquiry.clientName}; conforme sent`),
        this.notify(undefined, inquiry.email, 'Inquiry accepted; signed conforme required'),
        this.notify(undefined, inquiry.clientName, 'Conforme sent by PMCM', 'viber'),
      ]);
    }
    if (input.status === 'pending') {
      await this.audit(undefined, 'PMCM Admin', `Marked inquiry pending for ${inquiry.clientName}`);
    }
    if (input.status === 'declined') {
      await this.audit(undefined, 'PMCM Admin', `Declined inquiry for ${inquiry.clientName}: ${input.declineReason}`);
    }

    return inquiry;
  }

  async sendConformeReminder(inquiryId: string) {
    return this.sendConformeReminderForInquiry(inquiryId, 'PMCM Admin');
  }

  async runConformeReminderSweep() {
    const inquiries = await this.prisma.opsInquiry.findMany({
      where: {
        status: 'accepted',
        conformeSentAt: { not: null },
        conformeSignedAt: null,
      },
    });

    const now = new Date();
    for (const inquiry of inquiries) {
      const reminderBase = inquiry.lastConformeReminderAt ?? inquiry.conformeSentAt;
      if (!reminderBase) continue;

      const dueAt = addDays(reminderBase, inquiry.followUpIntervalDays);
      if (dueAt <= now) {
        await this.sendConformeReminderForInquiry(inquiry.id, 'System');
      }
    }
  }

  async markPortalInvitationOpenedByEmail(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const inquiries = await this.prisma.opsInquiry.findMany();
    const now = new Date();
    const openable = inquiries.filter((inquiry: InquiryWithTriage) => {
      return (
        sameNormalizedEmail(inquiry, normalizedEmail) &&
        inquiry.portalInvitationStatus === 'sent' &&
        !inquiry.portalInvitationOpenedAt
      );
    });

    for (const inquiry of openable) {
      await this.prisma.opsInquiry.update({
        where: { id: inquiry.id },
        data: {
          portalInvitationStatus: 'opened',
          portalInvitationOpenedAt: now,
        },
      });
    }
  }

  async uploadConforme(
    inquiryId: string,
    input: { type?: string; fileName: string; mimeType?: string; sizeBytes?: number },
  ): Promise<OpsDocument> {
    const inquiry = await this.prisma.opsInquiry.findUnique({ where: { id: inquiryId } });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    if (inquiry.status !== 'accepted') {
      throw new BadRequestException('Inquiry must be accepted before conforme upload');
    }

    const existingEvent = await this.prisma.opsEvent.findFirst({ where: { inquiryId } });

    const billingYear = inquiry.eventDate.getFullYear();
    const billingCount = await this.prisma.opsBillingStatement.count({
      where: { number: { startsWith: `BS-${billingYear}-` } },
    });
    const now = new Date();
    const document = await this.prisma.$transaction(async (tx: any) => {
      const event =
        existingEvent ??
        (await tx.opsEvent.create({
          data: {
            id: `evt_${randomUUID()}`,
            inquiryId: inquiry.id,
            clientName: inquiry.clientName,
            eventName: inquiry.eventName,
            eventDate: inquiry.eventDate,
            status: 'briefing',
            clientPortalStatus: 'unlocked',
            readiness: 'Client briefing open',
          },
        }));

      if (!existingEvent) {
        await tx.opsPostEventDocument.createMany({
          data: [
            {
              id: `ped_${randomUUID()}`,
              eventId: event.id,
              title: 'Completion report',
              status: 'pending',
            },
            {
              id: `ped_${randomUUID()}`,
              eventId: event.id,
              title: 'Photo and video turnover',
              status: 'pending',
            },
          ],
        });
      }

      const doc = await tx.opsDocument.create({
        data: {
          id: `doc_${randomUUID()}`,
          eventId: event.id,
          type: input.type ?? 'signed_conforme',
          fileName: input.fileName,
          status: 'approved',
          mimeType: input.mimeType ?? null,
          sizeBytes: input.sizeBytes ?? null,
          uploadedByRole: 'client',
        },
      });

      await tx.opsEvent.update({
        where: { id: event.id },
        data: {
          clientPortalStatus: 'unlocked',
          readiness: 'Client briefing open',
          status: 'briefing',
        },
      });

      await tx.opsInquiry.update({
        where: { id: inquiry.id },
        data: {
          conformeSignedAt: now,
          portalActivatedAt: now,
          portalInvitationStatus: 'sent',
          portalInvitationSentAt: now,
          portalInvitationExpiresAt: addDays(now, 7),
        },
      });

      if ((await tx.opsBillingStatement.count({ where: { eventId: event.id } })) === 0) {
        const billingNumber = `BS-${billingYear}-${String(billingCount + 1).padStart(4, '0')}`;
        const totalAmount = 520000;
        const downpayment = Math.floor(totalAmount / 2);
        const balance = totalAmount - downpayment;
        const balanceDueDate = addDays(event.eventDate, -7);
        const storageKey = `events/${event.id}/billing/${billingNumber}.pdf`;
        const lineItems = [{ label: 'Approved event package', amount: totalAmount }];
        const paymentSchedule = [
          { label: 'Downpayment', percentage: 50, amount: downpayment, dueDate: isoDate(now) },
          { label: 'Balance', percentage: 50, amount: balance, dueDate: isoDate(balanceDueDate) },
        ];
        const paymentMethods = [
          { label: 'Bank Transfer', details: 'PMCM corporate bank account' },
          { label: 'GCash', details: 'PMCM finance GCash number' },
          { label: 'Cheque', details: 'Payable to PMCM Events Management' },
        ];
        const billingDocument = await tx.opsDocument.create({
          data: {
            id: `doc_${randomUUID()}`,
            eventId: event.id,
            type: 'billing_statement',
            fileName: `${billingNumber}.pdf`,
            status: 'generated',
            mimeType: 'application/pdf',
            storageBucket: 'document-vault',
            storageKey,
            uploadedByRole: 'system',
          },
        });
        const billingSource = await tx.opsBillingSource.create({
          data: {
            id: `bsrc_${randomUUID()}`,
            eventId: event.id,
            sourceType: 'conforme_approved_ce',
            sourceLabel: 'Approved onboarding CE/proposal total',
            sourceDocumentId: billingDocument.id,
            lineItems: toPrismaJson(lineItems),
            paymentSchedule: toPrismaJson(paymentSchedule),
            paymentMethods: toPrismaJson(paymentMethods),
            totalAmount,
            status: 'approved',
            approvedAt: now,
            approvedBy: 'PMCM Admin',
            approvalNotes: 'Generated from signed conforme onboarding source.',
          },
        });

        await tx.opsBillingStatement.create({
          data: {
            id: `bill_${randomUUID()}`,
            eventId: event.id,
            sourceId: billingSource.id,
            number: billingNumber,
            clientName: inquiry.clientName,
            clientContact: inquiry.email,
            eventName: event.eventName,
            eventDate: event.eventDate,
            lineItems: toPrismaJson(lineItems),
            paymentSchedule: toPrismaJson(paymentSchedule),
            paymentMethods: toPrismaJson(paymentMethods),
            totalAmount,
            documentId: billingDocument.id,
            pdfUrl: `/documents/${storageKey}`,
            storageKey,
            status: 'issued',
          },
        });

        await tx.opsPaymentMilestone.createMany({
          data: [
            {
              id: `pay_${randomUUID()}`,
              eventId: event.id,
              label: 'Downpayment',
              percentage: 50,
              amount: downpayment,
              amountPaid: 0,
              remainingBalance: downpayment,
              dueDate: now,
              status: 'pending',
            },
            {
              id: `pay_${randomUUID()}`,
              eventId: event.id,
              label: 'Balance',
              percentage: 50,
              amount: balance,
              amountPaid: 0,
              remainingBalance: balance,
              dueDate: balanceDueDate,
              status: 'pending',
            },
          ],
        });

        await tx.opsAuditLog.create({
          data: {
            id: `aud_${randomUUID()}`,
            eventId: event.id,
            actor: 'System',
            action: `Generated billing statement ${billingNumber}`,
            category: 'finance',
            actionType: 'create',
            affectedType: 'billing_statement',
            affectedLabel: billingNumber,
          },
        });

        await tx.opsNotificationLog.create({
          data: {
            id: `not_${randomUUID()}`,
            eventId: event.id,
            channel: 'email',
            recipient: inquiry.email,
            message: `Billing statement ${billingNumber} generated`,
            status: 'queued',
          },
        });
      }

      await tx.opsAuditLog.create({
        data: {
          id: `aud_${randomUUID()}`,
          eventId: event.id,
          actor: 'PMCM Admin',
          action: 'Uploaded signed conforme and unlocked client portal',
          category: 'documents',
          actionType: 'upload',
          affectedType: 'document',
          affectedId: doc.id,
          affectedLabel: doc.fileName,
        },
      });
      await tx.opsNotificationLog.create({
        data: {
          id: `not_${randomUUID()}`,
          eventId: event.id,
          channel: 'email',
          recipient: event.clientName,
          message: 'Client portal unlocked',
          status: 'queued',
        },
      });

      return doc;
    });

    return document;
  }

  private async createInquiryRecord(input: CreateInquiryInput, allowLogOnBehalf: boolean) {
    const normalizedEmail = normalizeEmail(input.email);
    const eventDate = new Date(input.eventDate);
    if (Number.isNaN(eventDate.getTime())) throw new BadRequestException('Invalid event date');

    const source = input.source ?? 'Website';
    if (source === 'Log on Behalf' && !allowLogOnBehalf) {
      throw new BadRequestException('Public inquiries cannot use Log on Behalf source');
    }

    const existingInquiries = (await this.prisma.opsInquiry.findMany({
      orderBy: { createdAt: 'asc' },
    })) as InquiryWithTriage[];
    const sameEmail = existingInquiries.filter((inquiry) => sameNormalizedEmail(inquiry, normalizedEmail));
    const duplicate = sameEmail
      .filter((inquiry) => inquiry.status !== 'declined' && daysBetween(inquiry.eventDate, eventDate) <= 14)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0];
    const previousDeclined = sameEmail
      .filter((inquiry) => inquiry.status === 'declined')
      .sort((left, right) => {
        const leftDate = left.declinedAt ?? left.createdAt;
        const rightDate = right.declinedAt ?? right.createdAt;
        return rightDate.getTime() - leftDate.getTime();
      })[0];

    const inquiry = await this.prisma.opsInquiry.create({
      data: {
        id: `inq_${randomUUID()}`,
        clientName: input.clientName,
        companyName: input.companyName ?? '',
        email: input.email.trim(),
        normalizedEmail,
        eventName: input.eventName,
        eventType: input.eventType ?? input.clientType,
        eventDate,
        clientType: input.clientType,
        source,
        referralDetails: input.referralDetails ?? '',
        loggedByRole: allowLogOnBehalf ? input.loggedByRole ?? OpsUserRole.PmcmAdmin : null,
        loggedByName: allowLogOnBehalf ? input.loggedByName ?? 'PMCM Admin' : null,
        duplicateOfInquiryId: duplicate?.id ?? null,
        previousDeclinedInquiryId: previousDeclined?.id ?? null,
        previousDeclineReason: previousDeclined?.declineReason ?? null,
        message: input.message,
        privacyConsentAccepted: Boolean(input.privacyConsentAccepted),
        privacyNoticeVersion: input.privacyNoticeVersion ?? '2026-05-01',
        marketingConsentAccepted: Boolean(input.marketingConsentAccepted),
        status: 'new',
      },
    });

    await Promise.all([
      this.audit(undefined, 'PMCM Admin', duplicate ? 'Created duplicate inquiry' : 'Created new inquiry', {
        actionType: AuditActionType.Create,
        category: AuditCategory.Events,
        affectedType: 'inquiry',
        affectedId: inquiry.id,
        affectedLabel: inquiry.eventName,
        metadata: {
          duplicateOfInquiryId: duplicate?.id ?? null,
          previousDeclinedInquiryId: previousDeclined?.id ?? null,
          source,
        },
      }),
      this.notify(undefined, inquiry.email, 'Inquiry received'),
    ]);

    return inquiry;
  }

  private async sendConformeReminderForInquiry(inquiryId: string, actor: 'PMCM Admin' | 'System') {
    const inquiry = await this.prisma.opsInquiry.findUnique({ where: { id: inquiryId } });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    if (inquiry.status !== 'accepted') {
      throw new BadRequestException('Conforme reminders only apply to accepted inquiries');
    }
    if (inquiry.conformeSignedAt) {
      throw new BadRequestException('Conforme has already been signed');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx: any) => {
      const saved = await tx.opsInquiry.update({
        where: { id: inquiry.id },
        data: { lastConformeReminderAt: now },
      });

      await tx.opsNotificationLog.createMany({
        data: [
          {
            id: `not_${randomUUID()}`,
            channel: 'email',
            recipient: inquiry.email,
            message: 'Reminder: signed conforme is still outstanding',
            status: 'queued',
          },
          {
            id: `not_${randomUUID()}`,
            channel: 'viber',
            recipient: inquiry.clientName,
            message: 'Reminder: signed conforme is still outstanding',
            status: 'queued',
          },
        ],
      });

      await tx.opsAuditLog.create({
        data: {
          id: `aud_${randomUUID()}`,
          actor,
          action: `Sent conforme follow-up reminder to ${inquiry.clientName}`,
        },
      });

      return saved;
    });

    return updated;
  }

  private audit(
    eventId: string | undefined,
    actor: string,
    action: string,
    options: {
      actorRole?: string;
      actorEmail?: string;
      actionType?: string;
      category?: string;
      affectedType?: string;
      affectedId?: string;
      affectedLabel?: string;
      metadata?: Record<string, unknown>;
      severity?: string;
    } = {},
  ) {
    return this.auditService.audit(eventId, actor, action, options);
  }

  private notify(
    eventId: string | undefined,
    recipient: string,
    message: string,
    channel: 'email' | 'viber' = 'email',
  ) {
    return this.auditService.notify(eventId, recipient, message, channel);
  }
}
