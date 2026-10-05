import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type {
  OperationsEventReference,
  OperationsEventReferenceReader,
  WalkInPolicyChange,
  WalkInPolicyOwner,
} from '../../contracts/operations-event-reference.port';
import type { UpdateWalkInPolicyInput } from '@prism/types';

@Injectable()
export class OperationsEventReferenceService implements OperationsEventReferenceReader, WalkInPolicyOwner {
  constructor(private readonly prisma: PrismaService) {}

  async findOperationsEvent(eventId: string, transaction?: PrismTransactionContext): Promise<OperationsEventReference | null> {
    if (transaction) {
      // QUERY_AUDIT_RAW_SQL: Lifecycle locks event state before Operations commits an event-scoped mutation.
      const locked = await transaction.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT "id" FROM "event_lifecycle"."events" WHERE "id" = $1 FOR UPDATE',
        eventId,
      );
      if (locked.length === 0) return null;
    }
    const event = await (transaction?.prisma ?? this.prisma).opsEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        eventName: true,
        clientName: true,
        eventDate: true,
        status: true,
        archived: true,
        actualEndedAt: true,
        walkInPolicy: true,
        walkInThreshold: true,
      },
    });
    return event;
  }

  async findOperationsEvents(eventIds: readonly string[]): Promise<OperationsEventReference[]> {
    if (eventIds.length === 0) return [];
    return this.prisma.opsEvent.findMany({
      where: { id: { in: [...eventIds] } },
      select: {
        id: true,
        eventName: true,
        clientName: true,
        eventDate: true,
        status: true,
        archived: true,
        actualEndedAt: true,
        walkInPolicy: true,
        walkInThreshold: true,
      },
    });
  }

  async findEventIdsByDateRange(startsAt: Date, endsBefore: Date): Promise<string[]> {
    const events = await this.prisma.opsEvent.findMany({
      where: { eventDate: { gte: startsAt, lt: endsBefore } },
      select: { id: true },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
    });
    return events.map((event) => event.id);
  }

  async findEventReadAccess(eventId: string) {
    return this.prisma.opsEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        clientName: true,
        clientPortalStatus: true,
        clientEmail: true,
        inquiry: { select: { email: true } },
      },
    });
  }

  async updateWalkInPolicy(
    eventId: string,
    input: UpdateWalkInPolicyInput,
    transaction: PrismTransactionContext,
  ): Promise<WalkInPolicyChange | null> {
    const beforeEvent = await this.findOperationsEvent(eventId, transaction);
    if (!beforeEvent) return null;
    const updated = await transaction.prisma.opsEvent.update({
      where: { id: eventId },
      data: {
        walkInPolicy: input.policy,
        ...(input.threshold !== undefined ? { walkInThreshold: input.threshold } : {}),
      },
      select: {
        id: true,
        eventName: true,
        clientName: true,
        eventDate: true,
        status: true,
        archived: true,
        actualEndedAt: true,
        walkInPolicy: true,
        walkInThreshold: true,
      },
    });
    return {
      before: this.toWalkInPolicySnapshot(beforeEvent),
      after: this.toWalkInPolicySnapshot(updated),
    };
  }

  private toWalkInPolicySnapshot(event: OperationsEventReference) {
    return {
      eventId: event.id,
      eventName: event.eventName,
      policy: event.walkInPolicy,
      threshold: event.walkInThreshold,
    };
  }
}
