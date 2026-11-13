"use client";

import { useResource } from "@prism/portal-query";
import { clientUnreadMessages } from "../data/client-messages-unread-resource";

/** The navigation badge's count; undefined until the first count arrives. */
export function useClientUnreadMessages() {
  const state = useResource(clientUnreadMessages, true);
  return state.status === "ready" ? state.data.unread : undefined;
}
