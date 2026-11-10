import { eventApi } from "@/lib/prism-api";
import type { ArchiveSearchFilters, PrismArchiveComparisonRow, PrismArchivedEventSearchHit } from "@prism/types";

export const archiveSearchRepository = {
  search(filters: ArchiveSearchFilters): Promise<PrismArchivedEventSearchHit[]> {
    return eventApi.events.searchArchive(filters);
  },
  compare(eventIds: string[]): Promise<PrismArchiveComparisonRow[]> {
    return eventApi.closure.compareArchived(eventIds);
  },
};
