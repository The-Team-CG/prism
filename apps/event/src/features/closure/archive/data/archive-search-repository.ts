import { prismApi } from "@/lib/prism-api";
import type { ArchiveSearchFilters, PrismArchivedEventSearchHit } from "@prism/types";

export const archiveSearchRepository = {
  search(filters: ArchiveSearchFilters): Promise<PrismArchivedEventSearchHit[]> {
    return prismApi.searchArchive(filters);
  },
};
