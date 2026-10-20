import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismPrivacyExportSection } from '@prism/types';
import type { OperationsPrivacyRedactor, OperationsRedactionResult } from '../../contracts/privacy-redaction.port';

@Injectable()
export class OperationsPrivacyRedactorService implements OperationsPrivacyRedactor {
  async redactGuest(
    input: { eventId: string; name: string },
    transaction: Prisma.TransactionClient,
  ): Promise<OperationsRedactionResult> {
    if (!input.eventId) throw new BadRequestException('Guest deletion requires an event scope');
    const guestWhere = {
      eventId: input.eventId,
      guestName: { equals: input.name.trim(), mode: 'insensitive' as const },
    };
    const rosterEntries = await transaction.opsGuestRosterEntry.findMany({
      where: {
        eventId: input.eventId,
        guestName: { equals: input.name.trim(), mode: 'insensitive' },
      },
      select: { id: true },
    });
    for (const entry of rosterEntries) {
      await this.redactRosterEntry(transaction, input.eventId, entry.id);
    }
    const checkIns = await transaction.opsGuestCheckIn.updateMany({
      where: guestWhere,
      data: { guestName: 'Redacted guest' },
    });
    const feedbackRows = await transaction.opsGuestFeedback.findMany({
      where: guestWhere,
      select: { id: true },
    });
    const feedbackIds = feedbackRows.map(({ id }) => id);
    const media = feedbackIds.length
      ? await transaction.opsGuestFeedbackMedia.updateMany({
          where: { feedbackId: { in: feedbackIds } },
          data: { originalFileName: '[redacted by privacy request]' },
        })
      : { count: 0 };
    const feedback = await transaction.opsGuestFeedback.updateMany({
      where: guestWhere,
      data: {
        guestName: 'Redacted guest',
        comment: '[redacted by privacy request]',
        photoFileName: null,
        videoFileName: null,
      },
    });
    return {
      surfaces: [
        ...(rosterEntries.length ? ['guest_roster_entry'] : []),
        ...(checkIns.count ? ['guest_check_in'] : []),
        ...(feedback.count ? ['guest_feedback'] : []),
        ...(media.count ? ['guest_feedback_media_metadata'] : []),
      ],
      touchedRecords: rosterEntries.length + checkIns.count + feedback.count + media.count,
    };
  }

  /**
   * Redacts exactly one guest check-in or feedback record by id, plus rows linked to it by foreign key: the
   * check-in's roster entry and a feedback item's media metadata. Never matches by name, so another guest who
   * shares the name in the same event is untouched.
   */
  async redactGuestRecord(
    input: { eventId: string; recordType: 'guest_check_in' | 'guest_feedback'; recordId: string },
    transaction: Prisma.TransactionClient,
  ): Promise<OperationsRedactionResult> {
    if (!input.eventId || !input.recordId) throw new BadRequestException('Guest record redaction requires an event and record id');
    if (input.recordType === 'guest_check_in') {
      return this.redactCheckInRecord(transaction, input.eventId, input.recordId);
    }

    const feedback = await transaction.opsGuestFeedback.findFirst({
      where: { id: input.recordId, eventId: input.eventId },
      select: { id: true },
    });
    if (!feedback) return { surfaces: [], touchedRecords: 0 };
    const media = await transaction.opsGuestFeedbackMedia.updateMany({
      where: { feedbackId: feedback.id },
      data: { originalFileName: '[redacted by privacy request]' },
    });
    const feedbackUpdate = await transaction.opsGuestFeedback.updateMany({
      where: { id: feedback.id, eventId: input.eventId },
      data: {
        guestName: 'Redacted guest',
        comment: '[redacted by privacy request]',
        photoFileName: null,
        videoFileName: null,
      },
    });
    return {
      surfaces: [
        ...(media.count ? ['guest_feedback_media_metadata'] : []),
        ...(feedbackUpdate.count ? ['guest_feedback'] : []),
      ],
      touchedRecords: media.count + feedbackUpdate.count,
    };
  }

  private async redactCheckInRecord(
    transaction: Prisma.TransactionClient,
    eventId: string,
    recordId: string,
  ): Promise<OperationsRedactionResult> {
    const checkIn = await transaction.opsGuestCheckIn.findFirst({
      where: { id: recordId, eventId },
      select: { id: true, rosterEntryId: true },
    });
    if (!checkIn) return { surfaces: [], touchedRecords: 0 };
    const checkInUpdate = await transaction.opsGuestCheckIn.updateMany({
      where: { id: checkIn.id, eventId },
      data: { guestName: 'Redacted guest' },
    });
    let rosterTouched = 0;
    if (checkIn.rosterEntryId) {
      const entry = await transaction.opsGuestRosterEntry.findFirst({
        where: { id: checkIn.rosterEntryId, eventId },
        select: { id: true },
      });
      if (entry) {
        await this.redactRosterEntry(transaction, eventId, entry.id);
        rosterTouched = 1;
      }
    }
    return {
      surfaces: [
        ...(rosterTouched ? ['guest_roster_entry'] : []),
        ...(checkInUpdate.count ? ['guest_check_in'] : []),
      ],
      touchedRecords: rosterTouched + checkInUpdate.count,
    };
  }

