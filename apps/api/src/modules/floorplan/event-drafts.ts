import { Prisma } from '@prisma/client';
import type { OpsFloorPlanDraft } from '@prisma/client';

/**
 * Floorplan-owned read of official and preference drafts for a set of events. Other contexts hold only the
 * scalar event id, so they ask Floorplan for drafts instead of navigating a cross-domain Prisma relation.
 */
export const DEFAULT_FLOORPLAN_DRAFTS_PER_EVENT = 100;

type DraftReader = { $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T> };

export type FloorPlanDraftsByEvent = Map<string, OpsFloorPlanDraft[]>;

export function isClientVisibleFloorPlanDraft(draft: Pick<OpsFloorPlanDraft, 'sourceType' | 'status'>): boolean {
  return draft.sourceType === 'client_preference' || ['in_review', 'revision_requested', 'approved'].includes(draft.status);
}

export async function findFloorPlanDraftsByEvent(
  db: DraftReader,
  eventIds: readonly string[],
  options: {
    perEventLimit?: number;
  } = {},
): Promise<FloorPlanDraftsByEvent> {
  const grouped: FloorPlanDraftsByEvent = new Map();
  const uniqueEventIds = [...new Set(eventIds)];
  if (uniqueEventIds.length === 0) return grouped;
  const perEventLimit = options.perEventLimit ?? DEFAULT_FLOORPLAN_DRAFTS_PER_EVENT;
  if (!Number.isSafeInteger(perEventLimit) || perEventLimit < 0) {
    throw new RangeError('Floorplan draft limit must be a non-negative safe integer');
  }
  if (perEventLimit === 0) return grouped;

  const rows = await db.$queryRaw<OpsFloorPlanDraft[]>(Prisma.sql`
    SELECT
      id,
      event_id AS "eventId",
      floor_plan_id AS "floorPlanId",
      name,
      status,
      is_active AS "isActive",
      source_type AS "sourceType",
      created_by_role AS "createdByRole",
      client_preference AS "clientPreference",
      submitted_snapshot AS "submittedSnapshot",
      approved_snapshot AS "approvedSnapshot",
      submitted_at AS "submittedAt",
      reviewed_at AS "reviewedAt",
      approved_at AS "approvedAt",
      submitted_snapshot_at AS "submittedSnapshotAt",
      approved_snapshot_at AS "approvedSnapshotAt",
      revision_comment AS "revisionComment",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM (
      SELECT draft.*, row_number() OVER (
        PARTITION BY event_id ORDER BY updated_at DESC, id DESC
      ) AS event_rank
      FROM "floorplan"."floor_plan_drafts" AS draft
      WHERE event_id IN (${Prisma.join(uniqueEventIds)})
    ) ranked
    WHERE event_rank <= ${perEventLimit}
    ORDER BY "eventId" ASC, "updatedAt" DESC, id DESC
  `);
  for (const row of rows) {
    const drafts = grouped.get(row.eventId) ?? [];
    if (drafts.length < perEventLimit) drafts.push(row);
    grouped.set(row.eventId, drafts);
  }
  return grouped;
}

/** Attach each event's drafts so existing mappers keep reading event.floorPlanDrafts. */
export function withFloorPlanDrafts<T extends { id: string }>(
  events: readonly T[],
  draftsByEvent: FloorPlanDraftsByEvent,
): Array<T & { floorPlanDrafts: OpsFloorPlanDraft[] }> {
  return events.map((event) => ({ ...event, floorPlanDrafts: draftsByEvent.get(event.id) ?? [] }));
}
