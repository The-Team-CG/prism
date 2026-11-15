"use client";

import { useResource } from "@prism/portal-query";
import { supplierEventCover } from "../data/supplier-event-cover-resource";

/** The address of a booked event's chosen cover image; undefined while it loads or when the event has none. */
export function useEventCoverUrl(eventId: string, coverObjectId: string | null | undefined) {
  const state = useResource(supplierEventCover, coverObjectId ? `${eventId}:${coverObjectId}` : null);
  return state.status === "ready" ? state.data.url : undefined;
}
