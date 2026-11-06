import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { SupplierQuoteRequestStatus } from '@prism/kernel/event-core';

const MAX_ROWS = 2000;
const MAX_MESSAGE_ROWS = 5000;
const DAY_MS = 86_400_000;
const MANILA_OFFSET = '+08:00';

/** The instant a Manila calendar date starts, and the instant just before the next one starts. */
const startOfManilaDay = (dateKey: string) => new Date(`${dateKey}T00:00:00.000${MANILA_OFFSET}`);
const endOfManilaDay = (dateKey: string) => new Date(`${dateKey}T23:59:59.999${MANILA_OFFSET}`);
/** Date-only columns are stored as UTC midnight of the calendar date. */
const startOfUtcDay = (dateKey: string) => new Date(`${dateKey}T00:00:00.000Z`);
const endOfUtcDay = (dateKey: string) => new Date(startOfUtcDay(dateKey).getTime() + DAY_MS - 1);

/** Read-only reads behind the PMCM event pickers and the PMCM calendar. Every list is bounded. */
@Injectable()
export class PmcmOverviewQueries {
  constructor(private readonly prisma: PrismaService) {}

  /** Milestones that may still be owed: not superseded and not fully paid or cancelled. */
  openMilestones() {
    return this.prisma.opsPaymentMilestone.findMany({
      where: { supersededAt: null, status: { notIn: ['paid', 'cancelled'] } },
      select: { id: true, eventId: true, label: true, amount: true, amountPaid: true, creditApplied: true, dueDate: true },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: MAX_ROWS,
    });
  }

  participations(actorId: string) {
    return this.prisma.opsCommunicationParticipant.findMany({
      where: { actorId, active: true },
      select: { threadId: true, lastReadAt: true, thread: { select: { eventId: true } } },
      orderBy: [{ threadId: 'asc' }],
      take: MAX_ROWS,
    });
  }

  messagesFromOthers(actorId: string, threadIds: string[]) {
    if (threadIds.length === 0) return Promise.resolve([]);
    return this.prisma.opsCommunicationMessage.findMany({
      where: { threadId: { in: threadIds }, senderId: { not: actorId } },
      select: { threadId: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_MESSAGE_ROWS,
    });
  }

  events(from: string, to: string) {
    return this.prisma.opsEvent.findMany({
      where: { eventDate: { gte: startOfUtcDay(from), lte: endOfUtcDay(to) } },
      select: { id: true, eventName: true, eventDate: true },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
      take: MAX_ROWS,
    });
  }

  /** Authored event-day schedule days; each has a run sheet. */
  scheduleDays(from: string, to: string) {
    return this.prisma.opsEventScheduleDay.findMany({
      where: { dayDate: { gte: startOfUtcDay(from), lte: endOfUtcDay(to) } },
      select: { id: true, eventId: true, dayDate: true, label: true },
      orderBy: [{ dayDate: 'asc' }, { id: 'asc' }],
      take: MAX_ROWS,
    });
  }

  /** Deadlines still being waited on; once a request is selected, closed or expired its deadline is history. */
  quoteDeadlines(from: string, to: string) {
    return this.prisma.opsSupplierQuoteRequest.findMany({
      where: {
        status: { in: [SupplierQuoteRequestStatus.Open, SupplierQuoteRequestStatus.RevisionRequested] },
        dueDate: { gte: startOfManilaDay(from), lte: endOfManilaDay(to) },
      },
      select: { id: true, eventId: true, supplierName: true, category: true, dueDate: true },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: MAX_ROWS,
    });
  }

  milestonesDue(from: string, to: string) {
    return this.prisma.opsPaymentMilestone.findMany({
      where: { supersededAt: null, status: { notIn: ['paid', 'cancelled'] }, dueDate: { gte: startOfUtcDay(from), lte: endOfUtcDay(to) } },
      select: { id: true, eventId: true, label: true, amount: true, amountPaid: true, creditApplied: true, dueDate: true },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: MAX_ROWS,
    });
  }

  ocularVisits(from: string, to: string) {
    return this.prisma.opsOcularVisitRequest.findMany({
      where: { scheduledAt: { gte: startOfManilaDay(from), lte: endOfManilaDay(to) }, completedAt: null, waivedAt: null },
      select: { id: true, eventId: true, scheduledAt: true },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: MAX_ROWS,
    });
  }

  supplierSchedules(from: string, to: string) {
    const window = { gte: startOfManilaDay(from), lte: endOfManilaDay(to) };
    return this.prisma.opsSupplierSchedule.findMany({
      where: { status: { not: 'cancelled' }, OR: [{ ingressAt: window }, { egressAt: window }] },
      select: { id: true, eventId: true, ingressAt: true, egressAt: true, location: true, request: { select: { supplierName: true } } },
      orderBy: [{ ingressAt: 'asc' }, { id: 'asc' }],
      take: MAX_ROWS,
    });
  }

  /** Events still in play, most recent first. File requirements are costly per event, so this list is short. */
  activeEventIds(limit: number) {
    return this.prisma.opsEvent.findMany({
      where: { archived: false },
      select: { id: true },
      orderBy: [{ eventDate: 'desc' }, { id: 'asc' }],
      take: limit,
    });
  }

  eventNames(eventIds: string[]) {
    if (eventIds.length === 0) return Promise.resolve([]);
    return this.prisma.opsEvent.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, eventName: true },
      orderBy: [{ id: 'asc' }],
      take: Math.min(eventIds.length, MAX_ROWS),
    });
  }
}
