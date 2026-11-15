"use client";

import { useResource } from "@prism/portal-query";
import { eventUnreadNotices } from "../data/event-notifications-unread-resource";

/** The navigation count of unopened notifications; undefined until it arrives. */
export function useEventUnreadNotices() {
  const state = useResource(eventUnreadNotices, "signed-in");
  return state.status === "ready" ? state.data.unread : undefined;
}
