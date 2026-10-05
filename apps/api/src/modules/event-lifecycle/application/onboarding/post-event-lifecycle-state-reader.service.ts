import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PostEventLifecycleState, PostEventLifecycleStateReader } from '../../contracts/post-event-reference-reader.port';

@Injectable()
export class PostEventLifecycleStateReaderService implements PostEventLifecycleStateReader {
  constructor(private readonly prisma: PrismaService) {}

  async findPostEventState(eventId: string, transaction?: PrismTransactionContext): Promise<PostEventLifecycleState | null> {
    const database = transaction?.prisma ?? this.prisma;
    if (transaction) {
      // QUERY_AUDIT_RAW_SQL: serialize post-event billing eligibility with Lifecycle event-state transitions.
      await transaction.prisma.$queryRawUnsafe(
        'SELECT "id" FROM "event_lifecycle"."events" WHERE "id" = $1 FOR UPDATE',
        eventId,
      );
    }
    const event = await database.opsEvent.findUnique({
      where: { id: eventId },
      select: { id: true, actualEndedAt: true },
    });
    return event ? { eventId: event.id, actualEndedAt: event.actualEndedAt } : null;
  }
}
