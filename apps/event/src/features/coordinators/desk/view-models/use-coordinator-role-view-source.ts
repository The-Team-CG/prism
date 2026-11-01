"use client";

import { useEffect, useMemo } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import { coordinatorFocusRoleView } from "../data/coordinators-repository";
import { coordinatorRoleViewSource } from "../model/coordinators-desk-rules";

/** The home's default event reads the focus role view the shell started alongside the workspace. */
export function useCoordinatorRoleViewSource(opensOnFocus: boolean, eventId: string | undefined) {
  const { status, data, error } = useResource(coordinatorFocusRoleView, opensOnFocus ? "signed-in" : null);
  // Commands update the role view in place, so a later visit must not reuse this cached focus as current.
  const invalidate = useInvalidate();
  useEffect(() => () => void invalidate(coordinatorFocusRoleView), [invalidate]);
  return useMemo(
    () => coordinatorRoleViewSource(opensOnFocus ? { status, data, error } : null, eventId),
    [opensOnFocus, status, data, error, eventId],
  );
}
