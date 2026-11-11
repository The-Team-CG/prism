import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { DateChangeFacts, DateChangeFactsReader, DateChangeSupplierFacts } from './date-change-facts-reader.port';

const MAX_ROWS = 500;
const LIVE_ASSIGNMENTS = ['pending_confirmation', 'confirmed'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** The calendar day as a UTC range, which holds an event stored at UTC midnight and one stored at any hour of that day. */
function dayRange(dateKey: string): { gte: Date; lt: Date } {
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  return { gte: start, lt: new Date(start.getTime() + DAY_MS) };
}

@Injectable()
export class DateChangeFactsReaderService implements DateChangeFactsReader {
  constructor(private readonly prisma: PrismaService) {}

  async getFacts(eventId: string, newDateKey: string | null): Promise<DateChangeFacts | null> {
    const event = await this.prisma.opsEvent.findUnique({
      where: { id: eventId },
      select: { id: true, eventName: true, eventDate: true, archived: true, proposalClientStatus: true, floorPlanStatus: true },
    });
    if (!event) return null;
    const [bookings, milestones, conforme, billing] = await Promise.all([
      this.prisma.opsSupplierQuoteRequest.findMany({
        where: { eventId, status: 'selected' },
        select: { id: true, supplierId: true, supplierName: true, category: true, assignmentStatus: true },
        orderBy: [{ category: 'asc' }, { id: 'asc' }],
        // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: one event's selected supplier bookings, one per requested category.
        take: MAX_ROWS,
      }),
      this.prisma.opsPaymentMilestone.findMany({
        where: { eventId, supersededAt: null },
        select: { id: true, label: true, amount: true, amountPaid: true, remainingBalance: true, dueDate: true },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: one event's current payment schedule.
        take: MAX_ROWS,
      }),
      this.prisma.opsConformeExecution.findFirst({ where: { eventId, completedAt: { not: null } }, select: { id: true } }),
      this.prisma.opsBillingStatement.findFirst({ where: { eventId, sentAt: { not: null } }, select: { id: true } }),
    ]);
    return {
      eventId: event.id,
      eventName: event.eventName,
      eventDate: event.eventDate,
      archived: event.archived,
      suppliers: await this.supplierFacts(eventId, bookings, newDateKey),
      milestones: milestones.map((milestone) => ({ ...milestone, dueDate: milestone.dueDate.toISOString().slice(0, 10) })),
      approved: {
        conformeSigned: conforme !== null,
        proposalApproved: event.proposalClientStatus === 'approved',
        floorPlanApproved: event.floorPlanStatus === 'approved',
        billingSent: billing !== null,
      },
    };
  }

  /** Each selected booking, and, when a date is being considered, whether the supplier is blocked or already booked that day. */
  private async supplierFacts(
    eventId: string,
    bookings: Array<{ id: string; supplierId: string | null; supplierName: string; category: string; assignmentStatus: string }>,
    newDateKey: string | null,
  ): Promise<DateChangeSupplierFacts[]> {
    const supplierIds = [...new Set(bookings.flatMap((booking) => (booking.supplierId ? [booking.supplierId] : [])))];
    const conflicts = newDateKey && supplierIds.length > 0 ? await this.conflictsOn(eventId, supplierIds, newDateKey) : null;
    return bookings.map((booking) => ({
      requestId: booking.id,
      supplierId: booking.supplierId,
      supplierName: booking.supplierName,
      category: booking.category,
      assignmentStatus: booking.assignmentStatus,
      blockedOnNewDate: booking.supplierId ? conflicts?.blocked.has(booking.supplierId) ?? false : false,
      otherEventsOnNewDate: booking.supplierId ? conflicts?.otherEvents.get(booking.supplierId) ?? [] : [],
    }));
  }

  private async conflictsOn(eventId: string, supplierIds: string[], dateKey: string) {
    const range = dayRange(dateKey);
    const [blocked, sameDayEvents] = await Promise.all([
      this.prisma.opsSupplierAvailability.findMany({
        where: { supplierId: { in: supplierIds }, availableOn: new Date(`${dateKey}T00:00:00.000Z`), blocked: true },
        select: { supplierId: true },
      }),
      this.prisma.opsEvent.findMany({
        where: { id: { not: eventId }, archived: false, eventDate: range },
        select: { id: true, eventName: true },
        // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: events held on one calendar day.
        take: MAX_ROWS,
      }),
    ]);
    const names = new Map(sameDayEvents.map((event) => [event.id, event.eventName]));
    const bookedElsewhere = sameDayEvents.length === 0
      ? []
      : await this.prisma.opsSupplierQuoteRequest.findMany({
          where: { supplierId: { in: supplierIds }, eventId: { in: [...names.keys()] }, status: 'selected', assignmentStatus: { in: LIVE_ASSIGNMENTS } },
          select: { supplierId: true, eventId: true },
          // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: this event's suppliers booked on the events of one calendar day.
          take: MAX_ROWS,
        });
    const otherEvents = new Map<string, string[]>();
    for (const row of bookedElsewhere) {
      if (!row.supplierId) continue;
      otherEvents.set(row.supplierId, [...(otherEvents.get(row.supplierId) ?? []), names.get(row.eventId) ?? 'another event']);
    }
    return { blocked: new Set(blocked.map((row) => row.supplierId)), otherEvents };
  }
}
