import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { OpsEvent, OpsGuestCheckIn, OpsGuestFeedback, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { DOCUMENT_VAULT, type DocumentVault } from '@prism/contexts/event-lifecycle';
import type {
  CreateGuestFeedbackInput,
  ImportGuestRosterInput,
  ModerateGuestFeedbackInput,
  UploadMetadataInput,
  WithdrawGuestFeedbackConsentInput,
} from '@prism/types';

export type EventWithDrafts = OpsEvent & { floorPlanDrafts?: unknown[]; walkInPolicy?: string | null; walkInThreshold?: number | null };
type GuestRosterEntry = { id: string; eventId: string; sourceKey: string; guestName: string; eligibility: string; email: string; phone: string };
type GuestRosterDelegate = { findFirst(args: { where: Record<string, unknown> }): Promise<GuestRosterEntry | null>; findMany(args: { where: Record<string, unknown>; orderBy?: Record<string, string> }): Promise<GuestRosterEntry[]>; upsert(args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<GuestRosterEntry>; updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown> };
type GuestRosterPrisma = { opsGuestRosterEntry: GuestRosterDelegate };

export type GuestCheckInInput = {
  guestName: string;
  rosterEntryId?: string;
  checkInMode?: string;
  walkIn?: boolean;
  verificationStatus?: string;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
};

export type GuestFeedbackInput = CreateGuestFeedbackInput;

export type GuestFeedbackModerator = { id?: string; name: string; email?: string; role: string };

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const GUEST_UPLOAD_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'video/mp4'] as const;

@Injectable()
export class GuestWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(DOCUMENT_VAULT) private readonly documentVault: DocumentVault,
  ) {}

  async getEventByAccessCode(accessCode: string) {
    return this.resolveGuestEventByAccessCode(accessCode);
  }

  countCheckInsForEvent(eventId: string) {
    return this.prisma.opsGuestCheckIn.count({ where: { eventId } });
  }

  listCheckInsForEvent(eventId: string) {
    return this.prisma.opsGuestCheckIn.findMany({ where: { eventId }, orderBy: { checkedInAt: 'desc' } });
  }

  listCheckInsForEvents(eventIds: string[]) {
    if (eventIds.length === 0) return Promise.resolve([]);
    return this.prisma.opsGuestCheckIn.findMany({
      where: { eventId: { in: eventIds } },
      orderBy: { checkedInAt: 'desc' },
    });
  }

  listFeedbackForEvent(eventId: string) {
    return this.prisma.opsGuestFeedback.findMany({ where: { eventId }, orderBy: { submittedAt: 'desc' } });
  }

  listFeedbackForEvents(eventIds: string[]) {
    if (eventIds.length === 0) return Promise.resolve([]);
    return this.prisma.opsGuestFeedback.findMany({
      where: { eventId: { in: eventIds } },
      orderBy: { submittedAt: 'desc' },
    });
  }

  listPendingFeedbackForEvent(eventId: string) {
    return this.prisma.opsGuestFeedback.findMany({
      where: { eventId, moderationStatus: 'pending_review' },
      orderBy: { submittedAt: 'asc' },
    });
  }

  listPublishableFeedbackForEvent(eventId: string, purpose: 'marketing' | 'insight' = 'marketing') {
    return this.prisma.opsGuestFeedback.findMany({
      where: {
        eventId,
        moderationStatus: 'approved',
        privacyConsentAccepted: true,
        ...(purpose === 'marketing' ? { marketingConsentAccepted: true } : {}),
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async checkInByAccessCode(accessCode: string, input: GuestCheckInInput): Promise<OpsGuestCheckIn> {
    let event: EventWithDrafts | null = null;
    let guestName = '';
    let checkInMode = 'name_search';

    return this.workflowCommandService.execute<OpsGuestCheckIn>({
      name: 'guest_check_in',
      validateState: async () => {
        event = await this.resolveGuestEventByAccessCode(accessCode);
        const rosterDelegate = (this.prisma as unknown as Partial<GuestRosterPrisma>).opsGuestRosterEntry;
        const rosterConfigured = rosterDelegate ? await rosterDelegate.findFirst({ where: { eventId: event.id, withdrawnAt: null } }) : null;
        if (rosterConfigured && !input.rosterEntryId) throw new BadRequestException('Select an eligible roster entry for check-in');
        if (input.rosterEntryId) {
          const roster = rosterDelegate ? await rosterDelegate.findFirst({ where: { id: input.rosterEntryId, eventId: event.id, withdrawnAt: null } }) : null;
          if (!roster || roster.eligibility !== 'eligible') throw new BadRequestException('Roster entry is not eligible for check-in');
          guestName = roster.guestName;
        }
        if (!input.rosterEntryId) guestName = input.guestName?.trim();
        if (!guestName) throw new BadRequestException('Guest name is required');
        if (!input.privacyConsentAccepted) {
          throw new BadRequestException('Privacy consent is required before guest check-in');
        }
        checkInMode = input.checkInMode ?? (input.walkIn ? 'walk_in' : 'name_search');
        if (input.walkIn && (!event.walkInPolicy || event.walkInPolicy === 'closed')) throw new BadRequestException('Walk-in registration is closed for this event');
      },
      write: async () => {
        if (!event) throw new NotFoundException('Guest event code was not found');
        if (input.rosterEntryId) {
          const existingRosterCheckIn = await this.prisma.opsGuestCheckIn.findFirst({ where: { eventId: event.id, guestName, status: 'checked_in' } });
          if (existingRosterCheckIn) return existingRosterCheckIn;
        }
        return this.prisma.opsGuestCheckIn.create({
          data: {
            id: `gci_${randomUUID()}`,
            eventId: event.id,
            guestName,
            checkInMode,
            status: 'checked_in',
            walkIn: Boolean(input.walkIn),
            verificationStatus: input.verificationStatus ?? (input.walkIn ? 'flagged' : 'verified'),
            privacyConsentAccepted: true,
            privacyNoticeVersion: input.privacyNoticeVersion ?? '2026-05-01',
            marketingConsentAccepted: Boolean(input.marketingConsentAccepted),
          },
        });
      },
      sideEffects: async (checkIn) => {
        if (!event) return;
        await writeAudit(this.auditWriter, event.id, guestName, `Guest checked in: ${guestName}`, {
          actorRole: OpsUserRole.Guest,
          category: AuditCategory.Events,
          actionType: AuditActionType.Update,
          affectedType: 'guest_check_in',
          affectedId: checkIn.id,
          affectedLabel: guestName,
          metadata: { walkIn: Boolean(input.walkIn), checkInMode },
        });
      },
    });
  }

  async submitFeedbackByAccessCode(accessCode: string, input: GuestFeedbackInput): Promise<OpsGuestFeedback> {
    let event: EventWithDrafts | null = null;
    let guestName = '';

    return this.workflowCommandService.execute<OpsGuestFeedback>({
      name: 'guest_feedback',
      sideEffectMode: 'same_tx',
      context: { actorId: 'guest', actorRole: OpsUserRole.Guest, correlationId: `guest_feedback_${randomUUID()}` },
      validateState: async () => {
        event = await this.resolveGuestEventByAccessCode(accessCode, true);
        guestName = input.guestName?.trim();
        if (!guestName) throw new BadRequestException('Guest name is required');
        if (!input.privacyConsentAccepted) {
          throw new BadRequestException('Privacy consent is required before guest feedback submission');
        }
        if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
          throw new BadRequestException('Rating must be between 1 and 5');
        }
        this.assertFeedbackWindow(event);

        const prefix = `events/${event.id}/guest-feedback`;
        if (input.photo) this.validateUploadMetadata(input.photo, prefix);
        if (input.video) this.validateUploadMetadata(input.video, prefix);
      },
      validateStateInTransaction: async ({ prisma: tx }) => {
        if (!event) throw new NotFoundException('Guest event code was not found');
        const currentEvent = await tx.opsEvent.findUnique({ where: { id: event.id }, select: { actualEndedAt: true, eventDate: true } });
        if (!currentEvent) throw new NotFoundException('Guest event code was not found');
        this.assertFeedbackWindow(currentEvent);
      },
      write: (transactionContext) => {
        if (!event) throw new NotFoundException('Guest event code was not found');
        const db = transactionContext?.prisma ?? this.prisma;
        const feedbackId = `gfb_${randomUUID()}`;
        const mediaAttachments: Prisma.OpsGuestFeedbackMediaCreateWithoutFeedbackInput[] = [];
        if (input.photo) mediaAttachments.push({ id: `gfm_${randomUUID()}`, kind: 'photo', originalFileName: input.photo.fileName, mimeType: input.photo.mimeType ?? '', sizeBytes: input.photo.sizeBytes ?? 0, status: 'pending_storage', blocker: 'W10 object storage provider and credentials are not available' });
        if (input.video) mediaAttachments.push({ id: `gfm_${randomUUID()}`, kind: 'video', originalFileName: input.video.fileName, mimeType: input.video.mimeType ?? '', sizeBytes: input.video.sizeBytes ?? 0, status: 'pending_storage', blocker: 'W10 object storage provider and credentials are not available' });
        return db.opsGuestFeedback.create({
          data: {
            id: feedbackId,
            eventId: event.id,
            guestName,
            rating: input.rating,
            comment: input.comment?.trim() ?? '',
            // Binary bytes are not stored until W10 supplies an approved object-storage adapter.
            photoFileName: null,
            videoFileName: null,
            privacyConsentAccepted: true,
            privacyNoticeVersion: input.privacyNoticeVersion ?? '2026-05-01',
            marketingConsentAccepted: Boolean(input.marketingConsentAccepted),
            moderationStatus: 'pending_review',
            ...(mediaAttachments.length > 0 ? { mediaAttachments: { create: mediaAttachments } } : {}),
          },
        });
      },
      sideEffects: async (feedback) => {
        if (!event) return;
        await writeAudit(this.auditWriter, event.id, guestName, `Guest feedback submitted: ${guestName}`, {
          actorRole: OpsUserRole.Guest,
          category: AuditCategory.Events,
          actionType: AuditActionType.Create,
          affectedType: 'guest_feedback',
          affectedId: feedback.id,
          affectedLabel: guestName,
          metadata: { rating: input.rating, moderationStatus: 'pending_review' },
        });
      },
    });
  }

  async importRoster(eventId: string, input: ImportGuestRosterInput, actor: { id?: string; name: string; role: string }) {
    const batchId = `roster_${randomUUID()}`;
      return this.prisma.$transaction(async (tx) => {
      const event = await tx.opsEvent.findUnique({ where: { id: eventId } });
      if (!event) throw new NotFoundException('Event not found');
      const keys = input.rows.map((row) => row.sourceKey);
      const rows = [];
      for (const row of input.rows) {
        rows.push(await (tx as unknown as GuestRosterPrisma).opsGuestRosterEntry.upsert({
          where: { eventId_sourceKey: { eventId, sourceKey: row.sourceKey } },
          create: { id: `gre_${randomUUID()}`, eventId, sourceKey: row.sourceKey, guestName: row.guestName.trim(), normalizedName: row.guestName.trim().toLowerCase(), email: row.email ?? '', phone: row.phone ?? '', eligibility: row.eligibility ?? 'eligible', source: input.source, importBatchId: batchId, withdrawnAt: null },
          update: { guestName: row.guestName.trim(), normalizedName: row.guestName.trim().toLowerCase(), email: row.email ?? '', phone: row.phone ?? '', eligibility: row.eligibility ?? 'eligible', source: input.source, importBatchId: batchId, withdrawnAt: null },
        }));
      }
      await (tx as unknown as GuestRosterPrisma).opsGuestRosterEntry.updateMany({ where: { eventId, source: input.source, sourceKey: { notIn: keys }, withdrawnAt: null }, data: { withdrawnAt: new Date() } });
      await writeAudit(this.auditWriter, eventId, actor.name, 'Guest roster imported and reconciled', { actorRole: actor.role, category: AuditCategory.Events, actionType: AuditActionType.Update, affectedType: 'guest_roster', affectedId: eventId, metadata: { batchId, rowCount: rows.length, source: input.source, actorId: actor.id } }, { prisma: tx, correlationId: batchId });
      return rows;
    });
  }

  async searchRoster(eventId: string, query = '') {
    return (this.prisma as unknown as GuestRosterPrisma).opsGuestRosterEntry.findMany({ where: { eventId, withdrawnAt: null, eligibility: 'eligible', ...(query.trim() ? { normalizedName: { contains: query.trim().toLowerCase() } } : {}) }, orderBy: { normalizedName: 'asc' } });
  }

  async checkInRosterEntry(eventId: string, rosterEntryId: string, actor: { id?: string; name: string; role: string }) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.opsEvent.findFirst({ where: { id: eventId, archived: false } });
      if (!event) throw new NotFoundException('Event not found or archived');
      const roster = await (tx as unknown as GuestRosterPrisma).opsGuestRosterEntry.findFirst({
        where: { id: rosterEntryId, eventId, withdrawnAt: null, eligibility: 'eligible' },
      });
      if (!roster) throw new BadRequestException('Roster entry is not eligible for check-in');
      const existing = await tx.opsGuestCheckIn.findFirst({
        where: { eventId, guestName: roster.guestName, status: 'checked_in' },
      });
      if (existing) return existing;
      const checkIn = await tx.opsGuestCheckIn.create({
        data: {
          id: `gci_${randomUUID()}`,
          eventId,
          guestName: roster.guestName,
          checkInMode: 'roster',
          status: 'checked_in',
          walkIn: false,
          verificationStatus: 'verified',
          privacyConsentAccepted: true,
          privacyNoticeVersion: '2026-05-01',
          marketingConsentAccepted: false,
        },
      });
      await writeAudit(this.auditWriter, eventId, actor.name, `Roster guest checked in: ${roster.guestName}`, {
        actorRole: actor.role,
        category: AuditCategory.Events,
        actionType: AuditActionType.Update,
        affectedType: 'guest_check_in',
        affectedId: checkIn.id,
        affectedLabel: roster.guestName,
        metadata: { rosterEntryId, checkInMode: 'roster', actorId: actor.id },
      }, { prisma: tx, correlationId: `roster_checkin_${rosterEntryId}` });
      return checkIn;
    });
  }

  async withdrawFeedbackConsentByAccessCode(accessCode: string, feedbackId: string, input: WithdrawGuestFeedbackConsentInput) {
    const event = await this.resolveGuestEventByAccessCode(accessCode, true);
    this.assertFeedbackWindow(event);
    return this.prisma.$transaction(async (tx) => {
      const currentEvent = await tx.opsEvent.findUnique({ where: { id: event.id }, select: { actualEndedAt: true, eventDate: true } });
      if (!currentEvent) throw new NotFoundException('Guest event code was not found');
      this.assertFeedbackWindow(currentEvent);
      const feedback = await tx.opsGuestFeedback.findFirst({ where: { id: feedbackId, eventId: event.id } });
      if (!feedback) throw new NotFoundException('Feedback record was not found');
      const now = new Date();
      const updated = await tx.opsGuestFeedback.update({
        where: { id: feedbackId },
        data: {
          ...(input.withdrawPrivacyConsent ? { privacyConsentAccepted: false, privacyConsentWithdrawnAt: now } : {}),
          ...(input.withdrawMarketingConsent ? { marketingConsentAccepted: false, marketingConsentWithdrawnAt: now } : {}),
        },
      });
      await writeAudit(this.auditWriter, event.id, feedback.guestName, 'Guest feedback consent withdrawn', {
        actorRole: OpsUserRole.Guest,
        category: AuditCategory.Events,
        actionType: AuditActionType.Update,
        affectedType: 'guest_feedback_consent',
        affectedId: feedbackId,
        affectedLabel: feedback.guestName,
        metadata: { withdrawPrivacyConsent: Boolean(input.withdrawPrivacyConsent), withdrawMarketingConsent: Boolean(input.withdrawMarketingConsent) },
      }, { prisma: tx, correlationId: `feedback_consent_${feedbackId}` });
      return updated;
    });
  }

  async moderateFeedback(eventId: string, feedbackId: string, input: ModerateGuestFeedbackInput, actor: GuestFeedbackModerator) {
    if (input.action !== 'approve' && !input.reason?.trim()) {
      throw new BadRequestException('A reason is required for rejected or hidden feedback');
    }
    return this.prisma.$transaction(async (tx) => {
      const feedback = await tx.opsGuestFeedback.findFirst({ where: { id: feedbackId, eventId } });
      if (!feedback) throw new NotFoundException('Feedback record was not found');
      const updated = await tx.opsGuestFeedback.update({
        where: { id: feedbackId },
        data: {
          moderationStatus: input.action === 'approve' ? 'approved' : input.action === 'reject' ? 'rejected' : 'hidden',
          moderationReason: input.reason?.trim() || null,
          moderatedById: actor.id ?? null,
          moderatedBy: actor.name,
          moderatedAt: new Date(),
        },
      });
      const actionLabel = input.action === 'approve' ? 'approved' : input.action === 'reject' ? 'rejected' : 'hidden';
      await writeAudit(this.auditWriter, eventId, actor.name, `Guest feedback ${actionLabel}`, {
        actorEmail: actor.email,
        actorRole: actor.role,
        category: AuditCategory.Events,
        actionType: input.action === 'approve' ? AuditActionType.Approve : AuditActionType.Decline,
        affectedType: 'guest_feedback',
        affectedId: feedbackId,
        affectedLabel: feedback.guestName,
        metadata: { actorId: actor.id, moderationStatus: updated.moderationStatus, reason: input.reason?.trim() || null },
      }, { prisma: tx, correlationId: `feedback_moderation_${feedbackId}` });
      return updated;
    });
  }

  private async resolveGuestEventByAccessCode(accessCode: string, feedbackPath = false) {
    const normalizedCode = this.normalizeGuestAccessCode(accessCode);
    const events = await this.prisma.opsEvent.findMany({
      where: feedbackPath ? {} : { archived: false },
      include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
      orderBy: { eventDate: 'asc' },
    });
    const event = events.find((item) => this.guestAccessCode(item) === normalizedCode);
    if (!event) throw new NotFoundException('Guest event code was not found');
    return event;
  }

  private isFeedbackWindowOpen(event: { actualEndedAt?: Date | null; eventDate: Date }): boolean {
    if (!event.actualEndedAt) return false;
    const windowEnd = event.actualEndedAt.getTime() + 7 * 24 * 60 * 60 * 1000;
    return Date.now() <= windowEnd;
  }

  private assertFeedbackWindow(event: { actualEndedAt?: Date | null; eventDate: Date }): void {
    if (!event.actualEndedAt) throw new BadRequestException('Guest feedback is unavailable because the actual event end has not been recorded');
    const now = Date.now();
    if (now < event.actualEndedAt.getTime()) throw new BadRequestException('Guest feedback opens after the event has actually ended');
    if (now > event.actualEndedAt.getTime() + 7 * 24 * 60 * 60 * 1000) throw new BadRequestException('The seven-day guest feedback window has closed');
  }

  guestAccessCode(event: Pick<OpsEvent, 'id' | 'eventName'>) {
    const namePart =
      event.eventName
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .split('-')
        .filter(Boolean)
        .slice(0, 2)
        .join('-') || 'PRISM';
    const idPart = event.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'EVNT';
    return `${namePart}-${idPart}`;
  }

  private normalizeGuestAccessCode(accessCode: string) {
    return accessCode.trim().toUpperCase().replace(/\s+/g, '-');
  }

  mapGuestEvent(event: EventWithDrafts, attendanceCount = 0) {
    const floorPlanDrafts = event.floorPlanDrafts ?? [];
    const activeDraft =
      floorPlanDrafts.find((draft: any) => draft.isActive) ??
      floorPlanDrafts.find((draft: any) => draft.floorPlanId === event.floorPlanId);

    return {
      id: event.id,
      eventName: event.eventName,
      eventDate: event.eventDate.toISOString().slice(0, 10),
      clientName: event.clientName,
      readiness: event.readiness,
      floorPlanStatus: event.floorPlanStatus,
      activeFloorPlanDraftId: (activeDraft as any)?.id,
      guestAccessCode: this.guestAccessCode(event),
      attendanceCount,
    };
  }

  mapGuestCheckIn(checkIn: OpsGuestCheckIn) {
    return {
      id: checkIn.id,
      eventId: checkIn.eventId,
      guestName: checkIn.guestName,
      checkInMode: checkIn.checkInMode,
      status: checkIn.status,
      walkIn: checkIn.walkIn,
      verificationStatus: checkIn.verificationStatus,
      privacyConsentAccepted: (checkIn as any).privacyConsentAccepted ?? false,
      privacyNoticeVersion: (checkIn as any).privacyNoticeVersion ?? '',
      marketingConsentAccepted: (checkIn as any).marketingConsentAccepted ?? false,
      checkedInAt: checkIn.checkedInAt.toISOString(),
    };
  }

  mapGuestFeedback(feedback: OpsGuestFeedback) {
    return {
      id: feedback.id,
      eventId: feedback.eventId,
      guestName: feedback.guestName,
      rating: feedback.rating,
      comment: feedback.comment,
      photoFileName: feedback.photoFileName ?? null,
      videoFileName: feedback.videoFileName ?? null,
      privacyConsentAccepted: (feedback as any).privacyConsentAccepted ?? false,
      privacyNoticeVersion: (feedback as any).privacyNoticeVersion ?? '',
      marketingConsentAccepted: (feedback as any).marketingConsentAccepted ?? false,
      moderationStatus: feedback.moderationStatus,
      moderationReason: (feedback as any).moderationReason ?? null,
      moderatedById: (feedback as any).moderatedById ?? null,
      moderatedBy: (feedback as any).moderatedBy ?? null,
      moderatedAt: (feedback as any).moderatedAt?.toISOString?.() ?? null,
      privacyConsentWithdrawnAt: (feedback as any).privacyConsentWithdrawnAt?.toISOString?.() ?? null,
      marketingConsentWithdrawnAt: (feedback as any).marketingConsentWithdrawnAt?.toISOString?.() ?? null,
      mediaAttachments: ((feedback as any).mediaAttachments ?? []).map((media: any) => ({
        id: media.id,
        kind: media.kind,
        originalFileName: media.originalFileName,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        status: media.status,
        blocker: media.blocker,
      })),
      submittedAt: feedback.submittedAt.toISOString(),
    };
  }

  private validateUploadMetadata(input: UploadMetadataInput, prefix: string) {
    return this.documentVault.validateUploadMetadata(input, prefix, {
      maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
      allowedMimeTypes: GUEST_UPLOAD_MIME_TYPES,
    });
  }
}
