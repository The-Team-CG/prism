import { Inject, Injectable, BadRequestException, ConflictException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import type { OpsDocument, OpsEvent, OpsInquiry, OpsInquiryMerge, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { PRISM_PRIVACY_NOTICE_VERSION, type MergeInquiryInput, type PrismAccountInvitationOutcome } from '@prism/types';
import {
  ACCOUNT_PROVISIONING,
  type AccountInvitationActor,
  type AccountProvisioningPort,
} from '@prism/contexts/identity-access/account-invitation-reference';
import {
  inquiryOrganizationKey,
  isDeterministicHighFitInquiry,
  resolveInquiryMergeBasis,
  type InquiryMatchBasis,
} from '../../domain/inquiry-triage.policy';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, OpsUserRole, PortalInvitationStatus, WorkflowCommandService } from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { claimConformeReminderWindow } from './conforme-reminder-window';

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
  message: string;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
};

export type UpdateInquiryStatusInput = {
  status: string;
  declineReason?: string;
};

/** Queue recipient for PMCM triage notifications (duplicate and high-fit inquiries). */
export const PMCM_INQUIRY_NOTIFICATION_RECIPIENT = 'pmcm-inquiry-desk';

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
  private readonly logger = new Logger(InquiriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(ACCOUNT_PROVISIONING) private readonly accountProvisioning: AccountProvisioningPort,
  ) {}

  async createInquiry(input: CreateInquiryInput) {
    if (input.source === 'Log on Behalf') {
      throw new BadRequestException('Public inquiries cannot use Log on Behalf source');
    }
    if (!input.privacyConsentAccepted) {
      throw new BadRequestException('Privacy consent is required before submitting a public inquiry');
    }

    return this.createInquiryRecord(input);
  }

  async logInquiryOnBehalf(input: CreateInquiryInput, actor: ResolvedEventOpsActor) {
    const verifiedActor = this.requireVerifiedActor(actor);
    if (verifiedActor.role !== OpsUserRole.PmcmAdmin && verifiedActor.role !== OpsUserRole.System) {
      throw new ForbiddenException('Only PMCM can log inquiries on behalf of clients');
    }

    return this.createInquiryRecord(input, verifiedActor);
  }

  async updateInquiryStatus(inquiryId: string, input: UpdateInquiryStatusInput, actor: ResolvedEventOpsActor) {
    const verifiedActor = this.requireVerifiedActor(actor);
    let current: OpsInquiry | null = null;
    let data: Prisma.OpsInquiryUpdateInput = {};
    // True only for the call that moves the inquiry into accepted, so a repeat accept announces and invites nothing new.
    let movedToAccepted = false;

    return this.workflowCommandService.execute<OpsInquiry>({
      name: 'update_inquiry_status',
      validateState: async () => {
        const found = await this.prisma.opsInquiry.findUnique({ where: { id: inquiryId }, include: { mergedInto: true } });
        if (!found) throw new NotFoundException('Inquiry not found');
        current = found;
        if (found.mergedInto) {
          throw new ConflictException('Merged inquiries are resolved through their primary inquiry');
        }
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
        // QUERY_AUDIT_RAW_SQL: lock the inquiry so concurrent status changes serialize before the transition is checked.
        await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM event_lifecycle.inquiries WHERE id = ${inquiryId} FOR UPDATE`;
        const locked = await tx.opsInquiry.findUnique({ where: { id: inquiryId } });
        if (!locked) throw new NotFoundException('Inquiry not found');
        if (input.status === 'accepted' && locked.status === 'accepted') return locked;
        if (locked.status === 'declined' && input.status !== 'declined') {
          throw new BadRequestException('Declined inquiries are permanently flagged and cannot be reopened');
        }
        movedToAccepted = input.status === 'accepted';
        const updated = await tx.opsInquiry.update({ where: { id: inquiryId }, data });
        if (tx.opsInquiryStatusHistory?.create) {
          await tx.opsInquiryStatusHistory.create({
            data: {
              id: `inq_status_${randomUUID()}`,
              inquiryId,
              eventId: (await tx.opsEvent.findFirst({ where: { inquiryId }, select: { id: true } }))?.id ?? null,
              fromStatus: current?.status ?? null,
              toStatus: input.status,
              transition: `inquiry:${current?.status ?? 'unknown'}->${input.status}`,
              actorId: verifiedActor.id,
              actorRole: verifiedActor.role,
              actorName: verifiedActor.name,
            },
          });
        }
        return updated;
      }),
      sideEffects: async (inquiry) => {
        if (input.status === 'accepted' && movedToAccepted) {
          await Promise.all([
          this.audit(undefined, verifiedActor.name, `Accepted inquiry for ${inquiry.clientName}; conforme sent`, {
            actorRole: verifiedActor.role,
            actorEmail: verifiedActor.email,
            metadata: { actorId: verifiedActor.id },
          }),
            this.notify(undefined, inquiry.email, 'Inquiry accepted; signed conforme required'),
            this.notify(undefined, inquiry.clientName, 'Conforme sent by PMCM', 'viber'),
          ]);
          // The client needs the account to read and sign the conforme, so the invitation goes out with the acceptance.
          await this.sendClientPortalInvitationAfterCommit(inquiry.id, this.invitationActorFor(verifiedActor));
        }
        if (input.status === 'pending') {
          await this.audit(undefined, verifiedActor.name, `Marked inquiry pending for ${inquiry.clientName}`, {
            actorRole: verifiedActor.role,
            actorEmail: verifiedActor.email,
            metadata: { actorId: verifiedActor.id },
          });
        }
        if (input.status === 'declined') {
          await this.audit(undefined, verifiedActor.name, `Declined inquiry for ${inquiry.clientName}: ${input.declineReason}`, {
            actorRole: verifiedActor.role,
            actorEmail: verifiedActor.email,
            metadata: { actorId: verifiedActor.id },
          });
        }
      },
    });
  }

  async sendConformeReminder(inquiryId: string, actor: ResolvedEventOpsActor) {
    return this.sendConformeReminderForInquiry(inquiryId, this.requireVerifiedActor(actor));
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
        try {
          await this.sendConformeReminderForInquiry(inquiry.id, 'System');
        } catch (error) {
          if (!(error instanceof ConflictException)) throw error;
        }
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

  /** PMCM re-sends the client's portal invitation for an accepted inquiry, whether or not the conforme is signed yet. */
  async resendClientPortalInvitation(inquiryId: string, actor: ResolvedEventOpsActor) {
    const verified = this.requireVerifiedActor(actor);
    return this.issueClientPortalInvitation(inquiryId, this.invitationActorFor(verified));
  }

  /**
   * Called after PMCM's acceptance commits. Failures are recorded on the inquiry and in the audit trail
   * instead of reaching the signer, because the signature itself has already been stored.
   */
  async sendClientPortalInvitationAfterCommit(inquiryId: string, actor: AccountInvitationActor) {
    try {
      await this.issueClientPortalInvitation(inquiryId, actor);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Client portal invitation was not issued for inquiry ${inquiryId}: ${reason}`);
      await this.prisma.opsInquiry.update({
        where: { id: inquiryId },
        data: { portalInvitationStatus: PortalInvitationStatus.NotSent, portalInvitationSentAt: null, portalInvitationOpenedAt: null, portalInvitationExpiresAt: null },
      });
      await this.audit(undefined, actor.name, 'Client portal invitation could not be issued after the inquiry was accepted', {
        actorRole: actor.role,
        actionType: AuditActionType.General,
        category: AuditCategory.Access,
        affectedType: 'inquiry',
        affectedId: inquiryId,
        severity: 'warning',
      });
    }
  }

  private async issueClientPortalInvitation(inquiryId: string, actor: AccountInvitationActor) {
    const inquiry = await this.prisma.opsInquiry.findUnique({ where: { id: inquiryId } });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    if (inquiry.status !== 'accepted') {
      throw new ConflictException('Client portal invitations are sent once PMCM has accepted the inquiry');
    }
    const outcome = await this.accountProvisioning.provision({
      email: inquiry.email,
      name: inquiry.clientName,
      role: 'client',
      organization: inquiry.companyName,
      source: 'inquiry_acceptance',
      sourceId: inquiry.id,
      actor,
    });
    const updated = await this.recordPortalInvitationOutcome(inquiryId, outcome);
    return { outcome, inquiry: updated };
  }

  /** `invited` is sent, `existing_account` means the client already signs in, and any refusal leaves the invitation not sent. */
  private recordPortalInvitationOutcome(inquiryId: string, outcome: PrismAccountInvitationOutcome) {
    const data = outcome.outcome === 'invited'
      ? { portalInvitationStatus: PortalInvitationStatus.Sent, portalInvitationSentAt: new Date(outcome.sentAt), portalInvitationOpenedAt: null, portalInvitationExpiresAt: new Date(outcome.expiresAt) }
      : outcome.outcome === 'existing_account'
        ? { portalInvitationStatus: PortalInvitationStatus.Opened, portalInvitationOpenedAt: new Date() }
        : { portalInvitationStatus: PortalInvitationStatus.NotSent, portalInvitationSentAt: null, portalInvitationOpenedAt: null, portalInvitationExpiresAt: null };
    return this.prisma.opsInquiry.update({ where: { id: inquiryId }, data });
  }

  async uploadConforme(
    inquiryId: string,
    input: { type?: string; fileName: string; mimeType?: string; sizeBytes?: number; storageObjectId?: string },
    actor: ResolvedEventOpsActor,
  ): Promise<OpsDocument> {
    let inquiry: OpsInquiry | null = null;
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
        if (inquiry.status !== 'accepted' || inquiry.conformeSignedAt) {
          throw new BadRequestException('Inquiry must be accepted before conforme upload');
        }
      },
      write: async () => {
        if (!inquiry) throw new NotFoundException('Inquiry not found');

        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          // QUERY_AUDIT_RAW_SQL: serialize legacy scanned-conforme confirmation with digital signatures and template revisions.
          await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM event_lifecycle.inquiries WHERE id = ${inquiry!.id} FOR UPDATE`;
          const lockedInquiry = await tx.opsInquiry.findUnique({ where: { id: inquiry!.id } });
          if (!lockedInquiry || lockedInquiry.status !== 'accepted' || lockedInquiry.conformeSignedAt) {
            throw new ConflictException('Inquiry state changed; refresh before confirming the conforme');
          }
          const event = await this.ensureConformeEvent(tx, lockedInquiry, Boolean(input.storageObjectId));
          if (input.storageObjectId) {
            const stored = await tx.opsStoredObject.findUnique({ where: { id: input.storageObjectId } });
            if (!stored || stored.eventId !== event.id || stored.usage !== 'signed_conforme' || stored.lifecycleState !== 'stored') {
              throw new BadRequestException('Conforme requires a confirmed stored W10 signed-conforme object');
            }
            await this.activateAfterConforme(tx, lockedInquiry.id, now);
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

  /** Shared transaction seam for verified client+PMCM in-app conforme completion. */
  async activateAfterConforme(tx: Prisma.TransactionClient, inquiryId: string, signedAt: Date) {
    const inquiry = await tx.opsInquiry.findUnique({ where: { id: inquiryId } });
    if (!inquiry || inquiry.status !== 'accepted') throw new ConflictException('Only accepted inquiries can activate an event');
    const event = await this.ensureConformeEvent(tx, inquiry, true);
    await tx.opsInquiry.update({ where: { id: inquiryId }, data: { conformeSignedAt: signedAt, portalActivatedAt: signedAt } });
    return { event, inquiry };
  }

  private async ensureConformeEvent(tx: Prisma.TransactionClient, inquiry: OpsInquiry, unlocked: boolean) {
    let event = await tx.opsEvent.findFirst({ where: { inquiryId: inquiry.id } });
    if (event?.archived) throw new ConflictException('Archived event workspaces cannot be activated');
    if (!event) {
      event = await tx.opsEvent.create({
        data: {
          id: `evt_${randomUUID()}`,
          inquiryId: inquiry.id,
          clientName: inquiry.clientName,
          eventName: inquiry.eventName,
          eventDate: inquiry.eventDate,
          status: unlocked ? 'briefing' : 'inquiry',
          clientPortalStatus: unlocked ? 'unlocked' : 'locked',
          readiness: unlocked ? 'Client briefing open' : 'Conforme storage confirmation required',
        },
      });
      await tx.opsPostEventDocument.createMany({
        data: [
          { id: `ped_${randomUUID()}`, eventId: event.id, title: 'Completion report', status: 'pending' },
          { id: `ped_${randomUUID()}`, eventId: event.id, title: 'Photo and video turnover', status: 'pending' },
        ],
      });
    } else if (unlocked && event.clientPortalStatus !== 'unlocked') {
      event = await tx.opsEvent.update({
        where: { id: event.id },
        data: {
          clientPortalStatus: 'unlocked',
          ...(event.status === 'inquiry' ? { status: 'briefing', readiness: 'Client briefing open' } : {}),
        },
      });
    }
    return event;
  }

  private async createInquiryRecord(input: CreateInquiryInput, actor?: ResolvedEventOpsActor & { id: string; verified: true }) {
    const normalizedEmail = normalizeEmail(input.email);
    const eventDate = new Date(input.eventDate);
    if (Number.isNaN(eventDate.getTime())) throw new BadRequestException('Invalid event date');

    const source = input.source ?? 'Website';
    if (source === 'Log on Behalf' && !actor) {
      throw new BadRequestException('Public inquiries cannot use Log on Behalf source');
    }

    // Organization and high-fit are derived server-side only; public payloads cannot supply them.
    const organizationKey = inquiryOrganizationKey(input.companyName);
    const highFit = isDeterministicHighFitInquiry(
      { clientType: input.clientType, companyName: input.companyName, eventDate },
      new Date(),
    );
    let duplicate: InquiryWithTriage | undefined;
    let previousDeclined: InquiryWithTriage | undefined;

    return this.workflowCommandService.execute<OpsInquiry>({
      name: actor ? 'log_inquiry_on_behalf' : 'create_inquiry',
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
            organizationKey,
            eventName: input.eventName,
            eventType: input.eventType ?? input.clientType,
            eventDate,
            clientType: input.clientType,
            source,
            channel: input.channel ?? null,
            referralDetails: input.referralDetails ?? '',
            loggedByRole: actor?.role ?? null,
            loggedByName: actor?.name ?? null,
            duplicateOfInquiryId: duplicate?.id ?? null,
            previousDeclinedInquiryId: previousDeclined?.id ?? null,
            previousDeclineReason: previousDeclined?.declineReason ?? null,
            message: input.message,
            privacyConsentAccepted: input.privacyConsentAccepted === true,
            privacyNoticeVersion: input.privacyNoticeVersion ?? PRISM_PRIVACY_NOTICE_VERSION,
            marketingConsentAccepted: Boolean(input.marketingConsentAccepted),
            status: 'new',
          },
        }),
      sideEffects: async (inquiry) => {
        const auditActor = actor ?? { name: 'System', role: OpsUserRole.System };
        await Promise.all([
          this.audit(undefined, auditActor.name, duplicate ? 'Created duplicate inquiry' : 'Created new inquiry', {
            actorRole: auditActor.role,
            actorEmail: actor?.email,
            actionType: AuditActionType.Create,
            category: AuditCategory.Events,
            affectedType: 'inquiry',
            affectedId: inquiry.id,
            affectedLabel: inquiry.eventName,
            metadata: {
              duplicateOfInquiryId: duplicate?.id ?? null,
              previousDeclinedInquiryId: previousDeclined?.id ?? null,
              source,
              actorId: actor?.id ?? null,
            },
          }),
          this.notify(undefined, inquiry.email, 'Inquiry received'),
          ...(duplicate
            ? [this.notifyPmcmTriage(inquiry.id, 'duplicate', `Possible duplicate inquiry from ${inquiry.clientName} for ${inquiry.eventName}; matches ${duplicate.id}`)]
            : []),
          ...(highFit
            ? [this.notifyPmcmTriage(inquiry.id, 'high-fit', `High-fit inquiry from ${inquiry.clientName} (${inquiry.companyName}) for ${inquiry.eventName}`)]
            : []),
        ]);
      },
    });
  }

  /** PMCM-only organization merge. The source inquiry is folded into the primary and the merge is recorded with audit. */
  async mergeInquiry(primaryInquiryId: string, input: MergeInquiryInput, actor: ResolvedEventOpsActor) {
    const verifiedActor = this.requireVerifiedActor(actor);
    if (verifiedActor.role !== OpsUserRole.PmcmAdmin && verifiedActor.role !== OpsUserRole.System) {
      throw new ForbiddenException('Only PMCM can merge inquiries');
    }
    if (input.sourceInquiryId === primaryInquiryId) {
      throw new BadRequestException('An inquiry cannot be merged into itself');
    }

    let matchBasis: InquiryMatchBasis | null = null;
    let sourceName = '';
    return this.workflowCommandService.execute<OpsInquiryMerge>({
      name: 'merge_inquiry',
      validateState: async () => {
        const [source, primary] = await Promise.all([
          this.prisma.opsInquiry.findUnique({ where: { id: input.sourceInquiryId }, include: { mergedInto: true } }),
          this.prisma.opsInquiry.findUnique({ where: { id: primaryInquiryId }, include: { mergedInto: true } }),
        ]);
        if (!source || !primary) throw new NotFoundException('Inquiry not found');
        if (source.mergedInto || primary.mergedInto) {
          throw new ConflictException('Merged inquiries cannot be merged again');
        }
        if (source.status === 'accepted') {
          throw new ConflictException('Accepted inquiries cannot be merged; resolve the conforme on the primary inquiry');
        }
        matchBasis = resolveInquiryMergeBasis(
          { organizationKey: source.organizationKey, normalizedEmail: source.normalizedEmail },
          { organizationKey: primary.organizationKey, normalizedEmail: primary.normalizedEmail },
        );
        if (!matchBasis) {
          throw new BadRequestException('Inquiries can only be merged when they share an organization or contact email');
        }
        sourceName = source.clientName;
      },
      write: () => this.prisma.$transaction(async (tx) => {
        const [lowId, highId] = [input.sourceInquiryId, primaryInquiryId].sort();
        // QUERY_AUDIT_RAW_SQL: row locks in id order so concurrent merges serialize; the unique merged_inquiry_id guards double merges.
        await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM event_lifecycle.inquiries WHERE id IN (${lowId}, ${highId}) ORDER BY id FOR UPDATE`;
        const [source, primary] = await Promise.all([
          tx.opsInquiry.findUnique({ where: { id: input.sourceInquiryId }, include: { mergedInto: true } }),
          tx.opsInquiry.findUnique({ where: { id: primaryInquiryId }, include: { mergedInto: true } }),
        ]);
        if (!source || !primary) throw new NotFoundException('Inquiry not found');
        if (source.mergedInto || primary.mergedInto || source.status === 'accepted') {
          throw new ConflictException('Inquiry state changed; refresh before merging');
        }
        try {
          return await tx.opsInquiryMerge.create({
            data: {
              id: `inq_merge_${randomUUID()}`,
              primaryInquiryId,
              mergedInquiryId: input.sourceInquiryId,
              organizationKey: primary.organizationKey,
              matchBasis: matchBasis!,
              reason: input.reason,
              actorId: verifiedActor.id,
              actorRole: verifiedActor.role,
              actorName: verifiedActor.name,
            },
          });
        } catch (error) {
          if ((error as { code?: string }).code === 'P2002') {
            throw new ConflictException('Inquiry state changed; refresh before merging');
          }
          throw error;
        }
      }),
      sideEffects: async (merge) => {
        await this.audit(undefined, verifiedActor.name, `Merged inquiry from ${sourceName} into ${primaryInquiryId} (${merge.matchBasis})`, {
          actorRole: verifiedActor.role,
          actorEmail: verifiedActor.email,
          actionType: AuditActionType.Update,
          category: AuditCategory.Events,
          affectedType: 'inquiry',
          affectedId: input.sourceInquiryId,
          metadata: {
            actorId: verifiedActor.id,
            primaryInquiryId,
            matchBasis: merge.matchBasis,
            reason: input.reason,
          },
        });
      },
      project: (merge) => merge,
    });
  }

  private async sendConformeReminderForInquiry(
    inquiryId: string,
    actor: (ResolvedEventOpsActor & { id: string; verified: true }) | 'System',
  ) {
    let inquiry: OpsInquiry | null = null;
    let expectedLastReminderAt: Date | null = null;
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
        if (!inquiry.conformeSentAt) {
          throw new BadRequestException('Conforme must be sent before a follow-up reminder');
        }
        expectedLastReminderAt = inquiry.lastConformeReminderAt;
        if (actor === 'System') {
          const reminderBase = expectedLastReminderAt ?? inquiry.conformeSentAt;
          if (addDays(reminderBase, inquiry.followUpIntervalDays) > now) {
            throw new ConflictException('The conforme reminder window is not due');
          }
        }
      },
      write: async () => {
        if (!inquiry?.conformeSentAt) throw new NotFoundException('Inquiry not found');
        const claimed = await this.prisma.$transaction((tx) => claimConformeReminderWindow(
          tx,
          this.notificationOutboxWriter,
          {
            inquiryId,
            conformeSentAt: inquiry!.conformeSentAt!,
            expectedLastReminderAt,
            now,
            messages: [
              { recipient: inquiry!.email, message: 'Reminder: signed conforme is still outstanding', channel: 'email' },
              { recipient: inquiry!.clientName, message: 'Reminder: signed conforme is still outstanding', channel: 'viber' },
            ],
          },
        ));
        return claimed.inquiry;
      },
      sideEffects: async (updated) => {
        const actorName = actor === 'System' ? actor : actor.name;
        const actorRole = actor === 'System' ? OpsUserRole.System : actor.role;
        const actorEmail = actor === 'System' ? undefined : actor.email;
        const actorId = actor === 'System' ? null : actor.id;
        await this.audit(undefined, actorName, `Queued conforme follow-up reminder for ${updated.clientName}`, {
          actorRole,
          actorEmail,
          actionType: AuditActionType.Create,
          category: AuditCategory.Events,
          affectedType: 'inquiry',
          affectedId: inquiryId,
          metadata: {
            actorId,
            reminderWindowAt: expectedLastReminderAt?.toISOString() ?? inquiry?.conformeSentAt?.toISOString(),
          },
        });
      },
    });
  }

  /** The person who caused the invitation, so the audit trail names them rather than a generic system actor. */
  private invitationActorFor(actor: ResolvedEventOpsActor): AccountInvitationActor {
    const verified = this.requireVerifiedActor(actor);
    return { id: verified.id, name: verified.name, role: verified.role };
  }

  private requireVerifiedActor(actor: ResolvedEventOpsActor | undefined): ResolvedEventOpsActor & { id: string; verified: true } {
    if (!actor) {
      throw new ForbiddenException('A verified actor is required for this inquiry action');
    }
    const id = actor.id?.trim();
    const name = actor.name?.trim();
    if (actor.verified !== true || !id || !name) {
      throw new ForbiddenException('A verified actor is required for this inquiry action');
    }
    return { ...actor, id, name, verified: true };
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

  private notifyPmcmTriage(inquiryId: string, kind: 'duplicate' | 'high-fit', message: string) {
    return writeNotification(
      this.notificationOutboxWriter,
      undefined,
      PMCM_INQUIRY_NOTIFICATION_RECIPIENT,
      message,
      'email',
      { idempotencyKey: `inquiry-triage:${inquiryId}:${kind}` },
    );
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
