import { Inject, Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { OpsEvent, OpsGuestCheckIn, OpsGuestFeedback, OpsGuestRosterEntry, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, CoordinatorAssignmentStatus, INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES, OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { DOCUMENT_VAULT, type DocumentVault } from '@prism/contexts/event-lifecycle';
import { STAFFING_READER } from '../../contracts/staffing-ops.tokens';
import type { StaffingReader } from '../../contracts/staffing-reader.port';
import type {
  CoordinatorWalkInCheckInInput,
  CreateGuestFeedbackInput,
  GuestRosterSearchInput,
  ImportGuestRosterInput,
  ModerateGuestFeedbackInput,
  PrismCoordinatorRegistrationEntry,
  PrismGuestRosterEntry,
  UpdateGuestVerificationInput,
  UploadMetadataInput,
  WithdrawGuestFeedbackConsentInput,
  PrismGuestEventWatermark,
} from '@prism/types';
import { PRISM_PRIVACY_NOTICE_VERSION } from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type EventWithDrafts = OpsEvent & { floorPlanDrafts?: unknown[]; walkInPolicy?: string | null; walkInThreshold?: number | null };

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
type GuestWorkflowActor = { id?: string; coordinatorId?: string; email?: string; name: string; role: string };

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const GUEST_UPLOAD_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'video/mp4'] as const;
const MAX_GUEST_CHECK_INS = 500;
const MAX_GUEST_FEEDBACK = 500;
const MAX_GUEST_ROSTER_SEARCH = 500;
const MAX_GUEST_EVENT_FLOORPLAN_DRAFTS = 100;

@Injectable()
export class GuestWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(DOCUMENT_VAULT) private readonly documentVault: DocumentVault,
    @Inject(STAFFING_READER) private readonly staffingReader: StaffingReader,
  ) {}

  async getEventByAccessCode(accessCode: string) {
    return this.resolveGuestEventByAccessCode(accessCode);
  }

  async getEventWatermarkByAccessCode(accessCode: string): Promise<PrismGuestEventWatermark> {
    const normalizedCode = this.normalizeGuestAccessCode(accessCode);
    const events = await this.prisma.opsEvent.findMany({
      where: { archived: false },
      select: { id: true, eventName: true, updatedAt: true },
      orderBy: { eventDate: 'asc' },
    });
    const event = events.find((item) => this.guestAccessCode(item) === normalizedCode);
    if (!event) throw new NotFoundException('Guest event code was not found');

    const attendanceCount = await this.countCheckInsForEvent(event.id);
    return { watermark: this.guestEventWatermark(event.updatedAt, attendanceCount) };
  }

  countCheckInsForEvent(eventId: string) {
    return this.prisma.opsGuestCheckIn.count({ where: { eventId } });
  }

  listCheckInsForEvent(eventId: string) {
    return this.prisma.opsGuestCheckIn.findMany({ where: { eventId }, orderBy: [{ checkedInAt: 'desc' }, { id: 'desc' }], take: MAX_GUEST_CHECK_INS });
  }

  listCheckInsForEvents(eventIds: string[]) {
    if (eventIds.length === 0) return Promise.resolve([]);
    return this.prisma.opsGuestCheckIn.findMany({
      where: { eventId: { in: eventIds } },
      orderBy: [{ checkedInAt: 'desc' }, { id: 'desc' }],
      take: MAX_GUEST_CHECK_INS,
    });
  }

  listFeedbackForEvent(eventId: string) {
    return this.prisma.opsGuestFeedback.findMany({ where: { eventId }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], take: MAX_GUEST_FEEDBACK });
  }

  listFeedbackForEvents(eventIds: string[]) {
    if (eventIds.length === 0) return Promise.resolve([]);
    return this.prisma.opsGuestFeedback.findMany({
      where: { eventId: { in: eventIds } },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: MAX_GUEST_FEEDBACK,
    });
  }

  countPendingFeedbackForEvent(eventId: string) {
    return this.prisma.opsGuestFeedback.count({ where: { eventId, moderationStatus: 'pending_review' } });
  }

  listPendingFeedbackForEvent(eventId: string) {
    return this.prisma.opsGuestFeedback.findMany({
      where: { eventId, moderationStatus: 'pending_review' },
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
      take: MAX_GUEST_FEEDBACK,
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
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: MAX_GUEST_FEEDBACK,
    });
  }

  async checkInByAccessCode(accessCode: string, input: GuestCheckInInput): Promise<OpsGuestCheckIn> {
    return this.createCheckIn(() => this.resolveGuestEventByAccessCode(accessCode), input);
  }

  async registerWalkIn(eventId: string, input: CoordinatorWalkInCheckInInput, actor: GuestWorkflowActor) {
    await this.requireRegistrationDeskAccess(eventId, actor);
    const guestName = input.guestName.trim();
    if (!guestName) throw new BadRequestException('Guest name is required');
    this.requireCheckInConsent(input);

    return this.prisma.$transaction(async (tx) => {
      const correlationId = `coordinator_walkin_${randomUUID()}`;
      await this.lockEvent({ prisma: tx, correlationId }, eventId);
      const event = await tx.opsEvent.findFirst({ where: { id: eventId, archived: false } });
      if (!event) throw new NotFoundException('Event not found or archived');
      const checkedInCount = await tx.opsGuestCheckIn.count({ where: { eventId, status: 'checked_in' } });
      this.assertWalkInAllowed(event, checkedInCount);

      const id = `gre_${randomUUID()}`;
      const rosterEntry = await tx.opsGuestRosterEntry.create({
        data: {
          id,
          eventId,
          sourceKey: `coordinator-walk-in:${id}`,
          guestName,
          normalizedName: guestName.toLowerCase(),
          category: 'Walk-in',
          eligibility: 'eligible',
          verificationStatus: 'pending',
          source: 'coordinator-walk-in',
        },
      });
      await writeAudit(this.auditWriter, eventId, actor.name, `Walk-in added to guest roster: ${guestName}`, {
        actorRole: actor.role,
        category: AuditCategory.Events,
        actionType: AuditActionType.Create,
        affectedType: 'guest_roster_entry',
        affectedId: id,
        affectedLabel: guestName,
        metadata: {
          walkIn: true,
          verificationStatus: 'pending',
          privacyConsentAccepted: input.privacyConsentAccepted,
          privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
          actorId: actor.id,
        },
      }, { prisma: tx, correlationId, actorId: actor.id });
      return this.mapCoordinatorRegistrationEntry(rosterEntry);
    });
  }

  private async createCheckIn(
    resolveEvent: () => Promise<EventWithDrafts>,
    input: GuestCheckInInput,
    actor?: { id?: string; name: string; role: string },
  ): Promise<OpsGuestCheckIn> {
    let event: EventWithDrafts | null = null;
    let guestName = '';
    let checkInMode = 'name_search';

    return this.workflowCommandService.execute<OpsGuestCheckIn>({
      name: 'guest_check_in',
      sideEffectMode: 'same_tx',
      context: {
        actorId: actor?.id ?? actor?.name ?? 'guest',
        actorRole: actor?.role ?? OpsUserRole.Guest,
        correlationId: `guest_check_in_${randomUUID()}`,
      },
      validateState: async () => {
        event = await resolveEvent();
        ({ guestName, checkInMode } = await this.validateCheckInState(event, input));
      },
      validateStateInTransaction: async (context) => {
        if (!event) throw new NotFoundException('Guest event code was not found');
        await this.lockEvent(context, event.id);
        const currentEvent = await context.prisma.opsEvent.findUnique({ where: { id: event.id } });
        if (!currentEvent || currentEvent.archived) throw new NotFoundException('Guest event was not found or archived');
        if (input.walkIn) {
          const checkedIn = await context.prisma.opsGuestCheckIn.count({ where: { eventId: event.id, status: 'checked_in' } });
          this.assertWalkInAllowed(currentEvent, checkedIn);
        }
      },
      write: async (context) => {
        if (!event) throw new NotFoundException('Guest event code was not found');
        const db = context?.prisma ?? this.prisma;
        if (input.rosterEntryId) {
          const existingRosterCheckIn = await db.opsGuestCheckIn.findFirst({ where: { eventId: event.id, rosterEntryId: input.rosterEntryId, status: 'checked_in' } });
          if (existingRosterCheckIn) return existingRosterCheckIn;
        }
        const checkIn = await db.opsGuestCheckIn.create({
          data: {
            id: `gci_${randomUUID()}`,
            eventId: event.id,
            rosterEntryId: input.rosterEntryId ?? null,
            guestName,
            checkInMode,
            status: 'checked_in',
            walkIn: Boolean(input.walkIn),
            verificationStatus: input.verificationStatus ?? (input.walkIn ? 'flagged' : 'verified'),
            privacyConsentAccepted: input.privacyConsentAccepted === true,
            privacyNoticeVersion: input.privacyNoticeVersion ?? PRISM_PRIVACY_NOTICE_VERSION,
            marketingConsentAccepted: Boolean(input.marketingConsentAccepted),
          },
        });
        if (input.rosterEntryId) {
          await db.opsGuestRosterEntry.update({ where: { id: input.rosterEntryId }, data: { checkedInAt: checkIn.checkedInAt } });
        }
        return checkIn;
      },
      sideEffects: async (checkIn, context) => {
        if (!event) return;
        await writeAudit(this.auditWriter, event.id, actor?.name ?? guestName, `Guest checked in: ${guestName}`, {
          actorRole: actor?.role ?? OpsUserRole.Guest,
          category: AuditCategory.Events,
          actionType: AuditActionType.Update,
          affectedType: 'guest_check_in',
          affectedId: checkIn.id,
          affectedLabel: guestName,
          metadata: { walkIn: Boolean(input.walkIn), checkInMode, ...(actor ? { actorId: actor.id } : {}) },
        }, context);
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
            privacyConsentAccepted: input.privacyConsentAccepted === true,
            privacyNoticeVersion: input.privacyNoticeVersion ?? PRISM_PRIVACY_NOTICE_VERSION,
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
    if (input.source.trim().toLowerCase() === 'coordinator-walk-in') {
      throw new BadRequestException('Coordinator walk-in is a reserved roster source');
    }
    const batchId = `roster_${randomUUID()}`;
      return this.prisma.$transaction(async (tx) => {
      const event = await tx.opsEvent.findUnique({ where: { id: eventId } });
      if (!event) throw new NotFoundException('Event not found');
      const keys = input.rows.map((row) => row.sourceKey);
      // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: input is capped at 1000 rows by the shared contract.
      const rows = [];
      // Keep the transaction bounded both by input size and by concurrent database work.
      for (let offset = 0; offset < input.rows.length; offset += 100) {
        const batch = input.rows.slice(offset, offset + 100);
        rows.push(...await Promise.all(batch.map(
          // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: each chunk is sliced to at most 100 input rows.
          (row) => tx.opsGuestRosterEntry.upsert({
            where: { eventId_sourceKey: { eventId, sourceKey: row.sourceKey } },
            create: { id: `gre_${randomUUID()}`, eventId, sourceKey: row.sourceKey, guestName: row.guestName.trim(), normalizedName: row.guestName.trim().toLowerCase(), email: row.email ?? '', phone: row.phone ?? '', category: row.category ?? '', table: row.table ?? '', eligibility: row.eligibility ?? 'eligible', verificationStatus: 'pending', source: input.source, importBatchId: batchId, withdrawnAt: null },
            update: { guestName: row.guestName.trim(), normalizedName: row.guestName.trim().toLowerCase(), email: row.email ?? '', phone: row.phone ?? '', category: row.category ?? '', table: row.table ?? '', eligibility: row.eligibility ?? 'eligible', source: input.source, importBatchId: batchId, withdrawnAt: null },
          }))));
      }
      await tx.opsGuestRosterEntry.updateMany({ where: { eventId, source: input.source, sourceKey: { notIn: keys }, withdrawnAt: null }, data: { withdrawnAt: new Date() } });
      await tx.opsGuestRosterImport.create({ data: { id: batchId, eventId, source: input.source, importedById: actor.id ?? null, importedBy: actor.name, rowCount: rows.length, rawFileUploadBlocked: true } });
      await writeAudit(this.auditWriter, eventId, actor.name, 'Guest roster imported and reconciled', { actorRole: actor.role, category: AuditCategory.Events, actionType: AuditActionType.Update, affectedType: 'guest_roster', affectedId: eventId, metadata: { batchId, rowCount: rows.length, source: input.source, actorId: actor.id, rawFileUploadBlocked: true } }, { prisma: tx, correlationId: batchId });
      return rows.map((row) => this.mapGuestRosterEntry(row));
    });
  }

  async searchRoster(eventId: string, input: GuestRosterSearchInput = {}) {
    const query = input.namePrefix?.trim() || input.query?.trim() || '';
    const where: Record<string, unknown> = { eventId, withdrawnAt: null };
    if (input.eligibility) where.eligibility = input.eligibility;
    if (query) where.normalizedName = { startsWith: query.toLowerCase() };
    if (input.checkedIn !== undefined) where.checkedInAt = input.checkedIn ? { not: null } : null;
    const rows = await this.prisma.opsGuestRosterEntry.findMany({
      where,
      orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
      take: MAX_GUEST_ROSTER_SEARCH,
    });
    return rows.map((row) => this.mapGuestRosterEntry(row));
  }

  async searchCoordinatorRoster(eventId: string, actor: GuestWorkflowActor, input: GuestRosterSearchInput = {}): Promise<PrismCoordinatorRegistrationEntry[]> {
    await this.requireRegistrationDeskAccess(eventId, actor);
    const query = input.namePrefix?.trim() || input.query?.trim() || '';
    const where: Prisma.OpsGuestRosterEntryWhereInput = { eventId, withdrawnAt: null };
    if (input.eligibility) where.eligibility = input.eligibility;
    if (query) where.normalizedName = { startsWith: query.toLowerCase() };
    if (input.checkedIn !== undefined) where.checkedInAt = input.checkedIn ? { not: null } : null;
    const rows = await this.prisma.opsGuestRosterEntry.findMany({
      where,
      select: { id: true, eventId: true, guestName: true, category: true, table: true, eligibility: true, verificationStatus: true, checkedInAt: true, source: true },
      orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
      take: MAX_GUEST_ROSTER_SEARCH,
    });
    return rows.map((row) => this.mapCoordinatorRegistrationEntry(row));
  }

  async updateVerification(eventId: string, rosterEntryId: string, input: UpdateGuestVerificationInput, actor: GuestWorkflowActor) {
    await this.requireRegistrationDeskAccess(eventId, actor);
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockEvent({ prisma: tx, correlationId: `roster_verify_${rosterEntryId}` }, eventId);
      const event = await tx.opsEvent.findUnique({ where: { id: eventId }, select: { archived: true } });
      if (!event || event.archived) throw new NotFoundException('Event not found or archived');
      const roster = await tx.opsGuestRosterEntry.findFirst({ where: { id: rosterEntryId, eventId, withdrawnAt: null } });
      if (!roster) throw new NotFoundException('Roster entry not found');
      if (roster.checkedInAt && input.status !== roster.verificationStatus) {
        throw new BadRequestException('Guest verification cannot change after check-in');
      }
      const updated = await tx.opsGuestRosterEntry.update({ where: { id: rosterEntryId }, data: { verificationStatus: input.status } });
      await writeAudit(this.auditWriter, eventId, actor.name, `Guest verification changed: ${roster.guestName}`, { actorRole: actor.role, category: AuditCategory.Events, actionType: AuditActionType.Update, affectedType: 'guest_roster_verification', affectedId: rosterEntryId, affectedLabel: roster.guestName, metadata: { previousStatus: roster.verificationStatus, status: input.status, actorId: actor.id } }, { prisma: tx, correlationId: `roster_verify_${rosterEntryId}`, actorId: actor.id });
      return updated;
    });
    return actor.role === OpsUserRole.Coordinator
      ? this.mapCoordinatorRegistrationEntry(updated)
      : this.mapGuestRosterEntry(updated);
  }

  async checkInRosterEntry(eventId: string, rosterEntryId: string, actor: GuestWorkflowActor) {
    await this.requireRegistrationDeskAccess(eventId, actor);
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.opsEvent.findFirst({ where: { id: eventId, archived: false } });
      if (!event) throw new NotFoundException('Event not found or archived');
      await this.lockEvent({ prisma: tx, correlationId: `roster_checkin_${rosterEntryId}` }, eventId);
      const currentEvent = await tx.opsEvent.findUnique({ where: { id: eventId } });
      if (!currentEvent || currentEvent.archived) throw new NotFoundException('Event not found or archived');
      const roster = await tx.opsGuestRosterEntry.findFirst({
        where: { id: rosterEntryId, eventId, withdrawnAt: null, eligibility: 'eligible' },
      });
      if (!roster) throw new BadRequestException('Roster entry is not eligible for check-in');
      const walkIn = await this.requireRosterCheckInEligibility(tx, currentEvent, roster);
      const existing = await tx.opsGuestCheckIn.findFirst({
        where: { eventId, rosterEntryId, status: 'checked_in' },
      });
      if (existing) return existing;
      const checkIn = await tx.opsGuestCheckIn.create({
        data: {
          id: `gci_${randomUUID()}`,
          eventId,
          rosterEntryId,
          guestName: roster.guestName,
          checkInMode: walkIn ? 'walk_in' : 'roster',
          status: 'checked_in',
          walkIn,
          verificationStatus: 'verified',
          privacyConsentAccepted: walkIn,
          privacyNoticeVersion: walkIn ? PRISM_PRIVACY_NOTICE_VERSION : '',
          marketingConsentAccepted: false,
        },
      });
      await tx.opsGuestRosterEntry.update({ where: { id: rosterEntryId }, data: { checkedInAt: checkIn.checkedInAt } });
      await writeAudit(this.auditWriter, eventId, actor.name, `Roster guest checked in: ${roster.guestName}`, {
        actorRole: actor.role,
        category: AuditCategory.Events,
        actionType: AuditActionType.Update,
        affectedType: 'guest_check_in',
        affectedId: checkIn.id,
        affectedLabel: roster.guestName,
        metadata: { rosterEntryId, checkInMode: walkIn ? 'walk_in' : 'roster', actorId: actor.id },
      }, { prisma: tx, correlationId: `roster_checkin_${rosterEntryId}` });
      return checkIn;
    });
  }

  private async requireRosterCheckInEligibility(tx: Prisma.TransactionClient, event: OpsEvent, roster: OpsGuestRosterEntry) {
      if (roster.verificationStatus === 'rejected') throw new BadRequestException('Roster entry verification was rejected');
      const walkIn = roster.source === 'coordinator-walk-in';
      if (walkIn && roster.verificationStatus !== 'verified') {
        throw new BadRequestException('Walk-in must be verified before check-in');
      }
      if (walkIn) {
        const checkedInCount = await tx.opsGuestCheckIn.count({ where: { eventId: event.id, status: 'checked_in' } });
        this.assertWalkInAllowed(event, checkedInCount);
      }
      return walkIn;
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
    // QUERY_AUDIT_ALLOW_UNBOUNDED: access codes are derived from event name and ID, so lookup scans only those two columns.
    const events = await this.prisma.opsEvent.findMany({
      where: feedbackPath ? {} : { archived: false },
      select: { id: true, eventName: true },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
    });
    const matched = events.find((item) => this.guestAccessCode(item) === normalizedCode);
    if (!matched) throw new NotFoundException('Guest event code was not found');
    const event = await this.prisma.opsEvent.findUnique({
      where: { id: matched.id },
      include: { floorPlanDrafts: { orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: MAX_GUEST_EVENT_FLOORPLAN_DRAFTS } },
    });
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

  private assertWalkInAllowed(event: Pick<OpsEvent, 'walkInPolicy' | 'walkInThreshold'>, checkedInCount: number) {
    const policy = event.walkInPolicy;
    if (policy === 'closed' || !policy) throw new BadRequestException('Walk-in registration is closed for this event');
    if (policy === 'threshold' && checkedInCount >= event.walkInThreshold) {
      throw new BadRequestException('Walk-in registration threshold has been reached for this event');
    }
  }

  private async validateCheckInState(event: EventWithDrafts, input: GuestCheckInInput): Promise<{ guestName: string; checkInMode: string }> {
    const resolvedGuestName = await this.resolveCheckInGuestName(event.id, input);
    this.requireCheckInConsent(input);
    const resolvedCheckInMode = input.checkInMode ?? (input.walkIn ? 'walk_in' : 'name_search');
    await this.validateWalkInState(event, input.walkIn);
    return { guestName: resolvedGuestName, checkInMode: resolvedCheckInMode };
  }

  private async resolveCheckInGuestName(eventId: string, input: GuestCheckInInput) {
    const rosterConfigured = await this.prisma.opsGuestRosterEntry?.findFirst({ where: { eventId, withdrawnAt: null } });
    if (rosterConfigured && !input.rosterEntryId && !input.walkIn) throw new BadRequestException('Select an eligible roster entry for check-in');
    if (!input.rosterEntryId) {
      const name = input.guestName?.trim();
      if (!name) throw new BadRequestException('Guest name is required');
      return name;
    }
    const roster = await this.prisma.opsGuestRosterEntry?.findFirst({ where: { id: input.rosterEntryId, eventId, withdrawnAt: null } });
    if (!roster || roster.eligibility !== 'eligible' || roster.verificationStatus === 'rejected') throw new BadRequestException('Roster entry is not eligible for check-in');
    return roster.guestName;
  }

  private requireCheckInConsent(input: GuestCheckInInput) {
    if (!input.privacyConsentAccepted) throw new BadRequestException('Privacy consent is required before guest check-in');
  }

  private async validateWalkInState(event: EventWithDrafts, walkIn?: boolean) {
    if (!walkIn) return;
    const checkedInCount = await this.prisma.opsGuestCheckIn.count({ where: { eventId: event.id, status: 'checked_in' } });
    this.assertWalkInAllowed(event, checkedInCount);
  }

  private async lockEvent(context: PrismTransactionContext, eventId: string) {
    // QUERY_AUDIT_RAW_SQL: serialize threshold check-ins with policy changes.
    await context.prisma.$queryRaw`SELECT id FROM event_core.events WHERE id = ${eventId} FOR UPDATE`;
  }

  private async requireRegistrationDeskAccess(eventId: string, actor: GuestWorkflowActor) {
    if (actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System) return;
    if (actor.role !== OpsUserRole.Coordinator) {
      throw new ForbiddenException('Only PMCM or assigned Registration Staff may access the guest registration desk');
    }
    const assignment = await this.staffingReader.findAssignmentForEventActor(eventId, actor);
    const inactiveStatuses: readonly string[] = INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES;
    const inactive = assignment && (
      inactiveStatuses.includes(assignment.status)
      || assignment.status === CoordinatorAssignmentStatus.Declined
    );
    if (!assignment || inactive || !/\bregistration\b/i.test(assignment.role)) {
      throw new ForbiddenException('Only coordinators assigned to a Registration role may access guest registration');
    }
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
      watermark: this.guestEventWatermark(event.updatedAt, attendanceCount),
    };
  }

  private guestEventWatermark(updatedAt: Date, attendanceCount: number): string {
    return `${updatedAt.toISOString()}:${attendanceCount}`;
  }

  mapGuestCheckIn(checkIn: OpsGuestCheckIn) {
    return {
      id: checkIn.id,
      eventId: checkIn.eventId,
      rosterEntryId: checkIn.rosterEntryId,
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

  private mapCoordinatorRegistrationEntry(entry: Pick<OpsGuestRosterEntry, 'id' | 'eventId' | 'guestName' | 'category' | 'table' | 'eligibility' | 'verificationStatus' | 'checkedInAt' | 'source'>): PrismCoordinatorRegistrationEntry {
    return {
      id: entry.id,
      eventId: entry.eventId,
      guestName: entry.guestName,
      category: entry.category,
      table: entry.table,
      eligibility: entry.eligibility,
      verificationStatus: entry.verificationStatus as PrismCoordinatorRegistrationEntry['verificationStatus'],
      checkedInAt: entry.checkedInAt?.toISOString() ?? null,
      walkIn: entry.source === 'coordinator-walk-in',
    };
  }

  private mapGuestRosterEntry(entry: {
    id: string; eventId: string; sourceKey: string; guestName: string; email: string; phone: string;
    category: string; table: string; eligibility: string; verificationStatus: string; source: string;
    importBatchId: string | null; checkedInAt: Date | null; withdrawnAt: Date | null; createdAt: Date; updatedAt: Date;
  }): PrismGuestRosterEntry {
    return {
      id: entry.id,
      eventId: entry.eventId,
      sourceKey: entry.sourceKey,
      guestName: entry.guestName,
      email: entry.email,
      phone: entry.phone,
      category: entry.category,
      table: entry.table,
      eligibility: entry.eligibility,
      verificationStatus: entry.verificationStatus as PrismGuestRosterEntry['verificationStatus'],
      source: entry.source,
      importBatchId: entry.importBatchId,
      checkedInAt: entry.checkedInAt?.toISOString() ?? null,
      withdrawnAt: entry.withdrawnAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
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
