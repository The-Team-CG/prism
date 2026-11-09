import type { ArchiveSearchFilters, PrismArchivedEventSearchHit } from "@prism/types";

/** Archive hits shown per step; years of archived events would otherwise render as one very long list. */
export const ARCHIVE_PAGE_SIZE = 25;

export function visibleArchiveHits(hits: PrismArchivedEventSearchHit[], shown: number) {
  return { visible: hits.slice(0, shown), remaining: Math.max(0, hits.length - shown) };
}

export function archiveSearchEmptyCopy(filters: ArchiveSearchFilters, hits: PrismArchivedEventSearchHit[]) {
  if (hits.length > 0) return null;
  if (filters.venue || filters.eventType || filters.eventName || filters.clientName || filters.month) {
    return "No archived events match the selected filters.";
  }
  return "Archived events will appear here after close.";
}
