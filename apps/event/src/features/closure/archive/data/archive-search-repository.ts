import { eventApi, eventApiRequest } from "@/lib/prism-api";
import type { ArchiveSearchFilters, PrismArchiveComparisonRow, PrismArchivedEventSearchHit } from "@prism/types";

export const archiveSearchRepository = {
  search(filters: ArchiveSearchFilters): Promise<PrismArchivedEventSearchHit[]> {
    return eventApi.events.searchArchive(filters);
  },
  compare(eventIds: string[]): Promise<PrismArchiveComparisonRow[]> {
    return eventApiRequest<PrismArchiveComparisonRow[]>(`/api/events/archive/compare?eventIds=${encodeURIComponent(eventIds.join(","))}`);
  },
};
