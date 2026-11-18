import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import type { TableEligibilityGuest } from '@prism/types';
import type { FloorplanSeatingFactsReader } from './floorplan-seating.port';

@Injectable()
export class FloorplanSeatingFactsService implements FloorplanSeatingFactsReader {
  constructor(private readonly prisma: PrismaService) {}

  async listSeatingGuests(eventId: string, db: Prisma.TransactionClient = this.prisma): Promise<TableEligibilityGuest[]> {
    // QUERY_AUDIT_ALLOW_UNBOUNDED: one event's roster; seating is only open for events under 200 guests, and the
    // check must see every guest a scene can name.
    const rows = await db.opsGuestRosterEntry.findMany({
      where: { eventId, withdrawnAt: null, eligibility: 'eligible' },
      select: { id: true, rsvp: true },
    });
    return rows.map((row) => ({ id: row.id, rsvp: row.rsvp }));
  }

  async bookedSupplierIds(eventId: string, db: Prisma.TransactionClient = this.prisma): Promise<Set<string>> {
    const rows = await db.opsSupplierQuoteRequest.findMany({
      where: { eventId, status: 'selected', supplierId: { not: null } },
      select: { supplierId: true },
    });
    return new Set(rows.flatMap((row) => (row.supplierId ? [row.supplierId] : [])));
  }
}
