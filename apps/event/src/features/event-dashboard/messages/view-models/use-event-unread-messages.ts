"use client";

import { useResource } from "@prism/portal-query";
import type { CommunicationUnreadCountQuery } from "@prism/types";
import { eventUnreadMessages } from "../data/event-messages-unread-resource";

/** The navigation count: the inbox total with no query, or one event's conversations with `{ eventId }`. Undefined until it arrives. */
export function useEventUnreadMessages(query: CommunicationUnreadCountQuery = {}) {
  const state = useResource(eventUnreadMessages, query);
  return state.status === "ready" ? state.data.unread : undefined;
}
