import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { OpsEvent, OpsGuestCheckIn, OpsGuestFeedback } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { DOCUMENT_VAULT, type DocumentVault, type UploadMetadataInput } from '@prism/contexts/event-lifecycle';
import type { GuestRosterSearchInput, ImportGuestRosterInput, PrismGuestRosterEntry, UpdateGuestVerificationInput } from '@prism/types';
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

export type GuestFeedbackInput = {
  guestName: string;
  rating: number;
  comment?: string;
  photo?: UploadMetadataInput;
  video?: UploadMetadataInput;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
};

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

  async checkInByAccessCode(accessCode: string, input: GuestCheckInInput): Promise<OpsGuestCheckIn> {
    let event: EventWithDrafts | null = null;
    let guestName = '';
    let checkInMode = 'name_search';

    return this.workflowCommandService.execute<OpsGuestCheckIn>({
      name: 'guest_check_in',
      sideEffectMode: 'same_tx',
      validateState: async () => {
        event = await this.resolveGuestEventByAccessCode(accessCode);
        ({ guestName, checkInMode } = await this.validateCheckInState(event, input));
      },
      validateStateInTransaction: async (context) => {
        if (!event) throw new NotFoundException('Guest event code was not found');
        await this.lockEvent(context, event.id);
        const currentEvent = await context.prisma.opsEvent.findUnique({ where: { id: event.id } });
        if (!currentEvent) throw new NotFoundException('Guest event code was not found');
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
            privacyConsentAccepted: true,
            privacyNoticeVersion: input.privacyNoticeVersion ?? '2026-05-01',
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
        await writeAudit(this.auditWriter, event.id, guestName, `Guest checked in: ${guestName}`, {
          actorRole: OpsUserRole.Guest,
          category: AuditCategory.Events,
          actionType: AuditActionType.Update,
          affectedType: 'guest_check_in',
          affectedId: checkIn.id,
          affectedLabel: guestName,
          metadata: { walkIn: Boolean(input.walkIn), checkInMode },
        }, context);
      },
    });
  }

  async submitFeedbackByAccessCode(accessCode: string, input: GuestFeedbackInput): Promise<OpsGuestFeedback> {
    let event: EventWithDrafts | null = null;
    let guestName = '';
    let photoFileName: string | null = null;
    let videoFileName: string | null = null;

    return this.workflowCommandService.execute<OpsGuestFeedback>({
      name: 'guest_feedback',
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
        photoFileName = input.photo ? this.validateUploadMetadata(input.photo, prefix).generatedFileName : null;
        videoFileName = input.video ? this.validateUploadMetadata(input.video, prefix).generatedFileName : null;
      },
      write: () => {
        if (!event) throw new NotFoundException('Guest event code was not found');
        return this.prisma.opsGuestFeedback.create({
          data: {
            id: `gfb_${randomUUID()}`,
            eventId: event.id,
            guestName,
            rating: input.rating,
            comment: input.comment?.trim() ?? '',
            photoFileName,
            videoFileName,
            privacyConsentAccepted: true,
            privacyNoticeVersion: input.privacyNoticeVersion ?? '2026-05-01',
            marketingConsentAccepted: Boolean(input.marketingConsentAccepted),
            moderationStatus: 'pending_review',
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
      // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: input is capped at 1000 rows by the shared contract.
      const rows = [];
      // Keep the transaction bounded both by input size and by concurrent database work.
      for (let offset = 0; offset < input.rows.length; offset += 100) {
        const batch = input.rows.slice(offset, offset + 100);
        rows.push(...await Promise.all(batch.map((row) => tx.opsGuestRosterEntry.upsert({
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
    const rows = await this.prisma.opsGuestRosterEntry.findMany({ where, orderBy: { normalizedName: 'asc' } });
    return rows.map((row) => this.mapGuestRosterEntry(row));
  }

  async updateVerification(eventId: string, rosterEntryId: string, input: UpdateGuestVerificationInput, actor: { id?: string; name: string; role: string }) {
    return this.prisma.$transaction(async (tx) => {
      const roster = await tx.opsGuestRosterEntry.findFirst({ where: { id: rosterEntryId, eventId, withdrawnAt: null } });
      if (!roster) throw new NotFoundException('Roster entry not found');
      const updated = await tx.opsGuestRosterEntry.update({ where: { id: rosterEntryId }, data: { verificationStatus: input.status } });
      await writeAudit(this.auditWriter, eventId, actor.name, `Guest verification changed: ${roster.guestName}`, { actorRole: actor.role, category: AuditCategory.Events, actionType: AuditActionType.Update, affectedType: 'guest_roster_verification', affectedId: rosterEntryId, affectedLabel: roster.guestName, metadata: { previousStatus: roster.verificationStatus, status: input.status, actorId: actor.id } }, { prisma: tx, correlationId: `roster_verify_${rosterEntryId}`, actorId: actor.id });
      return this.mapGuestRosterEntry(updated);
    });
  }

  async checkInRosterEntry(eventId: string, rosterEntryId: string, actor: { id?: string; name: string; role: string }) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.opsEvent.findFirst({ where: { id: eventId, archived: false } });
      if (!event) throw new NotFoundException('Event not found or archived');
      await this.lockEvent({ prisma: tx, correlationId: `roster_checkin_${rosterEntryId}` }, eventId);
      const roster = await tx.opsGuestRosterEntry.findFirst({
        where: { id: rosterEntryId, eventId, withdrawnAt: null, eligibility: 'eligible' },
      });
      if (!roster) throw new BadRequestException('Roster entry is not eligible for check-in');
      if (roster.verificationStatus === 'rejected') throw new BadRequestException('Roster entry verification was rejected');
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
          checkInMode: 'roster',
          status: 'checked_in',
          walkIn: false,
          verificationStatus: 'verified',
          privacyConsentAccepted: true,
          privacyNoticeVersion: '2026-05-01',
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
        metadata: { rosterEntryId, checkInMode: 'roster', actorId: actor.id },
      }, { prisma: tx, correlationId: `roster_checkin_${rosterEntryId}` });
      return checkIn;
    });
  }

  private async resolveGuestEventByAccessCode(accessCode: string, requireFeedbackWindow = false) {
    const normalizedCode = this.normalizeGuestAccessCode(accessCode);
    const events = await this.prisma.opsEvent.findMany({
      where: requireFeedbackWindow ? {} : { archived: false },
      include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
      orderBy: { eventDate: 'asc' },
    });
    const event = events.find((item) => this.guestAccessCode(item) === normalizedCode && (!requireFeedbackWindow || this.isFeedbackWindowOpen(item)));
    if (!event) throw new NotFoundException('Guest event code was not found');
    return event;
  }

  private isFeedbackWindowOpen(event: { actualEndedAt?: Date | null; eventDate: Date }): boolean {
    if (!event.actualEndedAt) return false;
    const windowEnd = event.actualEndedAt.getTime() + 7 * 24 * 60 * 60 * 1000;
    return Date.now() <= windowEnd;
  }

  private assertFeedbackWindow(event: { actualEndedAt?: Date | null; eventDate: Date }): void {
    if (!this.isFeedbackWindowOpen(event)) {
      throw new BadRequestException('Guest feedback is available for seven days after the actual event end');
    }
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
