"use client";

import { useCallback, useEffect, useState } from "react";
import type { ArchiveSearchFilters, PrismArchivedEventSearchHit } from "@prism/types";
import { archiveSearchRepository } from "../data/archive-search-repository";
import { archiveSearchEmptyCopy } from "../model/archive-search-rules";

export function useEventArchiveSearchViewModel() {
  const [venue, setVenue] = useState("");
  const [eventType, setEventType] = useState("");
  const [month, setMonth] = useState("");
  const [hits, setHits] = useState<PrismArchivedEventSearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (filters: ArchiveSearchFilters) => {
    setBusy(true);
    setError(null);
    try {
      setHits(await archiveSearchRepository.search(filters));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not search the archive.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load({});
  }, [load]);

  function search() {
    void load({ venue, eventType, month });
  }

  return {
    venue,
    setVenue,
    eventType,
    setEventType,
    month,
    setMonth,
    hits,
    busy,
    error,
    emptyCopy: archiveSearchEmptyCopy({ venue, eventType, month }, hits),
    search,
  };
}
