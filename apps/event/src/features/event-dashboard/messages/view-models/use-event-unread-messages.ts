"use client";

import { useResource } from "@prism/portal-query";
import { eventUnreadMessages } from "../data/event-messages-unread-resource";

/** The navigation badge's count; undefined until the first count arrives. */
export function useEventUnreadMessages() {
  const state = useResource(eventUnreadMessages, true);
  return state.status === "ready" ? state.data.unread : undefined;
}
