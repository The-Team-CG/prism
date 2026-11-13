"use client";

import { useEffect, useMemo, useState } from "react";
import { useResource } from "@prism/portal-query";
import type { PrismEvent } from "@prism/types";
import { clientStoredFileSearch } from "../data/client-file-library-resources";
import { clientAccountFiles } from "../model/client-file-library";

const SEARCH_DELAY_MS = 250;

/** The latest value once it has stopped changing for `delay` ms, so typing sends one search instead of one per key. */
function useSettledValue<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/**
 * The client's files across all of their events matching `query`, read in one request while `query` is not null
 * (an account-wide search, or picking a file to reuse). Opening Files never reads every event.
 */
export function useClientAccountFiles(query: string | null, events: PrismEvent[]) {
  const settled = useSettledValue(query === null ? null : query.trim(), SEARCH_DELAY_MS);
  const resource = useResource(clientStoredFileSearch, settled);
  const files = useMemo(() => clientAccountFiles(resource.data ?? [], new Map(events.map((event) => [event.id, event.eventName]))), [resource.data, events]);
  const waiting = query !== null && (settled !== (query?.trim() ?? null) || resource.status === "pending");
  return { files, loading: waiting, error: resource.error?.message ?? null };
}
