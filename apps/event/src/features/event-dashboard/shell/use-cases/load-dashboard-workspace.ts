import type { EventSession } from "@/app/lib/session";
import type { PrismCoordinatorWorkspace, PrismPmcmReference } from "@prism/types";
import { pmcmDashboardRepository } from "../data/pmcm-dashboard-repository";

export function loadPmcmReference(force = false): Promise<PrismPmcmReference> {
  return pmcmDashboardRepository.loadPmcmReference(force);
}

export function getCachedPmcmReference() {
  return pmcmDashboardRepository.getCachedPmcmReference();
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
