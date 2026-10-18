"use client";

import { useCallback, useEffect, useState } from "react";
import type { ArchiveSearchFilters, PrismArchiveComparisonRow, PrismArchivedEventSearchHit } from "@prism/types";
import { archiveSearchRepository } from "../data/archive-search-repository";
import { archiveSearchEmptyCopy } from "../model/archive-search-rules";
import { canCompareArchivedEvents, toggleArchiveComparisonSelection } from "../model/archive-comparison-rules";

export function useEventArchiveSearchViewModel() {
  const [venue, setVenue] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventName, setEventName] = useState("");
  const [clientName, setClientName] = useState("");
  const [month, setMonth] = useState("");
  const [hits, setHits] = useState<PrismArchivedEventSearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<PrismArchiveComparisonRow[] | null>(null);
  const [comparing, setComparing] = useState(false);

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
    void load({ venue, eventType, eventName, clientName, month });
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => toggleArchiveComparisonSelection(current, id));
    setComparison(null);
  }

  async function compareSelected() {
    if (!canCompareArchivedEvents(selectedIds)) return;
    setComparing(true);
    setError(null);
    try {
      setComparison(await archiveSearchRepository.compare(selectedIds));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not compare the selected events.");
    } finally {
      setComparing(false);
    }
  }

  return {
    venue,
    setVenue,
    eventType,
    setEventType,
    eventName,
    setEventName,
    clientName,
    setClientName,
    month,
    setMonth,
    hits,
    busy,
    error,
    emptyCopy: archiveSearchEmptyCopy({ venue, eventType, eventName, clientName, month }, hits),
    search,
    selectedIds,
    toggleSelection,
    canCompare: canCompareArchivedEvents(selectedIds),
    comparison,
    comparing,
    compareSelected,
    closeComparison: () => setComparison(null),
  };
}
