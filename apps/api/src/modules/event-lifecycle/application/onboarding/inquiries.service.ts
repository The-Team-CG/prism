import { Inject, Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { OpsDocument, OpsEvent, OpsInquiry, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import type { PrismEventOpsActorContext } from '@prism/types';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';

export type CreateInquiryInput = {
  clientName: string;
  companyName?: string;
  email: string;
  eventName: string;
  eventType?: string;
  eventDate: string;
  clientType: string;
  source?: string;
  channel?: string;
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
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
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
        loggedByRole: role,
        loggedByName: actorInput.actorName ?? actorInput.name ?? actorInput.actorEmail ?? actorInput.email ?? 'PMCM Admin',
      },
      true,
    );
  }

  async updateInquiryStatus(inquiryId: string, input: UpdateInquiryStatusInput, actor?: ResolvedEventOpsActor) {
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
      write: () => this.prisma.$transaction(async (tx) => {
        const updated = await tx.opsInquiry.update({ where: { id: inquiryId }, data });
        await tx.opsInquiryStatusHistory.create({
          data: {
            id: `inq_status_${randomUUID()}`,
            inquiryId,
            eventId: (await tx.opsEvent.findFirst({ where: { inquiryId }, select: { id: true } }))?.id ?? null,
            fromStatus: current?.status ?? null,
            toStatus: input.status,
            transition: `inquiry:${current?.status ?? 'unknown'}->${input.status}`,
            actorId: actor?.id ?? null,
            actorRole: actor?.role ?? OpsUserRole.System,
            actorName: actor?.name ?? 'System',
          },
        });
        return updated;
      }),
      sideEffects: async (inquiry) => {
        if (input.status === 'accepted') {
          await Promise.all([
          this.audit(undefined, actor?.name ?? 'PMCM Admin', `Accepted inquiry for ${inquiry.clientName}; conforme sent`),
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
    input: { type?: string; fileName: string; mimeType?: string; sizeBytes?: number; storageObjectId?: string },
    actor: ResolvedEventOpsActor,
  ): Promise<OpsDocument> {
    let inquiry: OpsInquiry | null = null;
    let existingEvent: OpsEvent | null = null;
    const now = new Date();

    return this.workflowCommandService.execute<
      { document: OpsDocument; event: OpsEvent },
      OpsDocument
    >({
      name: 'upload_conforme',
      validateState: async () => {
        if (input.type && input.type !== 'signed_conforme') {
          throw new BadRequestException('Conforme upload must be a signed conforme document');
        }
        inquiry = await this.prisma.opsInquiry.findUnique({ where: { id: inquiryId } });
        if (!inquiry) throw new NotFoundException('Inquiry not found');
        if (inquiry.status !== 'accepted') {
          throw new BadRequestException('Inquiry must be accepted before conforme upload');
        }

        existingEvent = await this.prisma.opsEvent.findFirst({ where: { inquiryId } });
        if (input.storageObjectId) {
          const stored = await this.prisma.opsStoredObject.findUnique({ where: { id: input.storageObjectId } });
          if (!stored || stored.eventId !== existingEvent?.id || stored.usage !== 'signed_conforme' || stored.lifecycleState !== 'stored') {
            throw new BadRequestException('Conforme requires a confirmed stored W10 signed-conforme object');
          }
        }
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
                clientPortalStatus: input.storageObjectId ? 'unlocked' : 'locked',
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
              status: input.storageObjectId ? 'approved' : 'pending',
              mimeType: input.mimeType ?? null,
              sizeBytes: input.sizeBytes ?? null,
              uploadedByRole: 'client',
            },
          });

          await tx.opsEvent.update({
            where: { id: event.id },
            data: {
              clientPortalStatus: input.storageObjectId ? 'unlocked' : 'locked',
              readiness: input.storageObjectId ? 'Client briefing open' : 'Conforme storage confirmation required',
              status: input.storageObjectId ? 'briefing' : 'inquiry',
            },
          });

          await tx.opsInquiry.update({
            where: { id: inquiry!.id },
            data: {
              ...(input.storageObjectId ? {
                conformeSignedAt: now,
                portalActivatedAt: now,
                portalInvitationStatus: 'sent',
                portalInvitationSentAt: now,
                portalInvitationExpiresAt: addDays(now, 7),
              } : {}),
            },
          });

          return { document, event };
        });
      },
      sideEffects: async ({ document, event }) => {
        const sideEffects: Array<Promise<unknown>> = [
          this.audit(event.id, actor.name, input.storageObjectId ? 'Confirmed stored signed conforme and unlocked client portal' : 'Recorded conforme metadata pending W10 storage confirmation', {
            actorRole: actor.role,
            actorEmail: actor.email,
            category: AuditCategory.Documents,
            actionType: AuditActionType.Upload,
            affectedType: 'document',
            affectedId: document.id,
            affectedLabel: document.fileName,
          }),
          ...(input.storageObjectId ? [this.notify(event.id, event.clientName, 'Client portal unlocked')] : []),
        ];

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
            channel: input.channel ?? null,
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
    return writeAudit(this.auditWriter, eventId, actor, action, options);
  }

  private notify(
    eventId: string | undefined,
    recipient: string,
    message: string,
    channel: 'email' | 'viber' = 'email',
  ) {
    return writeNotification(this.notificationOutboxWriter, eventId, recipient, message, channel);
  }
}
