import type { PrismPmcmReference } from "@prism/types";
import { pmcmDashboardRepository } from "../data/pmcm-dashboard-repository";

export function loadPmcmReference(force = false): Promise<PrismPmcmReference> {
  return pmcmDashboardRepository.loadPmcmReference(force);
}

/** The events changed (a new cover, for one): the next read of them goes to the API. */
export function forgetPmcmReference() {
  pmcmDashboardRepository.forgetPmcmReference();
}

export function getCachedPmcmReference() {
  return pmcmDashboardRepository.getCachedPmcmReference();
}



export function isDashboardCacheFresh(loadedAt: number) {
  return pmcmDashboardRepository.isFresh(loadedAt);
}
