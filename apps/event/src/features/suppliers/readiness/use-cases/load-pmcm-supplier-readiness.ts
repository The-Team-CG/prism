import type { PrismPmcmSupplierReadinessBoard } from "@prism/types";
import { pmcmSupplierReadinessRepository } from "../data/pmcm-supplier-readiness-repository";

export function loadPmcmSupplierReadiness(eventId: string): Promise<PrismPmcmSupplierReadinessBoard> {
  return pmcmSupplierReadinessRepository.get(eventId);
}
