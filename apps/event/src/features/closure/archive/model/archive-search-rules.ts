import type { ArchiveSearchFilters, PrismArchivedEventSearchHit } from "@prism/types";

export function archiveSearchEmptyCopy(filters: ArchiveSearchFilters, hits: PrismArchivedEventSearchHit[]) {
  if (hits.length > 0) return null;
  if (filters.venue || filters.eventType || filters.eventName || filters.clientName || filters.month) {
    return "No archived events match the selected filters.";
  }
  return "Archived events will appear here after close.";
}
