import type { Prisma } from '@prisma/client';

/**
 * Lock the owning lifecycle row while an event-game write is in flight. Event
 * closure updates that same row, so a write either commits before closure or
 * observes the closed state after it; it cannot race past the closure commit.
 */
export async function readEventGameWriteState(prisma: Prisma.TransactionClient, eventId: string) {
  // Query budget: one row-locking read for the current event write; no per-row queries.
  // QUERY_AUDIT_RAW_SQL: FOR SHARE on the owning event lifecycle row: a concurrent event closure waits until this game write commits, as the function doc comment states.
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
