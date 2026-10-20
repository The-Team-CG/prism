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
      const sourceKey = await this.availableRedactedSourceKey(transaction, input.eventId, entry.id);
      await transaction.opsGuestRosterEntry.update({
        where: { id: entry.id },
        data: {
          sourceKey,
          guestName: 'Redacted guest',
          normalizedName: 'redacted guest',
          email: '',
          phone: '',
        },
      });
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
