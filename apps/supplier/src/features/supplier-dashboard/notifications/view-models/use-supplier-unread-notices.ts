"use client";

import { useResource } from "@prism/portal-query";
import type { PrismAuthenticatedSession } from "@prism/types";
import { supplierUnreadNotices } from "../data/supplier-notifications-unread-resource";

/** The navigation count of unopened notifications; undefined until the session is known and the first count arrives. */
export function useSupplierUnreadNotices(session: PrismAuthenticatedSession | null | undefined) {
  const state = useResource(supplierUnreadNotices, session ?? null);
  return state.status === "ready" ? state.data.unread : undefined;
}
