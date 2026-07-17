import type { EventSession } from "@/app/lib/session";
import type { PrismCoordinatorWorkspace, PrismPmcmDashboardWorkspace } from "@prism/types";
import { pmcmDashboardRepository } from "../data/pmcm-dashboard-repository";

export function loadPmcmState(force = false): Promise<PrismPmcmDashboardWorkspace> {
  return pmcmDashboardRepository.loadPmcmState(force);
}

export function getCachedPmcmState() {
  return pmcmDashboardRepository.getCachedPmcmState();
}

export function loadCoordinatorWorkspace(
  session: EventSession,
  force = false,
): Promise<PrismCoordinatorWorkspace> {
  return pmcmDashboardRepository.loadCoordinatorWorkspace(session, force);
}

export function getCachedCoordinatorWorkspace(session: EventSession) {
  return pmcmDashboardRepository.getCachedCoordinatorWorkspace(session);
}

export function isDashboardCacheFresh(loadedAt: number) {
  return pmcmDashboardRepository.isFresh(loadedAt);
}
