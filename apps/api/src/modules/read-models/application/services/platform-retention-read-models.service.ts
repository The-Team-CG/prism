import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type {
  PlatformRetentionCandidate,
  PlatformRetentionCandidatePage,
  PlatformRetentionReadModel,
  PlatformRetentionSourceCategory,
} from '../../contracts/ports/platform-retention-read-model.port';

/** Values written by the existing privacy redactors; rows carrying them were already redacted. */
const REDACTED_CLIENT_NAME = 'Redacted data subject';
const REDACTED_GUEST_NAME = 'Redacted guest';

@Injectable()
export class PlatformRetentionReadModelsService implements PlatformRetentionReadModel {
  constructor(private readonly prisma: PrismaService) {}

  async findRetentionCandidates(input: {
    category: PlatformRetentionSourceCategory;
    archivedBefore: Date;
    afterEventId?: string;
    eventTake: number;
  }): Promise<PlatformRetentionCandidatePage> {
    const events = await this.prisma.opsEvent.findMany({
      where: {
        archived: true,
        archivedAt: { lte: input.archivedBefore },
        ...(input.afterEventId ? { id: { gt: input.afterEventId } } : {}),
      },
      orderBy: { id: 'asc' },
      // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: the caller passes a fixed sweep page size (EVENT_PAGE_SIZE).
      take: input.eventTake,
      select: {
        id: true,
        archivedAt: true,
        inquiry: { select: { id: true, email: true, clientName: true } },
      },
    });
    const nextEventCursor = events.length === input.eventTake ? events[events.length - 1].id : null;
    const anchorByEvent = new Map(events.flatMap((event) => (event.archivedAt ? [[event.id, event.archivedAt] as const] : [])));
    if (events.length === 0) return { candidates: [], nextEventCursor };

    if (input.category === 'inquiry') {
      const candidates = events.flatMap((event): PlatformRetentionCandidate[] => {
        const anchorAt = anchorByEvent.get(event.id);
        if (!anchorAt || !event.inquiry || event.inquiry.clientName === REDACTED_CLIENT_NAME) return [];
        return [{ category: 'inquiry', subjectId: event.inquiry.id, eventId: event.id, subjectEmail: event.inquiry.email, subjectName: '', anchorAt }];
      });
      return { candidates, nextEventCursor };
    }

    // QUERY_AUDIT_ALLOW_UNBOUNDED: guest rows are bounded by the event page (eventTake) and each event's guest list, so the cursor never skips a row.
    const eventIds = events.map((event) => event.id);
    const candidates = input.category === 'guest_check_in'
      ? (await this.prisma.opsGuestCheckIn.findMany({
          where: { eventId: { in: eventIds }, guestName: { notIn: [REDACTED_GUEST_NAME] } },
          select: { id: true, eventId: true, guestName: true },
        })).flatMap((row) => guestCandidate('guest_check_in', row, anchorByEvent))
      : (await this.prisma.opsGuestFeedback.findMany({
          where: { eventId: { in: eventIds }, guestName: { notIn: [REDACTED_GUEST_NAME] } },
          select: { id: true, eventId: true, guestName: true },
        })).flatMap((row) => guestCandidate('guest_feedback', row, anchorByEvent));
    return { candidates, nextEventCursor };
  }

  async findRetentionCandidate(
    input: { category: PlatformRetentionSourceCategory; subjectId: string; eventId: string },
    transaction?: PrismTransactionContext,
  ): Promise<PlatformRetentionCandidate | null> {
    const prisma = transaction?.prisma ?? this.prisma;
    const event = await prisma.opsEvent.findUnique({
      where: { id: input.eventId },
      select: { id: true, archived: true, archivedAt: true, inquiry: { select: { id: true, email: true, clientName: true } } },
    });
    if (!event?.archived || !event.archivedAt) return null;

    if (input.category === 'inquiry') {
      if (!event.inquiry || event.inquiry.id !== input.subjectId || event.inquiry.clientName === REDACTED_CLIENT_NAME) return null;
      return { category: 'inquiry', subjectId: event.inquiry.id, eventId: event.id, subjectEmail: event.inquiry.email, subjectName: '', anchorAt: event.archivedAt };
    }

    const anchorByEvent = new Map([[event.id, event.archivedAt] as const]);
    const row = input.category === 'guest_check_in'
      ? await prisma.opsGuestCheckIn.findFirst({
          where: { id: input.subjectId, eventId: input.eventId, guestName: { notIn: [REDACTED_GUEST_NAME] } },
          select: { id: true, eventId: true, guestName: true },
        })
      : await prisma.opsGuestFeedback.findFirst({
          where: { id: input.subjectId, eventId: input.eventId, guestName: { notIn: [REDACTED_GUEST_NAME] } },
          select: { id: true, eventId: true, guestName: true },
        });
    return row ? guestCandidate(input.category, row, anchorByEvent)[0] ?? null : null;
  }
}

function guestCandidate(
  category: 'guest_check_in' | 'guest_feedback',
  row: { id: string; eventId: string; guestName: string | null },
  anchorByEvent: Map<string, Date>,
): PlatformRetentionCandidate[] {
  const anchorAt = anchorByEvent.get(row.eventId);
  if (!anchorAt || !row.guestName) return [];
  return [{ category, subjectId: row.id, eventId: row.eventId, subjectEmail: '', subjectName: row.guestName, anchorAt }];
}
