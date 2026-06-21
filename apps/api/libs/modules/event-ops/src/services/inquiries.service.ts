import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { OpsDocument, OpsEvent, OpsInquiry, Prisma } from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { toPrismaJson } from '@prism/database';
import type { PrismEventOpsActorContext } from '@prism/types';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, OpsUserRole } from '../ops.constants';
import { AuditService } from './audit.service';
import { NotificationOutboxService } from './notification-outbox.service';
import { WorkflowCommandService } from './workflow-command.service';

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

export type SampleActorInput = PrismEventOpsActorContext;

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

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationOutboxService: NotificationOutboxService,
    private readonly workflowCommandService: WorkflowCommandService,
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

  async logInquiryOnBehalf(input: CreateInquiryInput, actorInput: SampleActorInput = {}) {
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
    let current: OpsInquiry | null = null;
    let data: Prisma.OpsInquiryUpdateInput = {};

    return this.workflowCommandService.execute<OpsInquiry>({
      name: 'update_inquiry_status',
      validateState: async () => {
        current = await this.prisma.opsInquiry.findUnique({ where: { id: inquiryId } });
        if (!current) throw new NotFoundException('Inquiry not found');
        if (current.status === 'declined' && input.status !== 'declined') {
          throw new BadRequestException('Declined inquiries are permanently flagged and cannot be reopened');
        }
        if (input.status === 'declined' && !input.declineReason) {
          throw new BadRequestException('Decline reason is required');
        }

        const now = new Date();
        data =
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
      },
      write: () => this.prisma.opsInquiry.update({ where: { id: inquiryId }, data }),
      sideEffects: async (inquiry) => {
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
      },
    });
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
    for (const inquiry of inquiries) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: reminder sweep processes only accepted unsigned inquiries.
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
    const now = new Date();
    await this.prisma.opsInquiry.updateMany({
      where: {
        normalizedEmail,
        portalInvitationStatus: 'sent',
        portalInvitationOpenedAt: null,
      },
      data: {
        portalInvitationStatus: 'opened',
        portalInvitationOpenedAt: now,
      },
    });
  }

  async uploadConforme(
    inquiryId: string,
    input: { type?: string; fileName: string; mimeType?: string; sizeBytes?: number },
  ): Promise<OpsDocument> {
    let inquiry: OpsInquiry | null = null;
    let existingEvent: OpsEvent | null = null;
    let billingYear = 0;
    let billingCount = 0;
    const now = new Date();

    return this.workflowCommandService.execute<
      { document: OpsDocument; event: OpsEvent; billingNumber?: string },
      OpsDocument
    >({
      name: 'upload_conforme',
      validateState: async () => {
        inquiry = await this.prisma.opsInquiry.findUnique({ where: { id: inquiryId } });
        if (!inquiry) throw new NotFoundException('Inquiry not found');
        if (inquiry.status !== 'accepted') {
          throw new BadRequestException('Inquiry must be accepted before conforme upload');
        }

        existingEvent = await this.prisma.opsEvent.findFirst({ where: { inquiryId } });
        billingYear = inquiry.eventDate.getFullYear();
        billingCount = await this.prisma.opsBillingStatement.count({
          where: { number: { startsWith: `BS-${billingYear}-` } },
        });
      },
      write: async () => {
        if (!inquiry) throw new NotFoundException('Inquiry not found');

        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          const event =
            existingEvent ??
            (await tx.opsEvent.create({
              data: {
                id: `evt_${randomUUID()}`,
                inquiryId: inquiry!.id,
                clientName: inquiry!.clientName,
                eventName: inquiry!.eventName,
                eventDate: inquiry!.eventDate,
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

          const document = await tx.opsDocument.create({
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
            where: { id: inquiry!.id },
            data: {
              conformeSignedAt: now,
              portalActivatedAt: now,
              portalInvitationStatus: 'sent',
              portalInvitationSentAt: now,
              portalInvitationExpiresAt: addDays(now, 7),
            },
          });

          let billingNumber: string | undefined;
          if ((await tx.opsBillingStatement.count({ where: { eventId: event.id } })) === 0) {
            billingNumber = `BS-${billingYear}-${String(billingCount + 1).padStart(4, '0')}`;
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
                clientName: inquiry!.clientName,
                clientContact: inquiry!.email,
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
          }

          return { document, event, billingNumber };
        });
      },
      sideEffects: async ({ document, event, billingNumber }) => {
        const sideEffects: Array<Promise<unknown>> = [
          this.audit(event.id, 'PMCM Admin', 'Uploaded signed conforme and unlocked client portal', {
            category: AuditCategory.Documents,
            actionType: AuditActionType.Upload,
            affectedType: 'document',
            affectedId: document.id,
            affectedLabel: document.fileName,
          }),
          this.notify(event.id, event.clientName, 'Client portal unlocked'),
        ];

        if (billingNumber && inquiry) {
          sideEffects.push(
            this.audit(event.id, 'System', `Generated billing statement ${billingNumber}`, {
              category: AuditCategory.Finance,
              actionType: AuditActionType.Create,
              affectedType: 'billing_statement',
              affectedLabel: billingNumber,
            }),
            this.notify(event.id, inquiry.email, `Billing statement ${billingNumber} generated`),
          );
        }

        await Promise.all(sideEffects);
      },
      project: ({ document }) => document,
    });
  }

  private async createInquiryRecord(input: CreateInquiryInput, allowLogOnBehalf: boolean) {
    const normalizedEmail = normalizeEmail(input.email);
    const eventDate = new Date(input.eventDate);
    if (Number.isNaN(eventDate.getTime())) throw new BadRequestException('Invalid event date');

    const source = input.source ?? 'Website';
    if (source === 'Log on Behalf' && !allowLogOnBehalf) {
      throw new BadRequestException('Public inquiries cannot use Log on Behalf source');
    }

    let duplicate: InquiryWithTriage | undefined;
    let previousDeclined: InquiryWithTriage | undefined;

    return this.workflowCommandService.execute<OpsInquiry>({
      name: allowLogOnBehalf ? 'log_inquiry_on_behalf' : 'create_inquiry',
      validateState: async () => {
        const existingInquiries = (await this.prisma.opsInquiry.findMany({
          where: { normalizedEmail },
          take: 100,
          orderBy: { createdAt: 'asc' },
        })) as InquiryWithTriage[];
        const sameEmail = existingInquiries.filter((inquiry) => sameNormalizedEmail(inquiry, normalizedEmail));
        duplicate = sameEmail
          .filter((inquiry) => inquiry.status !== 'declined' && daysBetween(inquiry.eventDate, eventDate) <= 14)
          .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0];
        previousDeclined = sameEmail
          .filter((inquiry) => inquiry.status === 'declined')
          .sort((left, right) => {
            const leftDate = left.declinedAt ?? left.createdAt;
            const rightDate = right.declinedAt ?? right.createdAt;
            return rightDate.getTime() - leftDate.getTime();
          })[0];
      },
      write: () =>
        this.prisma.opsInquiry.create({
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
        }),
      sideEffects: async (inquiry) => {
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
      },
    });
  }

  private async sendConformeReminderForInquiry(inquiryId: string, actor: 'PMCM Admin' | 'System') {
    let inquiry: OpsInquiry | null = null;
    const now = new Date();

    return this.workflowCommandService.execute<OpsInquiry>({
      name: 'send_conforme_reminder',
      validateState: async () => {
        inquiry = await this.prisma.opsInquiry.findUnique({ where: { id: inquiryId } });
        if (!inquiry) throw new NotFoundException('Inquiry not found');
        if (inquiry.status !== 'accepted') {
          throw new BadRequestException('Conforme reminders only apply to accepted inquiries');
        }
        if (inquiry.conformeSignedAt) {
          throw new BadRequestException('Conforme has already been signed');
        }
      },
      write: () =>
        this.prisma.opsInquiry.update({
          where: { id: inquiryId },
          data: { lastConformeReminderAt: now },
        }),
      sideEffects: async (updated) => {
        await Promise.all([
          this.notify(undefined, updated.email, 'Reminder: signed conforme is still outstanding'),
          this.notify(undefined, updated.clientName, 'Reminder: signed conforme is still outstanding', 'viber'),
          this.audit(undefined, actor, `Sent conforme follow-up reminder to ${updated.clientName}`),
        ]);
      },
    });
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
    return this.notificationOutboxService.queue(eventId, recipient, message, channel);
  }
}
