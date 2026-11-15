"use client";

import { useResource } from "@prism/portal-query";
import { clientUnreadNotices } from "../data/client-notifications-unread-resource";

/** The navigation count of unopened notifications; undefined until it arrives. */
export function useClientUnreadNotices() {
  const state = useResource(clientUnreadNotices, "signed-in");
  return state.status === "ready" ? state.data.unread : undefined;
}
