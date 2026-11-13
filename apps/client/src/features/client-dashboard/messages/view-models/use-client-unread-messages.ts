"use client";

import { useResource } from "@prism/portal-query";
import type { CommunicationUnreadCountQuery } from "@prism/types";
import { clientUnreadMessages } from "../data/client-messages-unread-resource";

/** The navigation count: the account total with no query, or one event's conversations with `{ eventId }`. Undefined until it arrives. */
export function useClientUnreadMessages(query: CommunicationUnreadCountQuery = {}) {
  const state = useResource(clientUnreadMessages, query);
  return state.status === "ready" ? state.data.unread : undefined;
}
