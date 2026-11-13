"use client";

import { useMemo } from "react";
import { useResource } from "@prism/portal-query";
import type { PrismDocument, PrismEvent } from "@prism/types";
import { clientAccountStoredFiles } from "../data/client-file-library-resources";
import type { ClientEventFileSources } from "../model/client-file-library";

/**
 * The client's files across all of their events, loaded only while `active` (an account-wide search or picking a
 * file to reuse), so opening Files never reads every event.
 */
export function useClientAccountFiles(events: PrismEvent[], documents: PrismDocument[], active: boolean) {
  const eventIds = useMemo(() => events.map((event) => event.id), [events]);
  const resource = useResource(clientAccountStoredFiles, active && eventIds.length ? eventIds : null);
  const sources = useMemo((): ClientEventFileSources[] => {
    const names = new Map(events.map((event) => [event.id, event.eventName]));
    return (resource.data ?? []).map(({ eventId, objects }) => ({
      eventId,
      eventName: names.get(eventId) ?? "Event",
      objects,
      documents: documents.filter((document) => document.eventId === eventId),
    }));
  }, [resource.data, events, documents]);
  return { sources, loading: active && resource.status === "pending", error: resource.error?.message ?? null };
}
