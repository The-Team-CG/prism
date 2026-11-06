"use client";

import { useEffect } from "react";
import { usePrefetch } from "@prism/portal-query";
import { coordinatorFocusRoleView } from "../data/coordinators-repository";

/** Starts the coordinator's focus role view while the shell is still loading the workspace, not after it. */
export function useCoordinatorHomePrefetch() {
  const prefetch = usePrefetch();
  useEffect(() => {
    prefetch(coordinatorFocusRoleView, "signed-in");
  }, [prefetch]);
}
