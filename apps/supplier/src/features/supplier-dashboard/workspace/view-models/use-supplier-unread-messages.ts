"use client";

import { useResource } from "@prism/portal-query";
import type { PrismAuthenticatedSession } from "@prism/types";
import { supplierUnreadMessages } from "../data/supplier-messages-unread-resource";

/** The navigation badge's count; undefined until the session is known and the first count arrives. */
export function useSupplierUnreadMessages(session: PrismAuthenticatedSession | null | undefined) {
  const state = useResource(supplierUnreadMessages, session ?? null);
  return state.status === "ready" ? state.data.unread : undefined;
}
