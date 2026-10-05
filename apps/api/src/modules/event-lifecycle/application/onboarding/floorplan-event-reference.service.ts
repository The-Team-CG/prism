import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { FloorplanEventReference, FloorplanEventReferenceReader } from '../../contracts/floorplan-event-reference.port';

@Injectable()
export class FloorplanEventReferenceService implements FloorplanEventReferenceReader {
  constructor(private readonly prisma: PrismaService) {}

  async findFloorplanEvent(eventId: string, transaction?: PrismTransactionContext): Promise<FloorplanEventReference | null> {
    const database = transaction?.prisma ?? this.prisma;
    if (transaction) {
      // QUERY_AUDIT_RAW_SQL: serialize Floorplan writes with Lifecycle event and ocular state changes.
      const lockedEvents = await transaction.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT "id" FROM "event_core"."events" WHERE "id" = $1 FOR UPDATE',
        eventId,
      );
      if (lockedEvents.length === 0) return null;

      // Keep lock order stable: Lifecycle event first, then its unique ocular request.
      // QUERY_AUDIT_RAW_SQL: serialize official-floorplan eligibility with ocular-state changes.
      await transaction.prisma.$queryRawUnsafe(
        'SELECT "id" FROM "event_core"."ocular_visit_requests" WHERE "event_id" = $1 FOR UPDATE',
        eventId,
      );
    }

    const event = await database.opsEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        eventName: true,
        clientName: true,
        clientPortalStatus: true,
        archived: true,
        freezeStatus: true,
        floorPlanStatus: true,
        readiness: true,
        inquiry: { select: { email: true, conformeSignedAt: true } },
        ocularVisitRequest: { select: { status: true } },
      },
    });
    if (!event) return null;

    return {
      eventId: event.id,
      eventName: event.eventName,
      clientName: event.clientName,
      clientPortalStatus: event.clientPortalStatus,
      archived: event.archived,
      freezeStatus: event.freezeStatus,
      floorPlanStatus: event.floorPlanStatus,
      readiness: event.readiness,
      primaryClientEmail: event.inquiry?.email ?? null,
      conformeSigned: Boolean(event.inquiry?.conformeSignedAt),
      ocularVisitStatus: event.ocularVisitRequest?.status ?? null,
    };
  }
}
