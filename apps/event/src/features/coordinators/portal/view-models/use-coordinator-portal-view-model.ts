"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrismCoordinatorWorkspace } from "@prism/types";
import { clearEventSession, readStoredEventSession, type EventSession } from "@/app/lib/session";
import { coordinatorWorkspaceRepository } from "../data/coordinator-workspace-repository";
import { COORDINATOR_HOME_PATH } from "../../desk/model/coordinator-portal-routes";

export type CoordinatorPortalState =
  | { status: "loading"; session: EventSession | null; workspace: PrismCoordinatorWorkspace | null; error: null }
  | { status: "ready"; session: EventSession; workspace: PrismCoordinatorWorkspace; error: null }
  | { status: "error"; session: EventSession; workspace: PrismCoordinatorWorkspace | null; error: string };

/**
 * The coordinator portal's own session gate and data. A signed-out visitor goes to sign-in and comes back here; a
 * PMCM account goes to the PMCM dashboard. Only the coordinator workspace is read: no PMCM data loads for this portal.
 */
export function useCoordinatorPortalViewModel() {
  const router = useRouter();
  const [state, setState] = useState<CoordinatorPortalState>({ status: "loading", session: null, workspace: null, error: null });

  const load = useCallback(async (session: EventSession, force: boolean) => {
    const cached = coordinatorWorkspaceRepository.cached(session);
    if (cached && !force) {
      setState({ status: "ready", session, workspace: cached.value, error: null });
      if (coordinatorWorkspaceRepository.isFresh(cached.loadedAt)) return;
    }
    try {
      const workspace = await coordinatorWorkspaceRepository.load(session, force || Boolean(cached));
      setState({ status: "ready", session, workspace, error: null });
    } catch (cause) {
      setState((current) => ({ status: "error", session, workspace: current.workspace, error: cause instanceof Error ? cause.message : "Your coordinator desk could not load." }));
    }
  }, []);

  useEffect(() => {
    const session = readStoredEventSession();
    if (!session) {
      router.replace(`/sign-in?next=${encodeURIComponent(`${COORDINATOR_HOME_PATH}${window.location.search}`)}`);
      return;
    }
    if (session.role !== "coordinator") {
      router.replace("/dashboard");
      return;
    }
    setState({ status: "loading", session, workspace: null, error: null });
    void load(session, false);
  }, [load, router]);

  const refresh = useCallback(async () => {
    if (state.session) await load(state.session, true);
  }, [load, state.session]);

  const signOut = useCallback(async () => {
    try {
      await coordinatorWorkspaceRepository.logout();
    } catch {
      // Signing out locally is the user's intent; the server token dies at expiry if this call fails.
    } finally {
      clearEventSession();
      router.replace("/sign-in");
    }
  }, [router]);

  return { ...state, refresh, signOut };
}
