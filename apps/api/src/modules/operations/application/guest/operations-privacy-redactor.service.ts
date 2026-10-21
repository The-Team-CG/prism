import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismPrivacyExportSection, PrivacyCorrectionPatch } from '@prism/types';
import type { OperationsPrivacyRedactor, OperationsRedactionResult } from '../../contracts/privacy-redaction.port';

@Injectable()
export class OperationsPrivacyRedactorService implements OperationsPrivacyRedactor {
  async redactGuest(
    input: { eventId: string; name: string },
    transaction: Prisma.TransactionClient,
  ): Promise<OperationsRedactionResult> {
    if (!input.eventId || !input.name.trim()) throw new BadRequestException('Guest deletion requires a name and event scope');
    const guestWhere = {
      eventId: input.eventId,
      guestName: { equals: input.name.trim(), mode: 'insensitive' as const },
    };
    const rosterEntries = await transaction.opsGuestRosterEntry.findMany({
      where: guestWhere,
      select: { id: true },
      take: 2,
    });
    if (!rosterEntries.length) return { surfaces: [], touchedRecords: 0 };
    if (rosterEntries.length !== 1) {
      throw new ConflictException('Guest deletion requires a unique roster identity; resolve missing or same-named guests before execution');
    }
    const entry = rosterEntries[0];
    await this.assertGuestDeletionLinks(transaction, guestWhere, entry.id);
    await this.redactRosterEntry(transaction, input.eventId, entry.id);
    const checkIns = await transaction.opsGuestCheckIn.updateMany({
      where: { eventId: input.eventId, rosterEntryId: entry.id },
      data: { guestName: 'Redacted guest' },
    });
    return {
      surfaces: [
        'guest_roster_entry',
        ...(checkIns.count ? ['guest_check_in'] : []),
      ],
      touchedRecords: 1 + checkIns.count,
    };
  }

  /** A name locates a candidate, never authorizes a bulk write. Feedback has no stable guest link. */
  private async assertGuestDeletionLinks(
    transaction: Prisma.TransactionClient,
    guestWhere: { eventId: string; guestName: { equals: string; mode: 'insensitive' } },
    rosterEntryId: string,
  ) {
    const feedback = await transaction.opsGuestFeedback.findFirst({ where: guestWhere, select: { id: true } });
    if (feedback) {
      throw new ConflictException('Guest feedback has no verified roster link; individual record review is required before deletion');
    }
    const unlinked = await transaction.opsGuestCheckIn.findFirst({
      where: {
        ...guestWhere,
        OR: [{ rosterEntryId: null }, { rosterEntryId: { not: rosterEntryId } }],
      },
      select: { id: true },
    });
    if (unlinked) {
      throw new ConflictException('Guest check-ins do not resolve to one roster identity; individual record review is required before deletion');
    }
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

  async correctGuest(
    input: { eventId: string; name: string; patch: PrivacyCorrectionPatch },
    transaction: Prisma.TransactionClient,
  ): Promise<OperationsRedactionResult> {
    const currentName = input.name.trim();
    if (!input.eventId || !currentName) throw new BadRequestException('Guest correction requires a name and event scope');
    const correctedName = input.patch.name?.trim();
    const guestWhere = { eventId: input.eventId, guestName: { equals: currentName, mode: 'insensitive' as const } };
    await this.assertCorrectedNameFree(transaction, input.eventId, currentName, correctedName);

    const roster = await transaction.opsGuestRosterEntry.updateMany({
      where: guestWhere,
      data: {
        ...(correctedName ? { guestName: correctedName, normalizedName: correctedName.toLowerCase() } : {}),
        ...(input.patch.email !== undefined ? { email: input.patch.email.trim().toLowerCase() } : {}),
      },
    });
    const checkIns = correctedName
      ? await transaction.opsGuestCheckIn.updateMany({ where: guestWhere, data: { guestName: correctedName } })
      : { count: 0 };
    const feedback = correctedName
      ? await transaction.opsGuestFeedback.updateMany({ where: guestWhere, data: { guestName: correctedName } })
      : { count: 0 };
    return {
      surfaces: [
        ...(roster.count ? ['guest_roster_entry'] : []),
        ...(checkIns.count ? ['guest_check_in'] : []),
        ...(feedback.count ? ['guest_feedback'] : []),
      ],
      touchedRecords: roster.count + checkIns.count + feedback.count,
    };
  }

  /** Only a genuinely different corrected name needs to be free of another guest's identity in the event. */
  private async assertCorrectedNameFree(
    transaction: Prisma.TransactionClient,
    eventId: string,
    currentName: string,
    correctedName: string | undefined,
  ) {
    if (!correctedName || correctedName.toLowerCase() === currentName.toLowerCase()) return;
    await this.assertGuestNameFree(transaction, eventId, correctedName);
  }

  /** A corrected name must not merge the subject into another guest's identity in the same event. */
  private async assertGuestNameFree(transaction: Prisma.TransactionClient, eventId: string, name: string) {
    const where = { eventId, guestName: { equals: name, mode: 'insensitive' as const } };
    const taken = await transaction.opsGuestRosterEntry.findFirst({ where, select: { id: true } })
      ?? await transaction.opsGuestCheckIn.findFirst({ where, select: { id: true } })
      ?? await transaction.opsGuestFeedback.findFirst({ where, select: { id: true } });
    if (taken) {
      throw new ConflictException('Another guest in this event already uses the corrected name');
    }
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
