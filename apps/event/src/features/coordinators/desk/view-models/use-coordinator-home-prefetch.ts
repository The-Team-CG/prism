"use client";

import { useEffect } from "react";
import { usePrefetch } from "@prism/portal-query";
import { eventUnreadNotices } from "@/features/account-notifications/data/event-notifications-unread-resource";
import { eventUnreadMessages } from "@/features/event-dashboard/messages/data/event-messages-unread-resource";
import { coordinatorFocusRoleView } from "../data/coordinators-repository";

/**
 * Starts what the desk reads first while the shell is still loading the workspace, not after it: the focus role view
 * and the two navigation badges. Each uses the same params as its reader, so the desk finds them in the cache.
 */
export function useCoordinatorHomePrefetch() {
  const prefetch = usePrefetch();
  useEffect(() => {
    prefetch(coordinatorFocusRoleView, "signed-in");
    prefetch(eventUnreadMessages, {});
    prefetch(eventUnreadNotices, "signed-in");
  }, [prefetch]);
}