  private async redactRosterEntry(transaction: Prisma.TransactionClient, eventId: string, entryId: string) {
    const sourceKey = await this.availableRedactedSourceKey(transaction, eventId, entryId);
    await transaction.opsGuestRosterEntry.update({
      where: { id: entryId },
      data: {
        sourceKey,
        guestName: 'Redacted guest',
        normalizedName: 'redacted guest',
        email: '',
        phone: '',
      },
    });
  }

  /** Roster, check-in, and feedback rows for one guest name inside one event. Moderation notes stay internal. */
  async exportGuest(
    input: { eventId: string; name: string },
    transaction: Prisma.TransactionClient,
  ): Promise<PrismPrivacyExportSection[]> {
    const guestName = { equals: input.name.trim(), mode: 'insensitive' as const };
    const rosterEntries = await transaction.opsGuestRosterEntry.findMany({
        where: { eventId: input.eventId, guestName },
        select: {
          id: true, guestName: true, email: true, phone: true, category: true, table: true, eligibility: true,
          verificationStatus: true, privacyConsentAccepted: true, privacyNoticeVersion: true, checkedInAt: true, withdrawnAt: true,
        },
    });
    const checkIns = await transaction.opsGuestCheckIn.findMany({
        where: { eventId: input.eventId, guestName },
        select: {
          id: true, guestName: true, checkInMode: true, status: true, walkIn: true, verificationStatus: true,
          privacyConsentAccepted: true, privacyNoticeVersion: true, marketingConsentAccepted: true, checkedInAt: true,
        },
    });
    const feedback = await transaction.opsGuestFeedback.findMany({
        where: { eventId: input.eventId, guestName },
        select: {
          id: true, guestName: true, rating: true, comment: true, moderationStatus: true, submittedAt: true,
          privacyNoticeVersion: true, marketingConsentAccepted: true,
          mediaAttachments: { select: { id: true } },
        },
    });
    const sections: PrismPrivacyExportSection[] = [
      {
        owner: 'operations',
        surface: 'guest_roster_entry',
        records: rosterEntries.map((entry) => ({
          id: entry.id,
          guestName: entry.guestName,
          email: entry.email,
          phone: entry.phone,
          category: entry.category,
          table: entry.table,
          eligibility: entry.eligibility,
          verificationStatus: entry.verificationStatus,
          privacyConsentAccepted: entry.privacyConsentAccepted,
          privacyNoticeVersion: entry.privacyNoticeVersion,
          checkedInAt: entry.checkedInAt?.toISOString() ?? null,
          withdrawnAt: entry.withdrawnAt?.toISOString() ?? null,
        })),
      },
      {
        owner: 'operations',
        surface: 'guest_check_in',
        records: checkIns.map((checkIn) => ({
          id: checkIn.id,
          guestName: checkIn.guestName,
          checkInMode: checkIn.checkInMode,
          status: checkIn.status,
          walkIn: checkIn.walkIn,
          verificationStatus: checkIn.verificationStatus,
          privacyConsentAccepted: checkIn.privacyConsentAccepted,
          privacyNoticeVersion: checkIn.privacyNoticeVersion,
          marketingConsentAccepted: checkIn.marketingConsentAccepted,
          checkedInAt: checkIn.checkedInAt.toISOString(),
        })),
      },
      {
        owner: 'operations',
        surface: 'guest_feedback',
        records: feedback.map((item) => ({
          id: item.id,
          guestName: item.guestName,
          rating: item.rating,
          comment: item.comment,
          moderationStatus: item.moderationStatus,
          submittedAt: item.submittedAt.toISOString(),
          privacyNoticeVersion: item.privacyNoticeVersion,
          marketingConsentAccepted: item.marketingConsentAccepted,
          mediaCount: item.mediaAttachments.length,
        })),
      },
    ];
    return sections.filter((section) => section.records.length > 0);
  }

  private async availableRedactedSourceKey(
    transaction: Prisma.TransactionClient,
    eventId: string,
    entryId: string,
  ): Promise<string> {
    const base = `privacy-redacted:${entryId}`;
    const maxCandidates = 16;
    for (let suffix = 0; suffix < maxCandidates; suffix += 1) {
      const candidate = suffix === 0 ? base : `${base}:${suffix}`;
      const existing = await transaction.opsGuestRosterEntry.findFirst({
        where: { eventId, sourceKey: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
    }
    throw new ConflictException('Unable to allocate a unique redacted guest roster key');
  }
}
