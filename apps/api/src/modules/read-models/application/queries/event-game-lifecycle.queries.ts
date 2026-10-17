import type { Prisma } from '@prisma/client';

/**
 * Lock the owning lifecycle row while an event-game write is in flight. Event
 * closure updates that same row, so a write either commits before closure or
 * observes the closed state after it; it cannot race past the closure commit.
 */
export async function readEventGameWriteState(prisma: Prisma.TransactionClient, eventId: string) {
  // Query budget: one row-locking read for the current event write; no per-row queries.
  const rows = await prisma.$queryRaw<Array<{ is_open: boolean }>>`
    SELECT NOT (
      archived
      OR actual_ended_at IS NOT NULL
      OR LOWER(status) IN ('closed', 'archived')
    ) AS is_open
    FROM "event_lifecycle"."events"
    WHERE id = ${eventId}
    FOR SHARE
  `;
  return rows[0]?.is_open ?? false;
}
