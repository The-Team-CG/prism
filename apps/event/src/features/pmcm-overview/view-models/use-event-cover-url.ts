"use client";

import { useResource } from "@prism/portal-query";
import { pmcmEventCover } from "../data/pmcm-overview-resources";

/** The address of an event's chosen cover image; undefined while it loads or when the event has none. */
export function useEventCoverUrl(eventId: string, coverObjectId: string | null | undefined) {
  const state = useResource(pmcmEventCover, coverObjectId ? `${eventId}:${coverObjectId}` : null);
  return state.status === "ready" ? state.data.url : undefined;
}
